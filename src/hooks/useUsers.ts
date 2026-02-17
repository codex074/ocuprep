import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });
    if (!error && data) setUsers(data as User[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async (u: Omit<User, 'id' | 'created_at'>): Promise<string | null> => {
    const exists = users.find(x => x.pha_id === u.pha_id);
    if (exists) return 'รหัสนี้มีอยู่แล้ว';
    const { error } = await supabase.from('users').insert(u);
    if (!error) { await fetchUsers(); return null; }
    return error.message;
  };

  const toggleUser = async (id: number): Promise<boolean> => {
    const u = users.find(x => x.id === id);
    if (!u) return false;
    const { error } = await supabase.from('users').update({ active: !u.active }).eq('id', id);
    if (!error) { await fetchUsers(); return true; }
    return false;
  };

  const deleteUser = async (id: number): Promise<boolean> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) { await fetchUsers(); return true; }
    return false;
  };

  const updateUser = async (id: number, updates: Partial<User>): Promise<boolean> => {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (!error) { await fetchUsers(); return true; }
    return false;
  };

  return { users, loading, fetchUsers, createUser, updateUser, toggleUser, deleteUser };
}
