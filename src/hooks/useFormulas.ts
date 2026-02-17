import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Formula } from '../types';

export function useFormulas() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFormulas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('formulas')
      .select('*')
      .order('id', { ascending: true });
    if (!error && data) setFormulas(data as Formula[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFormulas(); }, [fetchFormulas]);

  const createFormula = async (f: Omit<Formula, 'id' | 'created_at'>): Promise<boolean> => {
    const { error } = await supabase.from('formulas').insert(f);
    if (!error) { await fetchFormulas(); return true; }
    return false;
  };

  const updateFormula = async (id: number, f: Partial<Formula>): Promise<boolean> => {
    const { error } = await supabase.from('formulas').update(f).eq('id', id);
    if (error) { console.error('Error updating formula:', error); return false; }
    await fetchFormulas();
    return true;
  };

  const deleteFormula = async (id: number): Promise<boolean> => {
    const { error } = await supabase.from('formulas').delete().eq('id', id);
    if (error) { console.error('Error deleting formula:', error); return false; }
    await fetchFormulas();
    return true;
  };

  return { formulas, loading, fetchFormulas, createFormula, updateFormula, deleteFormula };
}
