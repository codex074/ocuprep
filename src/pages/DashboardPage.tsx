import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtShort, fmtTime, today, getMonthRange, getCurrentThaiMonthYear } from '../lib/utils';
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

export default function DashboardPage() {
  const [editPrep, setEditPrep] = useState<Prep | null>(null);
  const [selectedPrep, setSelectedPrep] = useState<Prep | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  // ส่ง date range → GAS filter ฝั่ง server เฉพาะเดือนปัจจุบัน
  const [start, end] = getMonthRange();
  const { preps, loading, refreshing, fetchPreps, updatePrep, deletePrep } = usePreps(start, end);
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

  // reset เมื่อข้อมูลเดือนโหลดใหม่
  useEffect(() => { setVisibleCount(20); }, [preps.length]);

  const t = today();
  const currentMonthYear = getCurrentThaiMonthYear();
  const todayPreps = preps.filter(p => p.date === t);
  const patientPreps = preps.filter(p => p.mode === 'patient');
  const stockBottles = preps.filter(p => p.mode === 'stock').reduce((sum, p) => sum + p.qty, 0);
  const recent = preps.slice(0, visibleCount);
  const hasMore = preps.length > visibleCount;

  const cnt: Record<string, number> = {};
  preps.forEach(p => { cnt[p.formula_name] = (cnt[p.formula_name] || 0) + p.qty; });
  const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const cols = ['blue', 'green', 'amber', 'purple', 'teal', 'red'];

  const stats = [
    { v: preps.length, l: 'รายการทั้งหมด', c: 'blue', path: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></> },
    { v: todayPreps.length, l: 'ผลิตวันนี้', c: 'green', path: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></> },
    { v: patientPreps.length, l: 'เฉพาะราย (Patient)', c: 'amber', path: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
    { v: stockBottles, l: 'จำนวนขวดที่ทำ (Stock)', c: 'purple', path: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></> },
  ];

  return (
    <div className="page-section">
      <div className="page-actions">
        <RefreshButton refreshing={refreshing} onClick={() => fetchPreps(true)} />
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
            <div className="stat-info"><h4>{s.v}</h4><p>{s.l}</p></div>
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
            <div className="table-wrapper">
              <table>
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
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtShort(p.date)}</div>
                        {p.created_at && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtTime(p.created_at)}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.formula_name}</td>
                      <td>{p.qty}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><span className={`badge-tag ${p.mode === 'patient' ? 'blue' : 'teal'}`}>{p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}</span></td>
                      <td>{p.prepared_by}</td>
                      <td style={{ textAlign: 'right' }}>
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
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>ยังไม่มีรายการ</td></tr>
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
                  โหลดเพิ่มอีก 20 รายการ ({preps.length - visibleCount} รายการที่เหลือ)
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
        preps={preps}
      />
        </>
      )}
    </div>
  );
}
