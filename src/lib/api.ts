import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

interface OkResult {
  success?: boolean;
  id?: number;
  error?: string;
}

type CollectionName = 'users' | 'formulas' | 'preps';
type FirestoreRecord = Record<string, unknown>;

const countersRef = doc(db, 'meta', 'counters');

function collectionRef(name: CollectionName) {
  return collection(db, name);
}

function documentRef(name: CollectionName, id: number | string) {
  return doc(db, name, String(id));
}

function normalizeUserPhaId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeFormulaCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizePrepLotId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^LOT-/, '');
}

function toRecord(data: FirestoreRecord | undefined, fallbackId?: string): FirestoreRecord {
  if (!data) return {};
  const next = { ...data };
  if ((next.id === undefined || next.id === null) && fallbackId) {
    next.id = Number(fallbackId);
  }
  return next;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

async function getCollectionRecords(name: CollectionName): Promise<FirestoreRecord[]> {
  const snapshot = await getDocs(collectionRef(name));
  return snapshot.docs.map((entry) => toRecord(entry.data() as FirestoreRecord, entry.id));
}

async function getPrepRecords(startDate?: string, endDate?: string): Promise<FirestoreRecord[]> {
  if (!startDate && !endDate) {
    return getCollectionRecords('preps');
  }

  const constraints = [];
  if (startDate) constraints.push(where('date', '>=', startDate));
  if (endDate) constraints.push(where('date', '<=', endDate));
  const snapshot = await getDocs(query(collectionRef('preps'), ...constraints));
  return snapshot.docs.map((entry) => toRecord(entry.data() as FirestoreRecord, entry.id));
}

async function allocateId(name: CollectionName): Promise<number> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(countersRef);
    const counters = (snapshot.data() ?? {}) as Record<string, unknown>;
    const current = Number(counters[name] ?? 0);
    const next = current + 1;
    transaction.set(countersRef, { [name]: next }, { merge: true });
    return next;
  });
}

async function ensureUniquePhaId(phaId: string, excludeId?: number): Promise<void> {
  const normalized = normalizeUserPhaId(phaId);
  if (!normalized) {
    throw new Error('กรุณากรอก Username');
  }

  const snapshot = await getDoc(documentRef('users', normalized));
  if (!snapshot.exists()) return;

  const existingId = Number((snapshot.data() as FirestoreRecord).id ?? 0);
  if (excludeId != null && existingId === excludeId) {
    return;
  }

  throw new Error('รหัสนี้มีอยู่แล้ว');
}

async function getUserSnapshotByNumericId(id: number) {
  const snapshot = await getDocs(query(collectionRef('users'), where('id', '==', id), limit(1)));
  return snapshot.docs[0] ?? null;
}

async function getFormulaSnapshotByNumericId(id: number) {
  const snapshot = await getDocs(query(collectionRef('formulas'), where('id', '==', id), limit(1)));
  return snapshot.docs[0] ?? null;
}

async function getPrepSnapshotByNumericId(id: number) {
  const snapshot = await getDocs(query(collectionRef('preps'), where('id', '==', id), limit(1)));
  return snapshot.docs[0] ?? null;
}

async function ensureUniqueFormulaCode(code: string, excludeId?: number): Promise<void> {
  const normalized = normalizeFormulaCode(code);
  if (!normalized) {
    throw new Error('กรุณากรอกรหัสสูตร');
  }

  const snapshot = await getDoc(documentRef('formulas', normalized));
  if (!snapshot.exists()) return;

  const existingId = Number((snapshot.data() as FirestoreRecord).id ?? 0);
  if (excludeId != null && existingId === excludeId) {
    return;
  }

  throw new Error('รหัสสูตรนี้มีอยู่แล้ว');
}

async function ensureUniquePrepLotNo(lotNo: string, excludeId?: number): Promise<void> {
  const normalized = normalizePrepLotId(lotNo);
  if (!normalized) {
    throw new Error('กรุณากรอก Lot No.');
  }

  const snapshot = await getDoc(documentRef('preps', normalized));
  if (!snapshot.exists()) return;

  const existingId = Number((snapshot.data() as FirestoreRecord).id ?? 0);
  if (excludeId != null && existingId === excludeId) {
    return;
  }

  throw new Error('Lot No. นี้มีอยู่แล้ว');
}

export function getApiErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

async function withErrorResult<T extends { error?: string }>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    return { error: getApiErrorMessage(error) } as T;
  }
}

