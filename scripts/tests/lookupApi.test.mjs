// Run: node --test scripts/tests/lookupApi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_TTL_MS, SESSION_RENEW_BELOW_MS, corsFor, handleLookupSession, handlePatient,
  issueSession, normalizeHn, passwordVersion, readConfig, verifySession,
} from '../../api/_lib/lookupCore.js';

const SECRET = 's'.repeat(40);
const ENV = { LOOKUP_SESSION_SECRET: SECRET, EMR_LOOKUP_TOKEN: 'emr-token', EMR_LOOKUP_URL: 'https://emr.test' };
const PAGES = 'https://codex074.github.io';
const NOW = 1_800_000_000_000;

const json = (status, body) => ({ status, json: async () => body });
/** Firestore REST answers with typed fields. */
const userDoc = (fields) => json(200, { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) =>
  [k, typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }])) });

/** A fetch stand-in that records calls and answers by host. */
function stubFetch({ firestore, emr }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers ?? {} });
    const answer = String(url).startsWith('https://firestore.googleapis.com/') ? firestore : emr;
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer(String(url)) : answer;
  };
  return { fetchImpl, calls };
}

const login = (overrides = {}, stub = stubFetch({ firestore: userDoc({ pha_id: 'pha01', password: 'secret1', active: true }) })) =>
  handleLookupSession({ method: 'POST', origin: PAGES, host: 'yata.vercel.app', body: { pha_id: 'PHA01 ', password: 'secret1' }, env: ENV, fetchImpl: stub.fetchImpl, now: NOW, ...overrides });

const FOUND = json(200, { ok: true, patient: { hn: '000123456', fullName: 'นายทดสอบ ระบบ', pname: 'นาย' } });
const ask = (overrides = {}, stub = stubFetch({ emr: FOUND })) => handlePatient({
  method: 'GET', origin: PAGES, host: 'yata.vercel.app', hn: '123456789'.slice(0, 7),
  authorization: `Bearer ${issueSession('pha01', SECRET, NOW).token}`, env: ENV, fetchImpl: stub.fetchImpl, now: NOW, ...overrides,
});

// --- config ---

test('readConfig needs both secrets, and a session secret of 32+ characters', () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ ...ENV, LOOKUP_SESSION_SECRET: 'short' }), null);
  assert.equal(readConfig({ ...ENV, EMR_LOOKUP_TOKEN: '' }), null);
  assert.equal(readConfig(ENV).emrUrl, 'https://emr.test');
});

test('not configured: both endpoints answer 503 and call nothing', async () => {
  const stub = stubFetch({ firestore: FOUND, emr: FOUND });
  assert.equal((await login({ env: {} }, stub)).status, 503);
  assert.equal((await ask({ env: {} }, stub)).status, 503);
  assert.equal(stub.calls.length, 0);
});

// --- CORS ---

test('corsFor: allowlisted and same-host origins pass, others do not, and it never answers *', () => {
  const allowed = [PAGES, 'http://127.0.0.1:37200'];
  assert.equal(corsFor(PAGES, 'x.vercel.app', allowed).headers['Access-Control-Allow-Origin'], PAGES);
  assert.equal(corsFor('https://x.vercel.app', 'x.vercel.app', allowed).allowed, true);
  assert.equal(corsFor('https://evil.example', 'x.vercel.app', allowed).allowed, false);
  assert.equal(corsFor('null', 'x.vercel.app', allowed).allowed, false);
  assert.deepEqual(corsFor(undefined, 'x.vercel.app', allowed), { allowed: true, headers: {} });
});

test('a foreign origin gets 403 before anything else happens', async () => {
  const stub = stubFetch({ firestore: FOUND, emr: FOUND });
  assert.equal((await login({ origin: 'https://evil.example' }, stub)).status, 403);
  assert.equal((await ask({ origin: 'https://evil.example' }, stub)).status, 403);
  assert.equal(stub.calls.length, 0);
});

test('preflight: 204 with the Authorization header allowed', async () => {
  const result = await ask({ method: 'OPTIONS', authorization: undefined });
  assert.equal(result.status, 204);
  assert.match(result.headers['Access-Control-Allow-Headers'], /Authorization/);
});

// --- session ---

test('a session verifies until it expires, and not after tampering or with another secret', () => {
  const { token, expiresAt } = issueSession('pha01', SECRET, NOW);
  assert.equal(expiresAt, NOW + SESSION_TTL_MS);
  assert.deepEqual(verifySession(token, SECRET, NOW), { phaId: 'pha01', expiresAt, version: '' });
  assert.equal(verifySession(token, SECRET, expiresAt), null);
  assert.equal(verifySession(token, 'x'.repeat(40), NOW), null);
  const forged = `${Buffer.from(JSON.stringify({ u: 'admin', exp: NOW + 1e9 })).toString('base64url')}.${token.split('.')[1]}`;
  assert.equal(verifySession(forged, SECRET, NOW), null);
  for (const bad of ['', 'abc', 'a.b.c', undefined]) assert.equal(verifySession(bad, SECRET, NOW), null);
});

// --- POST /api/lookup-session ---

