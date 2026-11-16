// Patient-name lookup for the YATA web app, run as Vercel functions (api/lookup-session.js, api/patient.js).
//
// The browser cannot hold EMR Viewer's lookup token, so these functions hold it (env EMR_LOOKUP_TOKEN) and ask
// EMR Viewer (HIS-connect) on the user's behalf. A caller must first prove a YATA login: POST /api/lookup-session
// checks pha_id + password against the Firestore `users` collection the same way src/lib/api.ts `login` does,
// then signs a short-lived session with LOOKUP_SESSION_SECRET. GET /api/patient accepts only that session.
//
// Everything here takes `env` and `fetchImpl` as arguments so scripts/tests/lookupApi.test.mjs can run it offline.
// Never log an HN, a name, a password or a token from this file.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** A session with less than this left is re-issued by /api/patient, so a long shift never has to log in again. */
export const SESSION_RENEW_BELOW_MS = 6 * 60 * 60 * 1000;
const FIRESTORE_PROJECT_ID = 'yata-e56f7';
const DEFAULT_EMR_LOOKUP_URL = 'https://emr.codex074.com';
/** The GitHub Pages site and the desktop app's local origin. Add the Vercel domain only if it differs from the function's own host. */
const DEFAULT_ALLOWED_ORIGINS = 'https://codex074.github.io,http://127.0.0.1:37200';
const UPSTREAM_TIMEOUT_MS = 8000;

const b64url = (value) => Buffer.from(value).toString('base64url');
const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');
const sameString = (a, b) => {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
};

/** The server is usable only with both secrets set; anything else must answer "not configured", never fall open. */
export function readConfig(env) {
  const secret = String(env.LOOKUP_SESSION_SECRET ?? '');
  const emrToken = String(env.EMR_LOOKUP_TOKEN ?? '');
  if (secret.length < 32 || !emrToken) return null;
  return {
    secret,
    emrToken,
    emrUrl: String(env.EMR_LOOKUP_URL || DEFAULT_EMR_LOOKUP_URL),
    allowedOrigins: String(env.LOOKUP_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).split(',').map((o) => o.trim()).filter(Boolean),
  };
}

// --- CORS: an explicit origin allowlist, never `*` (Audit SEC-5) ---

/** Returns { allowed, headers }. A request with no Origin (same-origin GET, curl) is allowed: the session is the real gate. */
export function corsFor(origin, host, allowedOrigins) {
  if (!origin) return { allowed: true, headers: {} };
  let sameHost = false;
  try { sameHost = Boolean(host) && new URL(origin).host === host; } catch { sameHost = false; }
  if (!sameHost && !allowedOrigins.includes(origin)) return { allowed: false, headers: {} };
  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  };
}

// --- Session: "<payload>.<hmac>", payload = base64url JSON { u: pha_id, exp: ms, v: password fingerprint } ---

/** A keyed fingerprint of the password the session was issued for; a renewal is refused once the password changes. */
export const passwordVersion = (password, secret) => sign(`pw:${password}`, secret).slice(0, 22);

export function issueSession(phaId, secret, now = Date.now(), version = '') {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = b64url(JSON.stringify({ u: phaId, exp: expiresAt, v: version }));
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

/** Returns { phaId, expiresAt, version } or null. */
export function verifySession(token, secret, now = Date.now()) {
  const [payload, mac, extra] = String(token ?? '').split('.');
  if (!payload || !mac || extra !== undefined) return null;
  if (!sameString(mac, sign(payload, secret))) return null;
  try {
    const { u, exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof u !== 'string' || !u || typeof exp !== 'number' || exp <= now) return null;
    return { phaId: u, expiresAt: exp, version: typeof v === 'string' ? v : '' };
  } catch {
    return null;
  }
}

// --- Credentials: the same rule as `api.login` in src/lib/api.ts ---

const firestoreValue = (field) => (field && typeof field === 'object' ? Object.values(field)[0] : undefined);

/** Reads one user: { ok: true, password, active } | { ok: false, reason: 'invalid' | 'unavailable' }. */
async function loadUser(fetchImpl, normalized) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(normalized)}`;
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (res.status === 404) return { ok: false, reason: 'invalid' };
  if (res.status !== 200) return { ok: false, reason: 'unavailable' };
  let fields;
  try { fields = (await res.json())?.fields ?? {}; } catch { return { ok: false, reason: 'unavailable' }; }
  return { ok: true, password: String(firestoreValue(fields.password) ?? ''), active: firestoreValue(fields.active) !== false };
}

/** Resolves to { ok: true, phaId } | { ok: false, reason: 'invalid' | 'disabled' | 'unavailable' }. */
export async function verifyCredentials({ fetchImpl, phaId, password }) {
  const normalized = String(phaId ?? '').trim().toLowerCase();
  if (!normalized || normalized.includes('/') || typeof password !== 'string' || !password) {
    return { ok: false, reason: 'invalid' };
  }
  const user = await loadUser(fetchImpl, normalized);
  if (!user.ok) return user;
  if (!sameString(user.password, password)) return { ok: false, reason: 'invalid' };
  if (!user.active) return { ok: false, reason: 'disabled' };
  return { ok: true, phaId: normalized };
}

/** A session is renewed only while its user still exists, is active and has the password it was issued for. */
export async function canRenew({ fetchImpl, session, secret }) {
  if (!session.version) return false;
  const user = await loadUser(fetchImpl, session.phaId);
  return user.ok && user.active && sameString(passwordVersion(user.password, secret), session.version);
}

// --- EMR Viewer: GET {emrUrl}/api/yata/patient?hn= ---

const FAILURE_MESSAGE = 'เชื่อมต่อ HOSxP ไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อผู้ดูแลระบบ';

/** 7–9 digits, padded to the 9-digit HN. Returns null when it is not an HN. */
export function normalizeHn(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 9 ? digits.padStart(9, '0') : null;
}

/**
 * Resolves to what the web app shows:
 *   found            { ok: true, patient: { hn, fullName } }
 *   no such patient  { ok: false, message }                 (EMR answered 404 with { ok: false })
 *   could not ask    { ok: false, failure: true, message }  (401, 429, 502, a bare 404, network, timeout)
 */
export async function lookupPatient({ fetchImpl, emrUrl, emrToken, hn, phaId }) {
  const url = new URL('/api/yata/patient', emrUrl);
  url.searchParams.set('hn', hn);
  let status;
  let body = {};
  try {
    const res = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${emrToken}`,
        // An HTTP header: printable ASCII only, and EMR keeps at most 64 characters.
        'X-Yata-User': String(phaId).replace(/[^\x21-\x7e]/g, '').slice(0, 64) || 'yata-web',
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    status = res.status;
    try { body = await res.json(); } catch { body = {}; }
  } catch {
    return { ok: false, failure: true, message: FAILURE_MESSAGE };
  }
  if (status === 200 && body?.ok && body.patient?.fullName) {
    return { ok: true, patient: { hn: body.patient.hn || hn, fullName: body.patient.fullName } };
  }
  if (status === 404 && body?.ok === false) {
    return { ok: false, message: `ไม่พบข้อมูลผู้ป่วย (HN: ${hn})` };
  }
  console.error('[lookup] EMR answered', status);
  return { ok: false, failure: true, message: status === 429 ? 'ค้นบ่อยเกินไป กรุณารอสักครู่' : FAILURE_MESSAGE };
}