export const api = {
  ping: async () => {
    await getDocs(query(collectionRef('users'), limit(1)));
    return { ok: true, users: 0, project_id: 'yata-e56f7' };
  },

  debug: async () => ({
    backend: 'firestore',
    project_id: 'yata-e56f7',
  }),

  login: (pha_id: string, password: string) =>
    withErrorResult((async () => {
      const normalized = normalizeUserPhaId(pha_id);
      const snapshot = await getDoc(documentRef('users', normalized));
      if (!snapshot.exists()) {
        return { error: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      }

      const user = toRecord(snapshot.data() as FirestoreRecord, snapshot.id);
      if (String(user.password ?? '') !== password) {
        return { error: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      }
      if (user.active === false) {
        return { error: 'บัญชีนี้ถูกปิดใช้งาน' };
      }

      return { data: user };
    })()),

  getUserById: (id: number) =>
    withErrorResult((async () => {
      const snapshot = await getUserSnapshotByNumericId(id);
      if (!snapshot || !snapshot.exists()) return { error: 'ไม่พบผู้ใช้งาน' };
      return { data: toRecord(snapshot.data() as FirestoreRecord, snapshot.id) };
    })()),

  getUsers: () =>
    getCollectionRecords('users'),

  createUser: (data: object) =>
    withErrorResult<OkResult>((async () => {
      const payload = stripUndefined(data as FirestoreRecord);
      const phaId = normalizeUserPhaId(payload.pha_id);
      await ensureUniquePhaId(phaId);

      const id = await allocateId('users');
      const record = stripUndefined({
        ...payload,
        id,
        pha_id: phaId,
        created_at: new Date().toISOString(),
      } as FirestoreRecord);

      await setDoc(documentRef('users', phaId), record);
      return { success: true, id };
    })()),

  updateUser: (id: number, data: object) =>
    withErrorResult((async () => {
      const snapshot = await getUserSnapshotByNumericId(id);
      if (!snapshot) {
        return { error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' };
      }

      const existing = toRecord(snapshot.data() as FirestoreRecord, snapshot.id);
      const payload = stripUndefined(data as FirestoreRecord);
      const nextPhaId = normalizeUserPhaId(payload.pha_id ?? existing.pha_id);
      await ensureUniquePhaId(nextPhaId, id);

      const nextRecord = stripUndefined({
        ...existing,
        ...payload,
        pha_id: nextPhaId,
      } as FirestoreRecord);

      await setDoc(documentRef('users', nextPhaId), nextRecord);
      if (snapshot.id !== nextPhaId) {
        await deleteDoc(snapshot.ref);
      }

      return { success: true };
    })()),

  deleteUser: (id: number) =>
    withErrorResult((async () => {
      const snapshot = await getUserSnapshotByNumericId(id);
      if (!snapshot) return { error: 'ไม่พบข้อมูลที่ต้องการลบ' };
      await deleteDoc(snapshot.ref);
      return { success: true };
    })()),

  getFormulas: () =>
    getCollectionRecords('formulas'),

  createFormula: (data: object) =>
    withErrorResult<OkResult>((async () => {
      const payload = stripUndefined(data as FirestoreRecord);
      const code = normalizeFormulaCode(payload.code);
      await ensureUniqueFormulaCode(code);

      const id = await allocateId('formulas');
      const record = stripUndefined({
        ...payload,
        id,
        code,
        created_at: new Date().toISOString(),
      } as FirestoreRecord);

      await setDoc(documentRef('formulas', code), record);
      return { success: true, id };
    })()),

  updateFormula: (id: number, data: object) =>
    withErrorResult((async () => {
      const snapshot = await getFormulaSnapshotByNumericId(id);
      if (!snapshot) {
        return { error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' };
      }

      const existing = toRecord(snapshot.data() as FirestoreRecord, snapshot.id);
      const payload = stripUndefined(data as FirestoreRecord);
      const nextCode = normalizeFormulaCode(payload.code ?? existing.code);
      await ensureUniqueFormulaCode(nextCode, id);

      const nextRecord = stripUndefined({
        ...existing,
        ...payload,
        code: nextCode,
      } as FirestoreRecord);

      await setDoc(documentRef('formulas', nextCode), nextRecord);
      if (snapshot.id !== nextCode) {
        await deleteDoc(snapshot.ref);
      }

      return { success: true };
    })()),

  deleteFormula: (id: number) =>
    withErrorResult((async () => {
      const snapshot = await getFormulaSnapshotByNumericId(id);
      if (!snapshot) return { error: 'ไม่พบข้อมูลที่ต้องการลบ' };
      await deleteDoc(snapshot.ref);
      return { success: true };
    })()),

  getPreps: (startDate?: string, endDate?: string) =>
    getPrepRecords(startDate, endDate),

  createPrep: (data: object) =>
    withErrorResult<OkResult>((async () => {
      const payload = stripUndefined(data as FirestoreRecord);
      const lotId = normalizePrepLotId(payload.lot_no);
      await ensureUniquePrepLotNo(lotId);

      const id = await allocateId('preps');
      const record = stripUndefined({
        ...payload,
        id,
        created_at: new Date().toISOString(),
      } as FirestoreRecord);

      await setDoc(documentRef('preps', lotId), record);
      return { success: true, id };
    })()),

  updatePrep: (id: number, data: object) =>
    withErrorResult((async () => {
      const snapshot = await getPrepSnapshotByNumericId(id);
      if (!snapshot) {
        return { error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' };
      }

      const existing = toRecord(snapshot.data() as FirestoreRecord, snapshot.id);
      const payload = stripUndefined(data as FirestoreRecord);
      const nextLotId = normalizePrepLotId(payload.lot_no ?? existing.lot_no);
      await ensureUniquePrepLotNo(nextLotId, id);

      const nextRecord = stripUndefined({
        ...existing,
        ...payload,
      } as FirestoreRecord);

      await setDoc(documentRef('preps', nextLotId), nextRecord);
      if (snapshot.id !== nextLotId) {
        await deleteDoc(snapshot.ref);
      }

      return { success: true };
    })()),

  deletePrep: (id: number) =>
    withErrorResult((async () => {
      const snapshot = await getPrepSnapshotByNumericId(id);
      if (!snapshot) return { error: 'ไม่พบข้อมูลที่ต้องการลบ' };
      await deleteDoc(snapshot.ref);
      return { success: true };
    })()),
};
