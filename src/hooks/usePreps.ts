import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Prep } from '../types';

export function usePreps() {
  const [preps, setPreps] = useState<Prep[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPreps = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('preps')
      .select('*')
      .order('id', { ascending: false });
    if (!error && data) setPreps(data as Prep[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPreps(); }, [fetchPreps]);

  const createPrep = async (p: Omit<Prep, 'id' | 'created_at'>): Promise<boolean> => {
    const { error } = await supabase.from('preps').insert(p);
    if (!error) { await fetchPreps(); return true; }
    return false;
  };

  const updatePrep = async (id: number, p: Partial<Prep>): Promise<boolean> => {
    const { error } = await supabase.from('preps').update(p).eq('id', id);
    if (!error) { await fetchPreps(); return true; }
    return false;
  };

  const deletePrep = async (id: number): Promise<boolean> => {
    const { error } = await supabase.from('preps').delete().eq('id', id);
    if (!error) { await fetchPreps(); return true; }
    return false;
  };

  return { preps, loading, fetchPreps, createPrep, updatePrep, deletePrep };
}
