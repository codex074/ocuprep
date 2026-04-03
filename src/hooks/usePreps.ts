import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCachedResource, loadCachedResource } from '../lib/resourceCache';
import type { Prep } from '../types';

const PREPS_CACHE_KEY = 'preps';

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

export function usePreps() {
  const [preps, setPreps] = useState<Prep[]>(() => getCachedResource<Prep[]>(PREPS_CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(preps.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPreps = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (preps.length === 0) setLoading(true);
    try {
      const mapped = await loadCachedResource(PREPS_CACHE_KEY, async () => {
        const data = await api.getPreps();
        return data.map(toPrep).sort((a, b) => b.id - a.id);
      }, { force });
      setPreps(mapped);
    } catch (e) {
      console.error('fetchPreps error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preps.length]);

  useEffect(() => { fetchPreps(); }, [fetchPreps]);

  const createPrep = async (p: Omit<Prep, 'id' | 'created_at'>): Promise<boolean> => {
    const res = await api.createPrep(p);
    if (res.success) { await fetchPreps(true); return true; }
    return false;
  };

  const updatePrep = async (id: number, p: Partial<Prep>): Promise<boolean> => {
    const res = await api.updatePrep(id, p);
    if (res.success) { await fetchPreps(true); return true; }
    return false;
  };

  const deletePrep = async (id: number): Promise<boolean> => {
    const res = await api.deletePrep(id);
    if (res.success) { await fetchPreps(true); return true; }
    return false;
  };

  return { preps, loading, refreshing, fetchPreps, createPrep, updatePrep, deletePrep };
}
