import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCachedResource, loadCachedResource, setCachedResource, invalidateCachedResource } from '../lib/resourceCache';
import type { Prep } from '../types';

// Cache key สำหรับ all preps (ใช้ใน HistoryPage)
const PREPS_ALL_CACHE_KEY = 'preps';

// Normalize any date value to "YYYY-MM-DD", handling legacy UTC ISO strings from migrated data.
function toDateOnly(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;          // already YYYY-MM-DD ✓
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA'); // → YYYY-MM-DD (local tz)
  return s.substring(0, 10);                               // best-effort fallback
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
    date: toDateOnly(r.date),           // ← normalized YYYY-MM-DD
    expiry_date: toDateOnly(r.expiry_date), // ← normalized YYYY-MM-DD
    qty: Number(r.qty),
    note: String(r.note ?? ''),
    prepared_by: String(r.prepared_by ?? ''),
    user_pha_id: r.user_pha_id != null ? String(r.user_pha_id) : undefined,
    location: String(r.location ?? ''),
    chemical_lot_no: r.chemical_lot_no != null ? String(r.chemical_lot_no) : undefined,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
  };
}

/**
 * usePreps(startDate?, endDate?)
 *
 * - ไม่ส่ง args  → โหลดข้อมูลทั้งหมด (HistoryPage)
 * - ส่ง startDate/endDate → query เฉพาะช่วงที่ต้องการจาก Firestore (DashboardPage)
 *
 * Optimistic updates: create/update/delete อัปเดต local state ทันที
 * ไม่ต้อง refetch ทั้งหมดหลังทำ mutation
 */
export function usePreps(startDate?: string, endDate?: string) {
  // Cache key แยกตาม scope: monthly key สำหรับ Dashboard, 'preps' สำหรับ History
  const cacheKey = startDate ? `preps-${startDate.slice(0, 7)}` : PREPS_ALL_CACHE_KEY;

  const [preps, setPreps] = useState<Prep[]>(() => getCachedResource<Prep[]>(cacheKey) ?? []);
  const [loading, setLoading] = useState(preps.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPreps = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (preps.length === 0) setLoading(true);
    try {
      const mapped = await loadCachedResource(cacheKey, async () => {
        const data = await api.getPreps(startDate, endDate);
        return data.map(toPrep).sort((a, b) => b.id - a.id);
      }, { force });
      setPreps(mapped);
    } catch (e) {
      console.error('fetchPreps error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preps.length, cacheKey, startDate, endDate]);

  useEffect(() => { fetchPreps(); }, [fetchPreps]);

  // --- Optimistic create ---
  // คืนค่า true เมื่อสำเร็จ หรือ string (ข้อความ error) เมื่อล้มเหลว
  const createPrep = async (p: Omit<Prep, 'id' | 'created_at'>): Promise<true | string> => {
    const res = await api.createPrep(p);
    if (res.success && res.id) {
      const newPrep: Prep = { ...p, id: res.id, created_at: new Date().toISOString() };
      setPreps(prev => {
        const next = [newPrep, ...prev];
        setCachedResource(cacheKey, next);
        // ถ้าใช้ monthly cache ให้ invalidate all-cache ด้วย เพื่อให้ History โหลดใหม่
        if (cacheKey !== PREPS_ALL_CACHE_KEY) invalidateCachedResource(PREPS_ALL_CACHE_KEY);
        return next;
      });
      return true;
    }
    // ส่งคืน error message จากฐานข้อมูล (ถ้ามี) เพื่อแสดงใน toast
    return res.error ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  };

  // --- Optimistic update ---
  const updatePrep = async (id: number, p: Partial<Prep>): Promise<boolean> => {
    const res = await api.updatePrep(id, p);
    if (res.success) {
      setPreps(prev => {
        const next = prev.map(x => x.id === id ? { ...x, ...p } : x);
        setCachedResource(cacheKey, next);
        if (cacheKey !== PREPS_ALL_CACHE_KEY) invalidateCachedResource(PREPS_ALL_CACHE_KEY);
        return next;
      });
      return true;
    }
    return false;
  };

  // --- Optimistic delete ---
  const deletePrep = async (id: number): Promise<boolean> => {
    const res = await api.deletePrep(id);
    if (res.success) {
      setPreps(prev => {
        const next = prev.filter(x => x.id !== id);
        setCachedResource(cacheKey, next);
        if (cacheKey !== PREPS_ALL_CACHE_KEY) invalidateCachedResource(PREPS_ALL_CACHE_KEY);
        return next;
      });
      return true;
    }
    return false;
  };

  return { preps, loading, refreshing, fetchPreps, createPrep, updatePrep, deletePrep };
}
