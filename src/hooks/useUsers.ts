import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

function toUser(r: Record<string, unknown>): User {
  return {
    id: Number(r.id),
    name: String(r.name ?? ''),
    pha_id: String(r.pha_id ?? ''),
    password: String(r.password ?? ''),
    role: (r.role as 'admin' | 'user') ?? 'user',
    active: r.active === true || r.active === 'TRUE',
    must_change_password: r.must_change_password === true || r.must_change_password === 'TRUE',
    profile_image: r.profile_image != null && r.profile_image !== '' ? String(r.profile_image) : undefined,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
  };
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data.map(toUser).sort((a, b) => a.id - b.id));
    } catch (e) {
      console.error('fetchUsers error', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async (u: Omit<User, 'id' | 'created_at'>): Promise<string | null> => {
    const exists = users.find(x => x.pha_id === u.pha_id);
    if (exists) return 'รหัสนี้มีอยู่แล้ว';
    const res = await api.createUser({ ...u, must_change_password: true });
    if (res.success) { await fetchUsers(); return null; }
    return res.error ?? 'เกิดข้อผิดพลาด';
  };

  const toggleUser = async (id: number): Promise<boolean> => {
    const u = users.find(x => x.id === id);
    if (!u) return false;
    const res = await api.updateUser(id, { active: !u.active });
    if (res.success) { await fetchUsers(); return true; }
    return false;
  };

  const deleteUser = async (id: number): Promise<boolean> => {
    const res = await api.deleteUser(id);
    if (res.success) { await fetchUsers(); return true; }
    return false;
  };

  const updateUser = async (id: number, updates: Partial<User>): Promise<boolean> => {
    const res = await api.updateUser(id, updates);
    if (res.success) { await fetchUsers(); return true; }
    return false;
  };

  return { users, loading, fetchUsers, createUser, updateUser, toggleUser, deleteUser };
}
