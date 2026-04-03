const GAS_URL = import.meta.env.VITE_GAS_URL as string;

type GasResult<T> = T;

async function gasGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`GAS GET failed: ${res.status}`);
  return res.json() as Promise<GasResult<T>>;
}

async function gasPost<T>(body: object): Promise<T> {
  // ไม่ set Content-Type เพื่อหลีก CORS preflight (browser จะส่ง text/plain)
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`GAS POST failed: ${res.status}`);
  return res.json() as Promise<GasResult<T>>;
}

interface OkResult { success: boolean; id?: number }
interface ErrResult { error: string }

export const api = {
  // ---- Auth ----
  login: (pha_id: string, password: string) =>
    gasPost<{ data?: Record<string, unknown>; error?: string }>({ action: 'login', data: { pha_id, password } }),

  getUserById: (id: number) =>
    gasPost<{ data?: Record<string, unknown>; error?: string }>({ action: 'getUserById', id }),

  // ---- Users ----
  getUsers: () => gasGet<Record<string, unknown>[]>({ action: 'getUsers' }),
  createUser: (data: object) => gasPost<OkResult & ErrResult>({ action: 'createUser', data }),
  updateUser: (id: number, data: object) => gasPost<OkResult & ErrResult>({ action: 'updateUser', id, data }),
  deleteUser: (id: number) => gasPost<OkResult & ErrResult>({ action: 'deleteUser', id }),

  // ---- Formulas ----
  getFormulas: () => gasGet<Record<string, unknown>[]>({ action: 'getFormulas' }),
  createFormula: (data: object) => gasPost<OkResult & ErrResult>({ action: 'createFormula', data }),
  updateFormula: (id: number, data: object) => gasPost<OkResult & ErrResult>({ action: 'updateFormula', id, data }),
  deleteFormula: (id: number) => gasPost<OkResult & ErrResult>({ action: 'deleteFormula', id }),

  // ---- Health / Init ----
  ping: () => gasGet<{ ok: boolean; initialized: boolean }>({ action: 'ping' }),

  // ---- Preps ----
  getPreps: () => gasGet<Record<string, unknown>[]>({ action: 'getPreps' }),
  createPrep: (data: object) => gasPost<OkResult & ErrResult>({ action: 'createPrep', data }),
  updatePrep: (id: number, data: object) => gasPost<OkResult & ErrResult>({ action: 'updatePrep', id, data }),
  deletePrep: (id: number) => gasPost<OkResult & ErrResult>({ action: 'deletePrep', id }),
};
