import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { usePreps } from '../hooks/usePreps';
import { useFormulas } from '../hooks/useFormulas';
import { fmtShort, fmtTime, today, isTimeInRange } from '../lib/utils';
import { useLocation as useRouterLocation } from 'react-router-dom';
import LoadingState from '../components/ui/LoadingState';
import RefreshButton from '../components/ui/RefreshButton';
import Swal from 'sweetalert2';
import PrepDetailsModal from '../components/PrepDetailsModal';
import EditPrepModal from '../components/EditPrepModal';
import type { Prep } from '../types';

export default function HistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { preps, loading: prepsLoading, refreshing: prepsRefreshing, fetchPreps, updatePrep, deletePrep } = usePreps();
  const { formulas, loading: formulasLoading, refreshing: formulasRefreshing, fetchFormulas } = useFormulas();
  const routerLocation = useRouterLocation();
  const filterByState = (routerLocation.state as { filterBy?: string } | null)?.filterBy || '';

  // lookup: formula_name → short_name
  const shortNameMap = Object.fromEntries(
    formulas.map(f => [f.name, f.short_name ?? f.name])
  );

  // filter state
  const [search, setSearch]         = useState(filterByState);
  const [roomFilter, setRoomFilter]   = useState('');
  const [modeFilter, setModeFilter]   = useState('');
  const [timeFilter, setTimeFilter]   = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');

  // draft state inside modal (not applied until "ใช้ตัวกรอง")
  const [draftSearch, setDraftSearch]       = useState(filterByState);
  const [draftRoom, setDraftRoom]           = useState('');
  const [draftMode, setDraftMode]           = useState('');
  const [draftTime, setDraftTime]           = useState('');
  const [draftDateFrom, setDraftDateFrom]   = useState('');
  const [draftDateTo, setDraftDateTo]       = useState('');

  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  // Edit / Details Modal
  const [editPrep, setEditPrep]       = useState<Prep | null>(null);
  const [selectedPrep, setSelectedPrep] = useState<Prep | null>(null);

  const isRefreshing = prepsRefreshing || formulasRefreshing;

  useEffect(() => { setVisibleCount(20); }, [search, roomFilter, modeFilter, timeFilter, dateFrom, dateTo]);

  // sync draft when modal opens
  const openFilter = () => {
    setDraftSearch(search);
    setDraftRoom(roomFilter);
    setDraftMode(modeFilter);
    setDraftTime(timeFilter);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setSearch(draftSearch);
    setRoomFilter(draftRoom);
    setModeFilter(draftMode);
    setTimeFilter(draftTime);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setFilterOpen(false);
  };

  const clearFilter = () => {
    setDraftSearch(''); setDraftRoom(''); setDraftMode('');
    setDraftTime(''); setDraftDateFrom(''); setDraftDateTo('');
  };

  const clearAllFilter = () => {
    setSearch(''); setRoomFilter(''); setModeFilter('');
    setTimeFilter(''); setDateFrom(''); setDateTo('');
  };

  // count active filters (excluding search)
  const activeFilterCount = [roomFilter, modeFilter, timeFilter, dateFrom, dateTo, search]
    .filter(Boolean).length;

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
    if (roomFilter === 'IPD') {
      list = list.filter(p => p.location === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || p.location === 'ห้องยาในศัลยกรรม');
    } else if (roomFilter === 'OPD') {
      list = list.filter(p => p.location === 'ห้องจ่ายยาผู้ป่วยนอก');
    } else if (roomFilter) {
      list = list.filter(p => p.location === roomFilter);
    }
    if (modeFilter) list = list.filter(p => p.mode === modeFilter);
    if (timeFilter) {
      if (timeFilter === 'morning') {
        list = list.filter(p => p.created_at && isTimeInRange(p.created_at, 8, 30, 13, 30));
      } else if (timeFilter === 'afternoon') {
        list = list.filter(p => p.created_at && isTimeInRange(p.created_at, 13, 31, 16, 30));
      }
    }
    if (dateFrom) list = list.filter(p => p.date >= dateFrom);
    if (dateTo)   list = list.filter(p => p.date <= dateTo);
    return list;
  }, [preps, search, roomFilter, modeFilter, timeFilter, dateFrom, dateTo, formulas]);

  const visiblePreps = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const prep = preps.find(p => p.id === id);
    if (!prep) return;
    if (user?.role !== 'admin' && user?.name !== prep.prepared_by) {
      toast('คุณไม่มีสิทธิ์ลบรายการนี้', 'error');
      return;
    }
    const result = await Swal.fire({
      title: 'ต้องการลบรายการนี้?',
      text: 'การกระทำนี้ไม่สามารถย้อนกลับได้!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบรายการ',
      cancelButtonText: 'ยกเลิก',
    });
    if (!result.isConfirmed) return;
    Swal.fire({ title: 'กำลังลบรายการ...', text: 'กรุณารอสักครู่', allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    const ok = await deletePrep(id);
    Swal.close();
    if (ok) toast('ลบรายการสำเร็จ', 'success');
    else    toast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
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
    if (ok) { toast('แก้ไขรายการสำเร็จ', 'success'); setEditPrep(null); }
    else    toast('เกิดข้อผิดพลาดในการแก้ไข', 'error');
    return ok;
  };

  const handleExport = () => {
    const dataToExport = filtered.length ? filtered : preps;
    if (!dataToExport.length) { toast('ไม่มีข้อมูล', 'error'); return; }
    const exportData = dataToExport.map(p => ({
      'ID': p.id,
      'วันที่': p.date,
      'เวลา': p.created_at ? fmtTime(p.created_at).replace(' น.', '') : '',
      'สูตรยา': shortNameMap[p.formula_name] ?? p.formula_name,
      'ประเภท': p.mode === 'patient' ? 'เฉพาะราย' : 'Stock',
      'ผู้ป่วย/ห้อง': p.target,
      'Lot': p.lot_no,
      'จำนวน': p.qty,
      'ผู้เตรียม': p.prepared_by,
      'สถานที่': p.location,
      'วันหมดอายุ': p.expiry_date,
      'หมายเหตุ': p.note || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'History');
    XLSX.writeFile(workbook, `YATA_${today()}.xlsx`);
    toast('Export Excel สำเร็จ', 'success');
  };

  return (
    <div className="page-section">
      <div className="page-actions">
        <RefreshButton refreshing={isRefreshing} onClick={() => { fetchPreps(true); fetchFormulas(true); }} />
      </div>

      {prepsLoading || formulasLoading ? (
        <LoadingState title="กำลังโหลดประวัติการผลิต" description="ดึงข้อมูลประวัติและสูตรยาจากฐานข้อมูล" />
      ) : (
        <>
          <div className="card">
            {/* Card Header */}
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3>ประวัติการผลิต</h3>
                {activeFilterCount > 0 && (
                  <span className="filter-active-badge">{activeFilterCount}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Filter button */}
                <button className="btn btn-outline btn-sm history-filter-btn" onClick={openFilter}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  ตั้งค่าการกรอง
                  {activeFilterCount > 0 && (
                    <span className="filter-active-badge">{activeFilterCount}</span>
                  )}
                </button>
                {/* Export */}
                <button className="btn-excel" onClick={handleExport}>
                  <svg viewBox="0 0 50 50">
                    <path d="M28.8125 .03125L.8125 5.34375C.339844 5.433594 0 5.863281 0 6.34375L0 43.65625C0 44.136719 .339844 44.566406 .8125 44.65625L28.8125 49.96875C28.875 49.980469 28.9375 50 29 50C29.230469 50 29.445313 49.929688 29.625 49.78125C29.855469 49.589844 30 49.296875 30 49L30 1C30 .703125 29.855469 .410156 29.625 .21875C29.394531 .0273438 29.105469 -.0234375 28.8125 .03125ZM32 6L32 13L34 13L34 15L32 15L32 20L34 20L34 22L32 22L32 27L34 27L34 29L32 29L32 35L34 35L34 37L32 37L32 44L47 44C48.101563 44 49 43.101563 49 42L49 8C49 6.898438 48.101563 6 47 6ZM36 13L44 13L44 15L36 15ZM6.6875 15.6875L11.8125 15.6875L14.5 21.28125C14.710938 21.722656 14.898438 22.265625 15.0625 22.875L15.09375 22.875C15.199219 22.511719 15.402344 21.941406 15.6875 21.21875L18.65625 15.6875L23.34375 15.6875L17.75 24.9375L23.5 34.375L18.53125 34.375L15.28125 28.28125C15.160156 28.054688 15.035156 27.636719 14.90625 27.03125L14.875 27.03125C14.8125 27.316406 14.664063 27.761719 14.4375 28.34375L11.1875 34.375L6.1875 34.375L12.15625 25.03125ZM36 20L44 20L44 22L36 22ZM36 27L44 27L44 29L36 29ZM36 35L44 35L44 37L36 37Z" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="history-filter-chips">
                {search && <span className="filter-chip">ค้นหา: {search}<button onClick={() => setSearch('')}>×</button></span>}
                {roomFilter && <span className="filter-chip">{roomFilter === 'IPD' ? 'IPD Surg' : 'OPD'}<button onClick={() => setRoomFilter('')}>×</button></span>}
                {modeFilter && <span className="filter-chip">{modeFilter === 'patient' ? 'เฉพาะราย' : 'Stock'}<button onClick={() => setModeFilter('')}>×</button></span>}
                {timeFilter && <span className="filter-chip">{timeFilter === 'morning' ? 'เช้า' : 'บ่าย'}<button onClick={() => setTimeFilter('')}>×</button></span>}
                {dateFrom && <span className="filter-chip">จาก {dateFrom}<button onClick={() => setDateFrom('')}>×</button></span>}
                {dateTo && <span className="filter-chip">ถึง {dateTo}<button onClick={() => setDateTo('')}>×</button></span>}
                <button className="filter-chip-clear" onClick={clearAllFilter}>ล้างทั้งหมด</button>
              </div>
            )}

            {/* Table */}
            <div className="table-wrapper history-table-wrapper" style={{ padding: '0 24px 24px' }}>
              <table className="responsive-table" style={{ minWidth: '1000px' }}>
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
                    <th style={{ width: '160px' }}>หมายเหตุ</th>
                    <th style={{ width: '80px', textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePreps.length ? visiblePreps.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPrep(p)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td data-label="#" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.id}</td>
                      <td data-label="วันที่" style={{ fontFamily: 'var(--font-mono)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtShort(p.date)}</div>
                        {p.created_at && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtTime(p.created_at)}</div>}
                      </td>
                      <td data-label="สูตรยา">
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{shortNameMap[p.formula_name] ?? p.formula_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.concentration}</div>
                      </td>
                      <td data-label="ประเภท">
                        <span className={`badge-tag ${p.mode === 'patient' ? 'purple' : 'amber'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}
                        </span>
                      </td>
                      <td data-label="ผู้ป่วย/ห้อง">
                        <div style={{ fontSize: '13px', lineHeight: '1.4' }}>{p.target}</div>
                      </td>
                      <td data-label="Lot / จำนวน">
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.lot_no.replace('LOT-', '')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>จำนวน: {p.qty}</div>
                      </td>
                      <td data-label="ผู้เตรียม" style={{ fontSize: '13px' }}>{p.prepared_by}</td>
                      <td data-label="สถานที่">
                        <span
                          className={`badge-tag ${
                            p.location === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || p.location === 'ห้องยาในศัลยกรรม'
                              ? 'blue'
                              : p.location === 'ห้องจ่ายยาผู้ป่วยนอก'
                                ? 'green'
                                : 'teal'
                          }`}
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          {p.location === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || p.location === 'ห้องยาในศัลยกรรม' ? 'IPD Surg' : (p.location === 'ห้องจ่ายยาผู้ป่วยนอก' ? 'OPD' : p.location)}
                        </span>
                      </td>
                      <td data-label="หมายเหตุ" style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '160px' }}>
                        {p.note ? (
                          <span title={p.note} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.note}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="td-actions">
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
                    <tr><td colSpan={10} className="td-empty" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>ไม่พบรายการ</td></tr>
                  )}
                </tbody>
              </table>
              {hasMore && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => setVisibleCount(c => c + 20)} style={{ width: '100%', color: 'var(--text-secondary)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    โหลดเพิ่มอีก 20 รายการ ({filtered.length - visibleCount} รายการที่เหลือ)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Filter Modal ── */}
          {filterOpen && (
            <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setFilterOpen(false); }}>
              <div className="modal history-filter-modal">
                {/* Header */}
                <div className="modal-header">
                  <h3 className="modal-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    ตั้งค่าการกรอง
                  </h3>
                  <button className="modal-close" onClick={() => setFilterOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                  {/* Search */}
                  <div className="form-group">
                    <label className="form-label">ค้นหา</label>
                    <div className="search-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        placeholder="ชื่อยา, รหัส, ผู้ป่วย, เภสัชกร..."
                        value={draftSearch}
                        onChange={e => setDraftSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Room */}
                  <div className="form-group">
                    <label className="form-label">ห้องยา</label>
                    <select className="form-select" value={draftRoom} onChange={e => setDraftRoom(e.target.value)}>
                      <option value="">ทุกห้องยา</option>
                      <option value="IPD">ห้องจ่ายยาผู้ป่วยในศัลยกรรม (IPD Surg)</option>
                      <option value="OPD">ห้องจ่ายยาผู้ป่วยนอก (OPD)</option>
                    </select>
                  </div>

                  {/* Mode */}
                  <div className="form-group">
                    <label className="form-label">ประเภทการผลิต</label>
                    <select className="form-select" value={draftMode} onChange={e => setDraftMode(e.target.value)}>
                      <option value="">ทุกประเภท</option>
                      <option value="patient">เฉพาะราย</option>
                      <option value="stock">Stock</option>
                    </select>
                  </div>

                  {/* Time slot */}
                  <div className="form-group">
                    <label className="form-label">ช่วงเวลา</label>
                    <select className="form-select" value={draftTime} onChange={e => setDraftTime(e.target.value)}>
                      <option value="">ทุกช่วงเวลา</option>
                      <option value="morning">เช้า (08:30 – 13:30)</option>
                      <option value="afternoon">บ่าย (13:31 – 16:30)</option>
                    </select>
                  </div>

                  {/* Date range */}
                  <div className="form-group">
                    <label className="form-label">ช่วงวันที่</label>
                    <div className="history-filter-date-row">
                      <input type="date" className="form-input" value={draftDateFrom} onChange={e => setDraftDateFrom(e.target.value)} />
                      <span className="history-filter-date-sep">ถึง</span>
                      <input type="date" className="form-input" value={draftDateTo} onChange={e => setDraftDateTo(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                  <button className="btn btn-ghost btn-sm" onClick={clearFilter} style={{ color: 'var(--accent-red)' }}>
                    ล้างตัวกรอง
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline" onClick={() => setFilterOpen(false)}>ยกเลิก</button>
                    <button className="btn btn-primary" onClick={applyFilter}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      ใช้ตัวกรอง
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <EditPrepModal isOpen={!!editPrep} onClose={() => setEditPrep(null)} prep={editPrep} formulas={formulas} onUpdate={handleUpdate} />
          <PrepDetailsModal isOpen={!!selectedPrep} onClose={() => setSelectedPrep(null)} prep={selectedPrep} />
        </>
      )}
    </div>
  );
}
