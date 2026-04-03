import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCachedResource, loadCachedResource } from '../lib/resourceCache';
import type { User } from '../types';

const USERS_CACHE_KEY = 'users';
type UserUpdateInput = Partial<User> & {
  profile_image_upload?: {
    data_url: string;
    file_name?: string;
    mime_type?: string;
  };
};

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
  const [users, setUsers] = useState<User[]>(() => getCachedResource<User[]>(USERS_CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(users.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (users.length === 0) setLoading(true);
    try {
      const mapped = await loadCachedResource(USERS_CACHE_KEY, async () => {
        const data = await api.getUsers();
        return data.map(toUser).sort((a, b) => a.id - b.id);
      }, { force });
      setUsers(mapped);
    } catch (e) {
      console.error('fetchUsers error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [users.length]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async (u: Omit<User, 'id' | 'created_at'>): Promise<string | null> => {
    const normalizedPhaId = u.pha_id.trim().toLowerCase();
    const exists = users.find(x => x.pha_id.trim().toLowerCase() === normalizedPhaId);
    if (exists) return 'รหัสนี้มีอยู่แล้ว';
    const res = await api.createUser({ ...u, pha_id: normalizedPhaId, must_change_password: true });
    if (res.success) { await fetchUsers(true); return null; }
    return res.error ?? 'เกิดข้อผิดพลาด';
  };

  const toggleUser = async (id: number): Promise<boolean> => {
    const u = users.find(x => x.id === id);
    if (!u) return false;
    const res = await api.updateUser(id, { active: !u.active });
    if (res.success) { await fetchUsers(true); return true; }
    return false;
  };

  const deleteUser = async (id: number): Promise<boolean> => {
    const res = await api.deleteUser(id);
    if (res.success) { await fetchUsers(true); return true; }
    return false;
  };

  const updateUser = async (id: number, updates: UserUpdateInput): Promise<boolean> => {
    const res = await api.updateUser(id, updates);
    if (res.success) { await fetchUsers(true); return true; }
    return false;
  };

  return { users, loading, refreshing, fetchUsers, createUser, updateUser, toggleUser, deleteUser };
}
