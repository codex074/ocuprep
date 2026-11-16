// Patient-name lookup by HN, through the Vercel functions in /api (see api/_lib/lookupCore.js).
//
// The functions accept only a lookup session, which `startLookupSession` gets at login by proving the same
// pha_id + password. The session lives in its own localStorage key: AuthContext rewrites `ed-extemp-session`
// on every activity tick, so anything stored inside it would be lost.

const LOOKUP_SESSION_KEY = 'yata-lookup-session';
const REQUEST_TIMEOUT_MS = 10000;

/** Empty = same origin (the Vercel site). GitHub Pages and the desktop app need the full Vercel URL at build time. */
const LOOKUP_BASE_URL = String(import.meta.env.VITE_LOOKUP_BASE_URL ?? '').trim().replace(/\/+$/, '');

interface StoredSession { token: string; expiresAt: number }

function readSession(): StoredSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOOKUP_SESSION_KEY) ?? 'null') as Partial<StoredSession> | null;
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return parsed.expiresAt > Date.now() ? { token: parsed.token, expiresAt: parsed.expiresAt } : null;
  } catch {
    return null;
  }
}

function writeSession(session: unknown) {
  const s = session as Partial<StoredSession> | null | undefined;
  if (!s || typeof s.token !== 'string' || typeof s.expiresAt !== 'number') return;
  try {
    localStorage.setItem(LOOKUP_SESSION_KEY, JSON.stringify({ token: s.token, expiresAt: s.expiresAt }));
  } catch { /* storage full or blocked: lookup will ask the user to sign in again */ }
}

export function clearLookupSession() {
  try { localStorage.removeItem(LOOKUP_SESSION_KEY); } catch { /* nothing to clear */ }
}

/** Called right after a successful login. Never throws and never blocks the login: lookup is optional. */
export async function startLookupSession(phaId: string, password: string): Promise<void> {
  clearLookupSession();
  try {
    const res = await fetch(`${LOOKUP_BASE_URL}/api/lookup-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pha_id: phaId, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return;
    writeSession(await res.json());
  } catch { /* offline or not deployed: the lookup button will say so */ }
}

export type PatientLookupResult =
  | { status: 'found'; fullName: string }
  /** HOSxP has no such HN. */
  | { status: 'notfound' }
  /** No usable lookup session: signing in again gets one. */
  | { status: 'relogin' }
  /** Could not get an answer (network, lookup service down). */
  | { status: 'offline' };

export async function lookupPatientName(hn: string): Promise<PatientLookupResult> {
  const session = readSession();
  if (!session) return { status: 'relogin' };
  try {
    const res = await fetch(`${LOOKUP_BASE_URL}/api/patient?hn=${encodeURIComponent(hn)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 401) {
      clearLookupSession();
      return { status: 'relogin' };
    }
    if (!res.ok) return { status: 'offline' };
    const data = await res.json() as {
      ok?: boolean; failure?: boolean; patient?: { fullName?: string }; session?: unknown;
    };
    writeSession(data.session);
    if (data.ok && data.patient?.fullName) return { status: 'found', fullName: data.patient.fullName };
    return { status: data.failure ? 'offline' : 'notfound' };
  } catch {
    return { status: 'offline' };
  }
}
