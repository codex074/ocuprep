import fs from 'node:fs/promises';

const gasUrl = process.env.VITE_GAS_URL;
const sourceFile = process.argv[2] || 'formular.json';

if (!gasUrl) {
  throw new Error('Missing VITE_GAS_URL');
}

const CATEGORY_MAP = {
  antibiotic: 'antibiotic',
  antifungal: 'antifungal',
  steroid: 'steroid',
  lubricant: 'lubricant',
  other: 'other',
};

function normalizeCategory(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return CATEGORY_MAP[key] || 'other';
}

function normalizeFormula(item) {
  const expiryUnit = String(item.expiry_unit ?? 'days').trim().toLowerCase();
  let expiryDays = Number(item.expiry_days ?? 7);
  if (!Number.isFinite(expiryDays) || expiryDays <= 0) expiryDays = 7;
  if (expiryUnit === 'hours') expiryDays = -Math.abs(expiryDays);

  const ingredients = Array.isArray(item.ingredients)
    ? item.ingredients
        .filter((entry) => entry && String(entry.name ?? '').trim())
        .map((entry) => ({
          name: String(entry.name ?? '').trim(),
          amount: String(entry.amount ?? '').trim(),
        }))
    : [];

  const method = Array.isArray(item.method)
    ? item.method.map((step) => String(step ?? '').trim()).filter(Boolean)
    : [];

  return {
    code: String(item.code ?? '').trim(),
    name: String(item.name ?? '').trim(),
    short_name: String(item.short_name ?? '').trim(),
    description: String(item.description ?? '').trim(),
    concentration: String(item.concentration ?? '').trim(),
    expiry_days: expiryDays,
    price: Number(item.price ?? 0) || 0,
    category: normalizeCategory(item.category),
    storage: String(item.storage ?? '').trim(),
    ingredients: JSON.stringify(ingredients),
    method: JSON.stringify(method),
    short_prep: String(item.short_prep ?? '').trim(),
    package_size: String(item.package_size ?? '').trim(),
  };
}

async function gasGet(params) {
  const url = new URL(gasUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

const source = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
if (!Array.isArray(source)) {
  throw new Error('Source JSON must be an array');
}

const existing = await gasGet({ action: 'getFormulas' });
const byCode = new Map(
  existing
    .filter((item) => item && item.code)
    .map((item) => [String(item.code).trim().toLowerCase(), item]),
);

let created = 0;
let updated = 0;
let skipped = 0;

for (const raw of source) {
  const formula = normalizeFormula(raw);
  if (!formula.name) {
    skipped += 1;
    continue;
  }

  const existingItem = formula.code ? byCode.get(formula.code.toLowerCase()) : null;

  if (existingItem?.id != null) {
    const result = await gasGet({
      action: 'updateFormula',
      id: String(existingItem.id),
      data: JSON.stringify(formula),
    });

    if (result?.success) updated += 1;
    else throw new Error(`Update failed for ${formula.code || formula.name}: ${result?.error || 'unknown error'}`);
    continue;
  }

  const result = await gasGet({
    action: 'createFormula',
    data: JSON.stringify(formula),
  });

  if (result?.success) created += 1;
  else throw new Error(`Create failed for ${formula.code || formula.name}: ${result?.error || 'unknown error'}`);
}

console.log(JSON.stringify({ source: source.length, created, updated, skipped }, null, 2));
