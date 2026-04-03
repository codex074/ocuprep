import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { loadCachedResource } from '../lib/resourceCache';
import type { Formula, Prep } from '../types';

const FORMULAS_CACHE_KEY = 'formulas';
const PREPS_CACHE_KEY = 'preps';

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

function toPrep(r: Record<string, unknown>): Prep {
  return {
    id: Number(r.id),
    formula_id: Number(r.formula_id),
    formula_name: String(r.formula_name ?? ''),
    concentration: r.concentration != null ? String(r.concentration) : null,
    mode: (r.mode as 'patient' | 'stock') ?? 'patient',
    target: String(r.target ?? ''),
    hn: String(r.hn ?? ''),
    patient_name: String(r.patient_name ?? ''),
    dest_room: String(r.dest_room ?? ''),
    lot_no: String(r.lot_no ?? ''),
    date: String(r.date ?? ''),
    expiry_date: String(r.expiry_date ?? ''),
    qty: Number(r.qty),
    note: String(r.note ?? ''),
    prepared_by: String(r.prepared_by ?? ''),
    user_pha_id: r.user_pha_id != null ? String(r.user_pha_id) : undefined,
    location: String(r.location ?? ''),
    created_at: r.created_at != null ? String(r.created_at) : undefined,
  };
}

export function useAppWarmup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.must_change_password) return;

    void Promise.allSettled([
      loadCachedResource(FORMULAS_CACHE_KEY, async () => {
        const data = await api.getFormulas();
        return data.map(toFormula).sort((a, b) => a.id - b.id);
      }),
      loadCachedResource(PREPS_CACHE_KEY, async () => {
        const data = await api.getPreps();
        return data.map(toPrep).sort((a, b) => b.id - a.id);
      }),
    ]);
  }, [user]);
}
