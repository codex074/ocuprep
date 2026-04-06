import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtShort, fmtTime } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import EditPrepModal from '../components/EditPrepModal';
import PrepDetailsModal from '../components/PrepDetailsModal';
import SummaryDetailsModal from '../components/SummaryDetailsModal';
import type { Prep } from '../types';
import LoadingState from '../components/ui/LoadingState';
import RefreshButton from '../components/ui/RefreshButton';
import { usePreps } from '../hooks/usePreps';
import { useFormulas } from '../hooks/useFormulas';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

type SlotKey = 'morning' | 'afternoon' | 'overtime';

const SLOTS: { key: SlotKey; label: string; range: string; color: string }[] = [
  { key: 'morning', label: 'เช้า', range: 'จ-ศ 08:30-13:30 น.', color: '#d97706' },
  { key: 'afternoon', label: 'บ่าย', range: 'จ-ศ 13:30-16:30 น.', color: '#2563eb' },
  { key: 'overtime', label: 'นอกเวลา', range: 'เสาร์/อาทิตย์ หรือ นอกเวลาราชการ', color: '#ef4444' },
];

function fmtThaiDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtThaiMonthYear(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

function buildMonthOptions(months: string[], currentMonth: string) {
  const unique = Array.from(new Set(months.filter(Boolean)));
  unique.sort((a, b) => b.localeCompare(a));
  if (!unique.includes(currentMonth)) unique.unshift(currentMonth);
  return unique.map((value) => ({ value, label: fmtThaiMonthYear(value) }));
}

function classifySlot(created_at?: string): SlotKey {
  if (!created_at) return 'overtime';
  const d = new Date(created_at);
  const dow = d.getDay();
  const min = d.getHours() * 60 + d.getMinutes();
  if (dow === 0 || dow === 6) return 'overtime';
  if (min >= 8 * 60 + 30 && min < 13 * 60 + 30) return 'morning';   // 08:30–13:30
  if (min >= 13 * 60 + 30 && min < 16 * 60 + 30) return 'afternoon'; // 13:30–16:30
  return 'overtime';
}

function getMonthDateRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) => d.toLocaleDateString('en-CA');
  return [fmt(start), fmt(end)];
}

