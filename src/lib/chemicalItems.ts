import type { ChemicalItem } from '../types';

function normalizeDateText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('en-CA');
  return text.substring(0, 10);
}

export function cleanChemicalItems(items: ChemicalItem[]): ChemicalItem[] {
  return items
    .map((item) => ({
      name: item.name.trim(),
      lot_no: item.lot_no.trim(),
      expiry_date: item.expiry_date.trim(),
    }))
    .filter((item) => item.name || item.lot_no || item.expiry_date);
}

export function normalizeChemicalItems(raw: unknown, legacyLot?: unknown, legacyExpiry?: unknown): ChemicalItem[] {
  let source: unknown = raw;
  if (typeof source === 'string' && source.trim()) {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }

  const items = Array.isArray(source)
    ? source
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            name: String(record.name ?? ''),
            lot_no: String(record.lot_no ?? record.lot ?? ''),
            expiry_date: normalizeDateText(record.expiry_date ?? record.exp ?? ''),
          };
        })
        .filter((item): item is ChemicalItem => item !== null)
    : [];

  const cleaned = cleanChemicalItems(items);
  if (cleaned.length > 0) return cleaned;

  const lotNo = String(legacyLot ?? '').trim();
  const expiryDate = normalizeDateText(legacyExpiry).trim();
  return lotNo || expiryDate ? [{ name: '', lot_no: lotNo, expiry_date: expiryDate }] : [];
}

export function chemicalItemsFromIngredients(ingredients: string | null): ChemicalItem[] {
  if (!ingredients) return [{ name: '', lot_no: '', expiry_date: '' }];

  try {
    const parsed = JSON.parse(ingredients);
    if (Array.isArray(parsed)) {
      const names = parsed
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') return String((item as Record<string, unknown>).name ?? '');
          return '';
        })
        .map((name) => name.trim())
        .filter(Boolean);

      if (names.length > 0) {
        return names.map((name) => ({ name, lot_no: '', expiry_date: '' }));
      }
    }
  } catch {
    const names = ingredients
      .split(/\r?\n/)
      .map((name) => name.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
    if (names.length > 0) {
      return names.map((name) => ({ name, lot_no: '', expiry_date: '' }));
    }
  }

  return [{ name: '', lot_no: '', expiry_date: '' }];
}

export function formatChemicalItems(items: ChemicalItem[] | undefined): string {
  const cleaned = cleanChemicalItems(items ?? []);
  if (cleaned.length === 0) return '';
  return cleaned
    .map((item) => {
      const parts = [
        item.name || 'สารเคมี',
        item.lot_no ? `Lot ${item.lot_no}` : '',
        item.expiry_date ? `Exp ${item.expiry_date}` : '',
      ].filter(Boolean);
      return parts.join(' / ');
    })
    .join('; ');
}