test('login: the right password gives a session for the normalised pha_id', async () => {
  const stub = stubFetch({ firestore: userDoc({ pha_id: 'pha01', password: 'secret1', active: true }) });
  const result = await login({}, stub);
  assert.equal(result.status, 200);
  assert.equal(verifySession(result.body.token, SECRET, NOW).phaId, 'pha01');
  assert.match(stub.calls[0].url, /\/documents\/users\/pha01$/);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('login: wrong password, unknown user, disabled user and bad input are all 401', async () => {
  const doc = userDoc({ pha_id: 'pha01', password: 'secret1', active: true });
  assert.equal((await login({ body: { pha_id: 'pha01', password: 'nope' } }, stubFetch({ firestore: doc }))).status, 401);
  assert.equal((await login({}, stubFetch({ firestore: json(404, {}) }))).status, 401);
  assert.equal((await login({}, stubFetch({ firestore: userDoc({ password: 'secret1', active: false }) }))).status, 401);
  // A user document with no password must not accept an empty one.
  assert.equal((await login({ body: { pha_id: 'pha01', password: '' } }, stubFetch({ firestore: userDoc({ active: true }) }))).status, 401);
  for (const body of [undefined, {}, { pha_id: 'a/b', password: 'x' }, { pha_id: 'pha01', password: 123 }]) {
    const stub = stubFetch({ firestore: doc });
    assert.equal((await login({ body }, stub)).status, 401);
    assert.equal(stub.calls.length, 0);
  }
});

test('login: a numeric password stored in Firestore compares as a string, like api.login', async () => {
  const result = await login({ body: { pha_id: 'pha01', password: '1234' } }, stubFetch({ firestore: userDoc({ password: 1234 }) }));
  assert.equal(result.status, 200);
});

test('login: Firestore down is 503, not "wrong password"', async () => {
  assert.equal((await login({}, stubFetch({ firestore: new Error('network') }))).status, 503);
  assert.equal((await login({}, stubFetch({ firestore: json(500, {}) }))).status, 503);
});

test('login: only POST', async () => {
  assert.equal((await login({ method: 'GET' })).status, 405);
});

// --- GET /api/patient ---

test('lookup: found, asks EMR with its token, the user and the padded HN; returns only hn + name', async () => {
  const stub = stubFetch({ emr: FOUND });
  const result = await ask({}, stub);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, patient: { hn: '000123456', fullName: 'นายทดสอบ ระบบ' } });
  assert.equal(stub.calls[0].url, 'https://emr.test/api/yata/patient?hn=001234567');
  assert.equal(stub.calls[0].headers.Authorization, 'Bearer emr-token');
  assert.equal(stub.calls[0].headers['X-Yata-User'], 'pha01');
});

test('lookup: no session, an expired one or a forged one is 401 relogin and never reaches EMR', async () => {
  const stub = stubFetch({ emr: FOUND });
  const expired = `Bearer ${issueSession('pha01', SECRET, NOW - SESSION_TTL_MS - 1).token}`;
  for (const authorization of [undefined, 'Bearer nope', expired, `Bearer ${issueSession('pha01', 'x'.repeat(40), NOW).token}`, 'Bearer emr-token']) {
    const result = await ask({ authorization }, stub);
    assert.equal(result.status, 401);
    assert.equal(result.body.relogin, true);
  }
  assert.equal(stub.calls.length, 0);
});

test('lookup: an HN that is not 7–9 digits is refused without asking EMR', async () => {
  const stub = stubFetch({ emr: FOUND });
  for (const hn of ['123', '1234567890', '', null]) assert.equal((await ask({ hn }, stub)).body.ok, false);
  assert.equal(stub.calls.length, 0);
  assert.equal(normalizeHn('12-34567'), '001234567');
});

test('lookup: EMR 404 with its own body is "not found"; everything else is a failure', async () => {
  const notFound = await ask({}, stubFetch({ emr: json(404, { ok: false, message: 'x' }) }));
  assert.deepEqual([notFound.status, notFound.body.ok, notFound.body.failure], [200, false, undefined]);
  const bare404 = { status: 404, json: async () => { throw new Error('not json'); } };
  for (const emr of [json(401, {}), json(429, {}), json(502, { ok: false }), bare404, json(200, { ok: true }), new Error('timeout')]) {
    const result = await ask({}, stubFetch({ emr }));
    assert.deepEqual([result.status, result.body.ok, result.body.failure], [200, false, true]);
  }
});

test('lookup: a session with under 6 hours left is renewed only while the user is active with the same password', async () => {
  const fresh = await ask();
  assert.equal(fresh.body.session, undefined);
  const later = NOW + SESSION_TTL_MS - SESSION_RENEW_BELOW_MS + 1;
  const authorization = `Bearer ${issueSession('pha01', SECRET, NOW, passwordVersion('secret1', SECRET)).token}`;
  const at = (firestore) => ask({ now: later, authorization }, stubFetch({ emr: FOUND, firestore }));

  const result = await at(userDoc({ password: 'secret1', active: true }));
  const renewed = verifySession(result.body.session.token, SECRET, later);
  assert.equal(renewed.expiresAt, later + SESSION_TTL_MS);
  assert.equal(renewed.version, passwordVersion('secret1', SECRET));

  for (const firestore of [
    userDoc({ password: 'secret1', active: false }), userDoc({ password: 'changed', active: true }),
    json(404, {}), new Error('network'),
  ]) {
    const refused = await at(firestore);
    assert.equal(refused.body.ok, true); // the lookup itself still answers until the session runs out
    assert.equal(refused.body.session, undefined);
  }
  // A session with no password fingerprint is never renewed.
  assert.equal((await ask({ now: later }, stubFetch({ emr: FOUND, firestore: userDoc({ password: 'secret1' }) }))).body.session, undefined);
});

test('lookup: only GET', async () => {
  assert.equal((await ask({ method: 'POST' })).status, 405);
});