// --- The two endpoints, as plain functions: (request) → { status, headers, body } ---

const reply = (status, body, headers = {}) => ({ status, headers: { 'Cache-Control': 'no-store', ...headers }, body });

function preamble({ method, origin, host, env }, allowedMethod) {
  const config = readConfig(env);
  const cors = corsFor(origin, host, config?.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS.split(','));
  if (!cors.allowed) return { done: reply(403, { ok: false, message: 'origin ไม่ได้รับอนุญาต' }) };
  if (method === 'OPTIONS') return { done: reply(204, null, cors.headers) };
  if (method !== allowedMethod) return { done: reply(405, { ok: false, message: 'method ไม่ถูกต้อง' }, cors.headers) };
  if (!config) return { done: reply(503, { ok: false, failure: true, message: 'ระบบค้นชื่อผู้ป่วยยังไม่ได้ตั้งค่า' }, cors.headers) };
  return { config, cors };
}

/** POST /api/lookup-session  { pha_id, password } → { ok: true, token, expiresAt } */
export async function handleLookupSession({ method, origin, host, body, env, fetchImpl, now = Date.now() }) {
  const pre = preamble({ method, origin, host, env }, 'POST');
  if (pre.done) return pre.done;
  const result = await verifyCredentials({ fetchImpl, phaId: body?.pha_id, password: body?.password });
  if (!result.ok) {
    if (result.reason === 'unavailable') {
      return reply(503, { ok: false, failure: true, message: 'ตรวจสอบผู้ใช้ไม่ได้ กรุณาลองใหม่' }, pre.cors.headers);
    }
    return reply(401, { ok: false, message: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, pre.cors.headers);
  }
  const version = passwordVersion(body.password, pre.config.secret);
  return reply(200, { ok: true, ...issueSession(result.phaId, pre.config.secret, now, version) }, pre.cors.headers);
}

/** GET /api/patient?hn=  with `Authorization: Bearer <session>` */
export async function handlePatient({ method, origin, host, authorization, hn, env, fetchImpl, now = Date.now() }) {
  const pre = preamble({ method, origin, host, env }, 'GET');
  if (pre.done) return pre.done;
  const auth = String(authorization ?? '');
  const session = auth.startsWith('Bearer ') ? verifySession(auth.slice(7), pre.config.secret, now) : null;
  if (!session) {
    return reply(401, { ok: false, relogin: true, message: 'กรุณาเข้าสู่ระบบใหม่เพื่อค้นชื่อผู้ป่วย' }, pre.cors.headers);
  }
  const normalized = normalizeHn(hn);
  if (!normalized) return reply(200, { ok: false, message: 'HN ต้องมี 7–9 หลัก' }, pre.cors.headers);
  const result = await lookupPatient({
    fetchImpl, emrUrl: pre.config.emrUrl, emrToken: pre.config.emrToken, hn: normalized, phaId: session.phaId,
  });
  // Renewal re-reads the user, so a disabled account or a changed password stops within 12 hours at most.
  const renewed = session.expiresAt - now < SESSION_RENEW_BELOW_MS
    && await canRenew({ fetchImpl, session, secret: pre.config.secret })
    ? { session: issueSession(session.phaId, pre.config.secret, now, session.version) }
    : {};
  return reply(200, { ...result, ...renewed }, pre.cors.headers);
}

/** Sends a { status, headers, body } result through a Vercel (Node) response. */
export function send(res, result) {
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.statusCode = result.status;
  if (result.body === null) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(result.body));
}
