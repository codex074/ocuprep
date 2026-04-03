import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCachedResource, loadCachedResource } from '../lib/resourceCache';
import type { Formula } from '../types';

const FORMULAS_CACHE_KEY = 'formulas';

function toFormula(r: Record<string, unknown>): Formula {
  return {
    id: Number(r.id),
    code: r.code != null && r.code !== '' ? String(r.code) : undefined,
    name: String(r.name ?? ''),
    short_name: r.short_name != null && r.short_name !== '' ? String(r.short_name) : undefined,
    description: r.description != null ? String(r.description) : null,
    concentration: r.concentration != null ? String(r.concentration) : null,
    expiry_days: Number(r.expiry_days),
    category: r.category != null ? String(r.category) : null,
    price: Number(r.price),
    storage: r.storage != null && r.storage !== '' ? String(r.storage) : undefined,
    ingredients: r.ingredients != null ? String(r.ingredients) : null,
    method: r.method != null ? String(r.method) : null,
    short_prep: r.short_prep != null && r.short_prep !== '' ? String(r.short_prep) : null,
    package_size: r.package_size != null && r.package_size !== '' ? String(r.package_size) : undefined,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
  };
}

export function useFormulas() {
  const [formulas, setFormulas] = useState<Formula[]>(() => getCachedResource<Formula[]>(FORMULAS_CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(formulas.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFormulas = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (formulas.length === 0) setLoading(true);
    try {
      const mapped = await loadCachedResource(FORMULAS_CACHE_KEY, async () => {
        const data = await api.getFormulas();
        return data.map(toFormula).sort((a, b) => a.id - b.id);
      }, { force });
      setFormulas(mapped);
    } catch (e) {
      console.error('fetchFormulas error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formulas.length]);

  useEffect(() => { fetchFormulas(); }, [fetchFormulas]);

  const createFormula = async (f: Omit<Formula, 'id' | 'created_at'>): Promise<boolean> => {
    const res = await api.createFormula(f);
    if (res.success) { await fetchFormulas(true); return true; }
    return false;
  };

  const updateFormula = async (id: number, f: Partial<Formula>): Promise<boolean> => {
    const res = await api.updateFormula(id, f);
    if (!res.success) { console.error('Error updating formula:', res.error); return false; }
    await fetchFormulas(true);
    return true;
  };

  const deleteFormula = async (id: number): Promise<boolean> => {
    const res = await api.deleteFormula(id);
    if (!res.success) { console.error('Error deleting formula:', res.error); return false; }
    await fetchFormulas(true);
    return true;
  };

  return { formulas, loading, refreshing, fetchFormulas, createFormula, updateFormula, deleteFormula };
}
