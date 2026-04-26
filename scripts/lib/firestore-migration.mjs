import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const GAS_COLLECTION_ACTIONS = {
  users: 'getUsers',
  formulas: 'getFormulas',
  preps: 'getPreps',
};

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

export async function loadGasUrl() {
  if (process.env.VITE_GAS_URL?.trim()) {
    return process.env.VITE_GAS_URL.trim();
  }

  for (const candidate of ['.env', '.env.production']) {
    try {
      const content = await fs.readFile(path.join(projectRoot, candidate), 'utf8');
      const env = parseEnv(content);
      if (env.VITE_GAS_URL?.trim()) {
        return env.VITE_GAS_URL.trim();
      }
    } catch {
      // ignore missing env file
    }
  }

  throw new Error('Missing VITE_GAS_URL in environment or .env/.env.production');
}

export async function gasGet(action) {
  const gasUrl = await loadGasUrl();
  const url = new URL(gasUrl);
  url.searchParams.set('action', action);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GAS request failed for ${action}: HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeDateString(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stripUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function normalizeFormulaCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeUserPhaId(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizePrepLotId(value) {
  return String(value ?? '').trim().toUpperCase().replace(/^LOT-/, '');
}

export function normalizeUser(item) {
  return stripUndefined({
    id: toNumber(item.id),
    name: String(item.name ?? ''),
    pha_id: String(item.pha_id ?? '').trim().toLowerCase(),
    password: String(item.password ?? ''),
    role: item.role === 'admin' ? 'admin' : 'user',
    active: item.active === true || item.active === 'TRUE',
    must_change_password: item.must_change_password === true || item.must_change_password === 'TRUE',
    profile_image: item.profile_image ? String(item.profile_image) : undefined,
    created_at: item.created_at ? normalizeDateString(item.created_at) : new Date().toISOString(),
  });
}

export function normalizeFormula(item) {
  return stripUndefined({
    id: toNumber(item.id),
    code: item.code ? normalizeFormulaCode(item.code) : undefined,
    name: String(item.name ?? ''),
    short_name: item.short_name ? String(item.short_name) : undefined,
    description: item.description != null && item.description !== '' ? String(item.description) : null,
    concentration: item.concentration != null && item.concentration !== '' ? String(item.concentration) : null,
    expiry_days: toNumber(item.expiry_days, 7),
    category: item.category != null && item.category !== '' ? String(item.category) : null,
    price: toNumber(item.price),
    storage: item.storage ? String(item.storage) : undefined,
    ingredients: item.ingredients != null && item.ingredients !== '' ? String(item.ingredients) : null,
    method: item.method != null && item.method !== '' ? String(item.method) : null,
    short_prep: item.short_prep != null && item.short_prep !== '' ? String(item.short_prep) : null,
    package_size: item.package_size ? String(item.package_size) : undefined,
    created_at: item.created_at ? normalizeDateString(item.created_at) : new Date().toISOString(),
  });
}

export function normalizePrep(item) {
  return stripUndefined({
    id: toNumber(item.id),
    formula_id: toNumber(item.formula_id),
    formula_name: String(item.formula_name ?? ''),
    concentration: item.concentration != null && item.concentration !== '' ? String(item.concentration) : null,
    mode: item.mode === 'stock' ? 'stock' : 'patient',
    target: String(item.target ?? ''),
    hn: String(item.hn ?? ''),
    patient_name: String(item.patient_name ?? ''),
    dest_room: String(item.dest_room ?? ''),
    lot_no: String(item.lot_no ?? ''),
    date: item.date ? String(item.date).slice(0, 10) : '',
    expiry_date: item.expiry_date ? String(item.expiry_date) : '',
    qty: toNumber(item.qty, 1),
    note: String(item.note ?? ''),
    prepared_by: String(item.prepared_by ?? ''),
    user_pha_id: item.user_pha_id ? String(item.user_pha_id) : undefined,
    location: String(item.location ?? ''),
    created_at: item.created_at ? normalizeDateString(item.created_at) : new Date().toISOString(),
  });
}

const NORMALIZERS = {
  users: normalizeUser,
  formulas: normalizeFormula,
  preps: normalizePrep,
};

export async function fetchSourceCollection(name) {
  const action = GAS_COLLECTION_ACTIONS[name];
  if (!action) throw new Error(`Unsupported collection: ${name}`);
  const data = await gasGet(action);
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected GAS payload for ${name}`);
  }
  return data.map((item) => NORMALIZERS[name](item)).filter((item) => item.id > 0);
}

async function syncCounter(name, maxId) {
  const countersRef = doc(db, 'meta', 'counters');
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(countersRef);
    const current = Number(snapshot.data()?.[name] ?? 0);
    if (maxId > current) {
      transaction.set(countersRef, { [name]: maxId }, { merge: true });
    } else if (!snapshot.exists()) {
      transaction.set(countersRef, { [name]: current }, { merge: true });
    }
  });
}

export async function writeCollection(name, records) {
  const chunkSize = 400;
  for (let start = 0; start < records.length; start += chunkSize) {
    const batch = writeBatch(db);
    const chunk = records.slice(start, start + chunkSize);
    for (const record of chunk) {
      const docId = name === 'formulas'
        ? normalizeFormulaCode(record.code) || String(record.id)
        : name === 'users'
          ? normalizeUserPhaId(record.pha_id) || String(record.id)
          : name === 'preps'
            ? normalizePrepLotId(record.lot_no) || String(record.id)
            : String(record.id);
      batch.set(doc(collection(db, name), docId), record, { merge: true });
      if ((name === 'formulas' || name === 'users' || name === 'preps') && String(record.id) !== docId) {
        batch.delete(doc(collection(db, name), String(record.id)));
      }
    }
    await batch.commit();
  }

  if (name === 'formulas' || name === 'users' || name === 'preps') {
    const legacySnapshot = await getDocs(collection(db, name));
    for (const entry of legacySnapshot.docs) {
      const data = entry.data();
      const expectedId = name === 'formulas'
        ? normalizeFormulaCode(data.code) || String(data.id ?? '')
        : name === 'users'
          ? normalizeUserPhaId(data.pha_id) || String(data.id ?? '')
          : normalizePrepLotId(data.lot_no) || String(data.id ?? '');
      if (expectedId && entry.id !== expectedId) {
        await deleteDoc(entry.ref);
      }
    }
  }

  const maxId = records.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0);
  await syncCounter(name, maxId);

  return { count: records.length, maxId };
}

export async function migrateCollections(names) {
  const summary = {};

  for (const name of names) {
    const records = await fetchSourceCollection(name);
    const result = await writeCollection(name, records);
    summary[name] = result;
  }

  return summary;
}
