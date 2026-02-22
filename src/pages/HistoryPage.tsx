import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { usePreps } from '../hooks/usePreps';
import { useFormulas } from '../hooks/useFormulas';
import { fmtShort, fmtTime, today, isTimeInRange } from '../lib/utils';
import { useLocation as useRouterLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import PrepDetailsModal from '../components/PrepDetailsModal';
import EditPrepModal from '../components/EditPrepModal';
import type { Prep } from '../types';

export default function HistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { preps, updatePrep, deletePrep } = usePreps();
  const { formulas } = useFormulas();
  const routerLocation = useRouterLocation();
  const filterByState = (routerLocation.state as { filterBy?: string } | null)?.filterBy || '';
  const [search, setSearch] = useState(filterByState);
  const [roomFilter, setRoomFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Edit State
  const [editPrep, setEditPrep] = useState<Prep | null>(null);
  
  // Details Modal State
  const [selectedPrep, setSelectedPrep] = useState<Prep | null>(null);

  const filtered = useMemo(() => {
    let list = [...preps];
    const s = search.toLowerCase();
    if (s) list = list.filter(p => {
      const f = formulas.find(x => x.id === p.formula_id);
      const code = f?.code?.toLowerCase() || '';
      return (
        p.formula_name.toLowerCase().includes(s) ||
        code.includes(s) ||
        p.target.toLowerCase().includes(s) ||
        p.prepared_by.toLowerCase().includes(s) ||
        p.lot_no.toLowerCase().includes(s)
      );
    });
    if (roomFilter) list = list.filter(p => p.location === roomFilter);
    if (modeFilter) list = list.filter(p => p.mode === modeFilter);
    if (timeFilter) {
      if (timeFilter === 'morning') {
        // 08:30 to 13:30 (inclusive range check)
        list = list.filter(p => p.created_at && isTimeInRange(p.created_at, 8, 30, 13, 30));
      } else if (timeFilter === 'afternoon') {
        // 13:31 to 16:30 (minute offset by 1)
        list = list.filter(p => p.created_at && isTimeInRange(p.created_at, 13, 31, 16, 30));
      }
    }
    if (dateFrom) list = list.filter(p => p.date >= dateFrom);
    if (dateTo) list = list.filter(p => p.date <= dateTo);
    return list;
  }, [preps, search, roomFilter, modeFilter, timeFilter, dateFrom, dateTo]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const prep = preps.find(p => p.id === id);
    if (!prep) return;
    
    // Permission check
    if (user?.role !== 'admin' && user?.name !== prep.prepared_by) {
      toast('คุณไม่มีสิทธิ์ลบรายการนี้', 'error');
      return;
    }

    const result = await Swal.fire({
      title: 'ต้องการลบรายการนี้?',
      text: "การกระทำนี้ไม่สามารถย้อนกลับได้!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบรายการ',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;
    
    const ok = await deletePrep(id);
    if (ok) {
      Swal.fire('ลบสำเร็จ!', 'รายการถูกลบเรียบร้อยแล้ว.', 'success');
    } else {
      toast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const openEdit = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const prep = preps.find(p => p.id === id);
    if (!prep) return;
    if (user?.role !== 'admin' && user?.name !== prep.prepared_by) {
      toast('คุณไม่มีสิทธิ์แก้ไขรายการนี้', 'error');
      return;
    }
    setEditPrep(prep);
  };

  const handleUpdate = async (id: number, updates: Partial<Prep>) => {
    const ok = await updatePrep(id, updates);
    if (ok) {
      toast('แก้ไขรายการสำเร็จ', 'success');
      setEditPrep(null);
    } else {
      toast('เกิดข้อผิดพลาดในการแก้ไข', 'error');
    }
    return ok;
  };

  const handleExport = () => {
    const dataToExport = filtered.length ? filtered : preps;
    if (!dataToExport.length) { toast('ไม่มีข้อมูล', 'error'); return; }
    
    const exportData = dataToExport.map(p => ({
      'ID': p.id,
      'วันที่': p.date,
      'เวลา': p.created_at ? fmtTime(p.created_at).replace(' น.', '') : '',
      'สูตรยา': p.formula_name,
      'ประเภท': p.mode === 'patient' ? 'เฉพาะราย' : 'Stock',
      'ผู้ป่วย/ห้อง': p.target,
      'Lot': p.lot_no,
      'จำนวน': p.qty,
      'ผู้เตรียม': p.prepared_by,
      'สถานที่': p.location,
      'วันหมดอายุ': p.expiry_date,
      'หมายเหตุ': p.note || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'History');
    
    XLSX.writeFile(workbook, `ED-Extemp_${today()}.xlsx`);
    toast('Export Excel สำเร็จ', 'success');
  };

  return (
    <div className="page-section">
      <div className="card">
        <div className="card-header">
          <h3>ประวัติการผลิต</h3>
            <button className="btn-excel" onClick={handleExport}>
              <svg viewBox="0 0 50 50">
                <path d="M28.8125 .03125L.8125 5.34375C.339844 5.433594 0 5.863281 0 6.34375L0 43.65625C0 44.136719 .339844 44.566406 .8125 44.65625L28.8125 49.96875C28.875 49.980469 28.9375 50 29 50C29.230469 50 29.445313 49.929688 29.625 49.78125C29.855469 49.589844 30 49.296875 30 49L30 1C30 .703125 29.855469 .410156 29.625 .21875C29.394531 .0273438 29.105469 -.0234375 28.8125 .03125ZM32 6L32 13L34 13L34 15L32 15L32 20L34 20L34 22L32 22L32 27L34 27L34 29L32 29L32 35L34 35L34 37L32 37L32 44L47 44C48.101563 44 49 43.101563 49 42L49 8C49 6.898438 48.101563 6 47 6ZM36 13L44 13L44 15L36 15ZM6.6875 15.6875L11.8125 15.6875L14.5 21.28125C14.710938 21.722656 14.898438 22.265625 15.0625 22.875L15.09375 22.875C15.199219 22.511719 15.402344 21.941406 15.6875 21.21875L18.65625 15.6875L23.34375 15.6875L17.75 24.9375L23.5 34.375L18.53125 34.375L15.28125 28.28125C15.160156 28.054688 15.035156 27.636719 14.90625 27.03125L14.875 27.03125C14.8125 27.316406 14.664063 27.761719 14.4375 28.34375L11.1875 34.375L6.1875 34.375L12.15625 25.03125ZM36 20L44 20L44 22L36 22ZM36 27L44 27L44 29L36 29ZM36 35L44 35L44 37L36 37Z" />
              </svg>
              Export
            </button>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="ค้นหาชื่อยา, รหัส, ผู้ป่วย, เภสัชกร..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 'auto', minWidth: '150px' }} value={roomFilter} onChange={e => setRoomFilter(e.target.value)}>
              <option value="">ทุกห้องยา</option>
              <option value="ห้องยาในศัลยกรรม">ห้องยาในศัลยกรรม (IPD Surg)</option>
              <option value="ห้องจ่ายยาผู้ป่วยนอก">ห้องจ่ายยาผู้ป่วยนอก (OPD)</option>
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: '120px' }} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
              <option value="">ทุกประเภท</option>
              <option value="patient">เฉพาะราย</option>
              <option value="stock">Stock</option>
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: '130px' }} value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
              <option value="">ทุกช่วงเวลา</option>
              <option value="morning">เช้า (08:30 - 13:30)</option>
              <option value="afternoon">บ่าย (13:31 - 16:30)</option>
            </select>
            <input type="date" className="form-input" style={{ width: 'auto' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ถึง</span>
            <input type="date" className="form-input" style={{ width: 'auto' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(search || roomFilter || modeFilter || timeFilter || dateFrom || dateTo) && (
              <button 
                className="btn btn-sm btn-ghost" 
                onClick={() => { setSearch(''); setRoomFilter(''); setModeFilter(''); setTimeFilter(''); setDateFrom(''); setDateTo(''); }}
                style={{ color: 'var(--accent-red)' }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
        <div className="table-wrapper" style={{ padding: '0 24px 24px' }}>
          <table style={{ minWidth: '1000px' }}>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th style={{ width: '100px' }}>วันที่</th>
                <th>สูตรยา</th>
                <th style={{ width: '110px' }}>ประเภท</th>
                <th style={{ width: '200px' }}>ผู้ป่วย/ห้อง</th>
                <th style={{ width: '120px' }}>Lot / Qty</th>
                <th style={{ width: '120px' }}>ผู้เตรียม</th>
                <th style={{ width: '100px' }}>สถานที่</th>
                <th style={{ width: '80px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(p => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedPrep(p)} 
                  style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtShort(p.date)}</div>
                    {p.created_at && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtTime(p.created_at)}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{p.formula_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.concentration}</div>
                  </td>
                  <td>
                    <span className={`badge-tag ${p.mode === 'patient' ? 'blue' : 'teal'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px', lineHeight: '1.4', maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.target}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {p.lot_no.replace('LOT-', '')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      จำนวน: {p.qty}
                    </div>
                  </td>
                  <td style={{ fontSize: '13px' }}>{p.prepared_by}</td>
                  <td>
                    <span className="badge-tag green" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {p.location === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || p.location === 'ห้องยาในศัลยกรรม' ? 'IPD Surg' : (p.location === 'ห้องจ่ายยาผู้ป่วยนอก' ? 'OPD' : p.location)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                      {(user?.role === 'admin' || user?.name === p.prepared_by) && (
                        <button className="btn btn-sm btn-ghost" onClick={(e) => openEdit(p.id, e)} title="แก้ไขรายการ" style={{ padding: '4px' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      {(user?.role === 'admin' || user?.name === p.prepared_by) && (
                        <button className="btn btn-sm btn-ghost" onClick={(e) => handleDelete(p.id, e)} title="ลบรายการ" style={{ padding: '4px' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>ไม่พบรายการ</td></tr>
              )}
            </tbody>
          </table>
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
        onClose={() => setSelectedPrep(null)}
        prep={selectedPrep}
      />
    </div>
  );
}
