const GAS_URL = import.meta.env.VITE_GAS_URL?.trim();

interface OkResult {
  success?: boolean;
  id?: number;
  error?: string;
}

function getGasUrl(): string {
  if (!GAS_URL) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_GAS_URL สำหรับเชื่อมต่อ Google Apps Script');
  }

  return GAS_URL;
}

export function getApiErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

async function gasGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(getGasUrl());
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(`ไม่สามารถเชื่อมต่อ Google Apps Script ได้: ${getApiErrorMessage(error)}`);
  }

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Google Apps Script ตอบกลับผิดพลาด (${res.status})`);
  }

  try {
    const json = JSON.parse(rawText) as T;
    if (import.meta.env.DEV) {
      console.log('[GAS]', params.action, json);
    }
    return json;
  } catch (error) {
    throw new Error(`Google Apps Script ส่งข้อมูลไม่ถูกต้อง: ${getApiErrorMessage(error, rawText)}`);
  }
}

async function withErrorResult<T extends { error?: string }>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    return { error: getApiErrorMessage(error) } as T;
  }
}

export const api = {
  ping: () =>
    gasGet<{ ok: boolean; users: number; spreadsheet_id?: string; spreadsheet_url?: string }>({ action: 'ping' }),

  debug: () =>
    gasGet<Record<string, unknown>>({ action: 'debug' }),

  login: (pha_id: string, password: string) =>
    withErrorResult(gasGet<{ data?: Record<string, unknown>; error?: string }>({
      action: 'login',
      pha_id: pha_id.trim().toLowerCase(),
      password,
    })),

  getUserById: (id: number) =>
    withErrorResult(gasGet<{ data?: Record<string, unknown>; error?: string }>({
      action: 'getUserById',
      id: String(id),
    })),

  getUsers: () =>
    gasGet<Record<string, unknown>[]>({ action: 'getUsers' }),

  createUser: (data: object) =>
    withErrorResult(gasGet<OkResult>({ action: 'createUser', data: JSON.stringify(data) })),

  updateUser: (id: number, data: object) =>
    withErrorResult(gasGet<OkResult>({ action: 'updateUser', id: String(id), data: JSON.stringify(data) })),

  deleteUser: (id: number) =>
    withErrorResult(gasGet<OkResult>({ action: 'deleteUser', id: String(id) })),

  getFormulas: () =>
    gasGet<Record<string, unknown>[]>({ action: 'getFormulas' }),

  createFormula: (data: object) =>
    withErrorResult(gasGet<OkResult>({ action: 'createFormula', data: JSON.stringify(data) })),

  updateFormula: (id: number, data: object) =>
    withErrorResult(gasGet<OkResult>({ action: 'updateFormula', id: String(id), data: JSON.stringify(data) })),

  deleteFormula: (id: number) =>
    withErrorResult(gasGet<OkResult>({ action: 'deleteFormula', id: String(id) })),

  getPreps: () =>
    gasGet<Record<string, unknown>[]>({ action: 'getPreps' }),

  createPrep: (data: object) =>
    withErrorResult(gasGet<OkResult>({ action: 'createPrep', data: JSON.stringify(data) })),

  updatePrep: (id: number, data: object) =>
    withErrorResult(gasGet<OkResult>({ action: 'updatePrep', id: String(id), data: JSON.stringify(data) })),

  deletePrep: (id: number) =>
    withErrorResult(gasGet<OkResult>({ action: 'deletePrep', id: String(id) })),
};