export default function DashboardPage() {
  const [editPrep, setEditPrep] = useState<Prep | null>(null);
  const [selectedPrep, setSelectedPrep] = useState<Prep | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const defaultMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [showAllDays, setShowAllDays] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [start, end] = useMemo(() => getMonthDateRange(selectedMonth), [selectedMonth]);
  const { preps: allPreps, fetchPreps: fetchAllPreps } = usePreps();
  const { preps: monthPreps, loading, refreshing, fetchPreps, updatePrep, deletePrep } = usePreps(start, end);
  const { formulas } = useFormulas();

  // lookup: formula_name → short_name (ถ้ามี)
  const shortNameMap = Object.fromEntries(
    formulas.map(f => [f.name, f.short_name ?? f.name])
  );

  const handleUpdate = async (id: number, updates: Partial<Prep>) => {
    const ok = await updatePrep(id, updates);
    if (ok) {
      toast('แก้ไขรายการสำเร็จ', 'success');
      return true;
    }
    toast('เกิดข้อผิดพลาดในการแก้ไข', 'error');
    return false;
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณต้องการลบรายการนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังลบรายการ...',
        text: 'กรุณารอสักครู่',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const ok = await deletePrep(id);
      Swal.close();
      if (ok) {
        toast('ลบข้อมูลสำเร็จ', 'success');
      } else {
        toast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
      }
    }
  };

  const [visibleCount, setVisibleCount] = useState(20);

  const currentMonth = defaultMonth;
  const monthOptions = useMemo(
    () => buildMonthOptions(allPreps.map((p) => p.date.slice(0, 7)), currentMonth),
    [allPreps, currentMonth]
  );
  const currentMonthYear = monthOptions.find((option) => option.value === selectedMonth)?.label ?? fmtThaiMonthYear(selectedMonth);
  const locations = useMemo(() => {
    const set = new Set(monthPreps.map((p) => p.location).filter(Boolean));
    return Array.from(set).sort();
  }, [monthPreps]);
  const filteredPreps = useMemo(
    () => (filterLocation ? monthPreps.filter((p) => p.location === filterLocation) : monthPreps),
    [monthPreps, filterLocation]
  );

  useEffect(() => {
    setVisibleCount(20);
  }, [filteredPreps.length, selectedMonth, filterLocation]);

  useEffect(() => {
    if (filterLocation && !locations.includes(filterLocation)) setFilterLocation('');
  }, [filterLocation, locations]);

  const patientPreps = filteredPreps.filter(p => p.mode === 'patient');
  const patientBottles = patientPreps.reduce((sum, p) => sum + p.qty, 0);
  const stockBottles = filteredPreps.filter(p => p.mode === 'stock').reduce((sum, p) => sum + p.qty, 0);
  const recent = filteredPreps.slice(0, visibleCount);
  const hasMore = filteredPreps.length > visibleCount;

  const cnt: Record<string, number> = {};
  filteredPreps.forEach(p => { cnt[p.formula_name] = (cnt[p.formula_name] || 0) + p.qty; });
  const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const cols = ['blue', 'green', 'amber', 'purple', 'teal', 'red'];

  const priceMap = Object.fromEntries(formulas.map(f => [f.id, f.price ?? 0]));
  const totalValue = filteredPreps.reduce((sum, p) => sum + (priceMap[p.formula_id] ?? 0) * p.qty, 0);
  const totalValueFormatted = `฿${totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dailyRows = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDate: Record<string, typeof filteredPreps> = {};
    filteredPreps.forEach((p) => {
      (byDate[p.date] ??= []).push(p);
    });
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
      const dayPreps = byDate[date] ?? [];
      const slots: Record<SlotKey, number> = { morning: 0, afternoon: 0, overtime: 0 };
      let totalQty = 0;
      let totalValue = 0;
      dayPreps.forEach((p) => {
        slots[classifySlot(p.created_at)]++;
        totalQty += p.qty;
        totalValue += (priceMap[p.formula_id] ?? 0) * p.qty;
      });
      return { date, ...slots, totalPreps: dayPreps.length, totalQty, totalValue };
    });
  }, [filteredPreps, selectedMonth, priceMap]);
  const workloadSummary = useMemo(() => {
    const activeDays = dailyRows.filter((d) => d.totalPreps > 0);
    const totalPreps = filteredPreps.length;
    const totalQty = filteredPreps.reduce((sum, p) => sum + p.qty, 0);
    const totalValue = filteredPreps.reduce((sum, p) => sum + (priceMap[p.formula_id] ?? 0) * p.qty, 0);
    const avgPerDay = activeDays.length > 0 ? (totalPreps / activeDays.length).toFixed(1) : '0';
    const busiestDay = activeDays.reduce<typeof dailyRows[number] | null>(
      (best, day) => (!best || day.totalPreps > best.totalPreps ? day : best),
      null
    );
    const slotTotals = SLOTS.reduce((acc, slot) => {
      acc[slot.key] = dailyRows.reduce((sum, day) => sum + day[slot.key], 0);
      return acc;
    }, {} as Record<SlotKey, number>);
    return { totalPreps, totalQty, totalValue, avgPerDay, busiestDay, slotTotals };
  }, [dailyRows, filteredPreps, priceMap]);
  const maxWorkloadPreps = Math.max(...dailyRows.map((d) => d.totalPreps), 1);
  const displayWorkloadRows = showAllDays ? dailyRows : dailyRows.filter((d) => d.totalPreps > 0);

  const handleExportWorkload = () => {
    const rows = displayWorkloadRows.map((d) => ({
      วันที่: d.date,
      'เช้า (จ-ศ 08:30-13:30)': d.morning || 0,
      'บ่าย (จ-ศ 13:30-16:30)': d.afternoon || 0,
      'นอกเวลา': d.overtime || 0,
      รายการรวม: d.totalPreps,
      จำนวนขวด: d.totalQty,
      'มูลค่า (บาท)': parseFloat(d.totalValue.toFixed(2)),
    }));
    rows.push({
      วันที่: 'รวมทั้งเดือน',
      'เช้า (จ-ศ 08:30-13:30)': workloadSummary.slotTotals.morning,
      'บ่าย (จ-ศ 13:30-16:30)': workloadSummary.slotTotals.afternoon,
      'นอกเวลา': workloadSummary.slotTotals.overtime,
      รายการรวม: workloadSummary.totalPreps,
      จำนวนขวด: workloadSummary.totalQty,
      'มูลค่า (บาท)': parseFloat(workloadSummary.totalValue.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workload');
    XLSX.writeFile(wb, `workload-${selectedMonth}.xlsx`);
  };

  const stats = [
    { v: workloadSummary.totalQty, l: 'จำนวนขวดทั้งหมด', c: 'blue', path: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></> },
    { v: patientBottles, l: 'จำนวนขวดเฉพาะราย', c: 'amber', path: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
    { v: stockBottles, l: 'จำนวนขวด Stock', c: 'purple', path: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></> },
    { v: workloadSummary.avgPerDay, l: 'ขวดเฉลี่ย/วันที่ผลิต', c: 'green', path: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></> },
    {
      v: workloadSummary.busiestDay ? `${workloadSummary.busiestDay.totalQty} ขวด` : '—',
      l: workloadSummary.busiestDay ? `จำนวนขวดวันสูงสุด (${fmtThaiDay(workloadSummary.busiestDay.date)})` : 'จำนวนขวดวันสูงสุด',
      c: 'red',
      path: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
    },
    { v: totalValueFormatted, l: 'มูลค่ายาที่ผลิต', c: 'teal', path: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></> },
  ];

  return (
    <div className="page-section">
      <div className="page-actions dashboard-toolbar">
        <div className="dashboard-toolbar-group">
          <select className="form-select dashboard-inline-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {locations.length > 1 && (
            <select className="form-select dashboard-inline-select" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
              <option value="">ทุกหน่วยงาน</option>
              {locations.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          )}
        </div>
        <RefreshButton refreshing={refreshing} onClick={() => {
          fetchPreps(true);
          fetchAllPreps(true);
        }} />
      </div>

      {loading ? (
        <LoadingState title="กำลังโหลดภาพรวมการผลิต" description="ดึงข้อมูลรายการเตรียมยาประจำเดือนจาก Google Sheet" />
      ) : (
        <>
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className={`stat-icon ${s.c}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{s.path}</svg>
            </div>
            <div className="stat-info">
              <h4 className={typeof s.v === 'string' && s.v.startsWith('฿') ? 'stat-value stat-value-currency' : 'stat-value'}>
                {s.v}
              </h4>
              <p>{s.l}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="recent-grid">
        <div className="card">
          <div className="card-header">
            <h3>รายการล่าสุด ประจำเดือน {currentMonthYear}</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/history')}>ดูทั้งหมด →</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrapper dashboard-table-wrapper">
              <table className="responsive-table">
                <thead><tr><th>วันที่</th><th>สูตรยา</th><th>จำนวน</th><th>ประเภท</th><th>ผู้เตรียม</th><th></th></tr></thead>
                <tbody>
                  {recent.length ? recent.map(p => (

                    <tr
                      key={p.id}
                      onClick={() => setSelectedPrep(p)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td data-label="วันที่" style={{ fontFamily: 'var(--font-mono)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtShort(p.date)}</div>
                        {p.created_at && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtTime(p.created_at)}</div>
                        )}
                      </td>
                      <td data-label="สูตรยา" style={{ fontWeight: 500 }}>{shortNameMap[p.formula_name] ?? p.formula_name}</td>
                      <td data-label="จำนวน">{p.qty}</td>
                      <td data-label="ประเภท" style={{ whiteSpace: 'nowrap' }}><span className={`badge-tag ${p.mode === 'patient' ? 'blue' : 'teal'}`}>{p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}</span></td>
                      <td data-label="ผู้เตรียม">{p.prepared_by}</td>
                      <td className="td-actions" style={{ textAlign: 'right' }}>
                        {(user?.role === 'admin' || user?.name === p.prepared_by) && (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEditPrep(p); }} title="แก้ไข" style={{ marginLeft: '4px' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                              </svg>
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={(e) => handleDelete(p.id, e)} title="ลบรายการ" style={{ marginLeft: '4px' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="td-empty" colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>ยังไม่มีรายการ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setVisibleCount(c => c + 20)}
                  style={{ width: '100%', color: 'var(--text-secondary)', gap: '6px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  โหลดเพิ่มอีก 20 รายการ ({filteredPreps.length - visibleCount} รายการที่เหลือ)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>สรุปสูตรยา ประจำเดือน {currentMonthYear}</h3></div>
          <div className="card-body">
            {sorted.length ? sorted.map(([n, c], i) => (
              <div
                key={n}
                onClick={() => setSelectedSummary(n)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
                  borderBottom: i < sorted.length - 1 ? '1px solid #F1F5F9' : 'none',
                  cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="คลิกเพื่อดูประวัติการเตรียมยา"
              >
                <span style={{ fontSize: '13px', fontWeight: 500 }} title={n}>
                  {shortNameMap[n] || n}
                </span>
                <span className={`badge-tag ${cols[i % 6]}`}>{c} ขวด</span>
              </div>
            )) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>ข้อมูลจะแสดงหลังเริ่มเตรียมยา</p>
            )}
          </div>
        </div>
      </div>

      <EditPrepModal
        isOpen={!!editPrep}
        onClose={() => setEditPrep(null)}
        prep={editPrep}
        onUpdate={handleUpdate}
      />

      <PrepDetailsModal
        isOpen={!!selectedPrep}
        prep={selectedPrep}
        onClose={() => setSelectedPrep(null)}
      />

      <SummaryDetailsModal
        isOpen={!!selectedSummary}
        onClose={() => setSelectedSummary(null)}
        formulaName={selectedSummary}
        preps={filteredPreps}
      />

      <section className="dashboard-workload-section">
        <div className="card">
          <div className="card-header dashboard-workload-header">
            <div>
              <h3>Workload รายเดือน</h3>
              <p className="dashboard-section-subtitle">ใช้ตัวกรองเดียวกับภาพรวมด้านบน และแสดงเฉพาะส่วนวิเคราะห์ที่ไม่ซ้ำกับการ์ดหลัก</p>
            </div>
            <div className="dashboard-workload-actions">
              <div className="dashboard-workload-buttons">
                <button className="btn btn-outline" onClick={handleExportWorkload} disabled={workloadSummary.totalPreps === 0}>
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          <div className="card-body">
            <>
                {workloadSummary.totalPreps > 0 && (
                  <div className="card dashboard-workload-breakdown-card">
                    <div className="card-header">
                      <h3>สัดส่วนตามช่วงเวลา — {currentMonthYear}</h3>
                    </div>
                    <div className="card-body">
                      <div className="dashboard-slot-grid">
                        {SLOTS.map((slot) => {
                          const count = workloadSummary.slotTotals[slot.key];
                          const pct = workloadSummary.totalPreps > 0 ? Math.round((count / workloadSummary.totalPreps) * 100) : 0;
                          return (
                            <div key={slot.key} className="dashboard-slot-card">
                              <div className="dashboard-slot-head">
                                <span>{slot.label}</span>
                                <strong style={{ color: slot.color }}>{count}</strong>
                              </div>
                              <p>{slot.range}</p>
                              <div className="dashboard-slot-bar">
                                <div style={{ width: `${pct}%`, background: slot.color }} />
                              </div>
                              <small>{pct}% ของทั้งหมด</small>
                            </div>
                          );
                        })}
                      </div>
                      <div className="dashboard-slot-overview">
                        {SLOTS.map((slot) => {
                          const pct = workloadSummary.totalPreps > 0 ? (workloadSummary.slotTotals[slot.key] / workloadSummary.totalPreps) * 100 : 0;
                          return pct > 0 ? <div key={slot.key} style={{ width: `${pct}%`, background: slot.color }} /> : null;
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="card dashboard-workload-breakdown-card">
                  <div className="card-header dashboard-workload-daily-header">
                    <h3>รายละเอียดรายวัน — {currentMonthYear}</h3>
                    <button className="btn btn-sm btn-outline" onClick={() => setShowAllDays((value) => !value)}>
                      {showAllDays ? 'เฉพาะวันที่ผลิต' : 'แสดงทุกวัน'}
                    </button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {displayWorkloadRows.length === 0 ? (
                      <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ไม่มีข้อมูลการผลิตในเดือนนี้</p>
                    ) : (
                      <div className="table-wrapper dashboard-table-wrapper">
                        <table className="responsive-table">
                          <thead>
                            <tr>
                              <th>วันที่</th>
                              <th>เช้า</th>
                              <th>บ่าย</th>
                              <th>นอกเวลา</th>
                              <th>รวม</th>
                              <th>ขวด</th>
                              <th>สัดส่วน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayWorkloadRows.map((day) => {
                              const barWidth = (day.totalPreps / maxWorkloadPreps) * 100;
                              const isEmpty = day.totalPreps === 0;
                              return (
                                <tr key={day.date}>
                                  <td data-label="วันที่" style={{ fontFamily: 'var(--font-mono)' }}>{fmtThaiDay(day.date)}</td>
                                  <td data-label="เช้า" style={{ color: day.morning > 0 ? '#d97706' : 'var(--text-muted)', fontWeight: day.morning > 0 ? 700 : 400 }}>{day.morning || '—'}</td>
                                  <td data-label="บ่าย" style={{ color: day.afternoon > 0 ? '#2563eb' : 'var(--text-muted)', fontWeight: day.afternoon > 0 ? 700 : 400 }}>{day.afternoon || '—'}</td>
                                  <td data-label="นอกเวลา" style={{ color: day.overtime > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: day.overtime > 0 ? 700 : 400 }}>{day.overtime || '—'}</td>
                                  <td data-label="รวม">{isEmpty ? '—' : day.totalPreps}</td>
                                  <td data-label="ขวด">{isEmpty ? '—' : day.totalQty}</td>
                                  <td data-label="สัดส่วน">
                                    {!isEmpty && (
                                      <div className="dashboard-mini-stack" style={{ width: `${Math.max(barWidth, 10)}%` }}>
                                        {SLOTS.map((slot) => {
                                          const segPct = (day[slot.key] / day.totalPreps) * 100;
                                          return segPct > 0 ? <div key={slot.key} style={{ width: `${segPct}%`, background: slot.color }} /> : null;
                                        })}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
            </>
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
