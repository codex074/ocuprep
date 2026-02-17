import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { usePreps } from '../hooks/usePreps';
import { useFormulas } from '../hooks/useFormulas';
import { fmtShort, today } from '../lib/utils';
import { generateLabelHtml, generateBottleLabelsHtml, printAllLabels } from '../lib/print';
import { useLocation as useRouterLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Edit State
  const [editPrep, setEditPrep] = useState<Prep | null>(null);

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
    if (dateFrom) list = list.filter(p => p.date >= dateFrom);
    if (dateTo) list = list.filter(p => p.date <= dateTo);
    return list;
  }, [preps, search, roomFilter, dateFrom, dateTo]);

  const handleDelete = async (id: number) => {
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

  const openEdit = (id: number) => {
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

  const handlePrint = (prep: Prep) => {
    const formula = formulas.find(f => f.id === prep.formula_id);
    const patientHtml = generateLabelHtml(prep);
    if (formula) {
      const bottleHtml = generateBottleLabelsHtml(prep, formula);
      printAllLabels(patientHtml, bottleHtml);
    } else {
      printAllLabels(patientHtml, '');
    }
  };

  const exportCSV = () => {
    if (!preps.length) { toast('ไม่มีข้อมูล', 'error'); return; }
    let csv = '\uFEFFID,วันที่,สูตรยา,ประเภท,ผู้ป่วย/ห้อง,Lot,จำนวน,ผู้เตรียม,สถานที่,วันหมดอายุ,หมายเหตุ\n';
    preps.forEach(p => {
      csv += `${p.id},${p.date},"${p.formula_name}",${p.mode},"${p.target}",${p.lot_no},${p.qty},"${p.prepared_by}",${p.location},${p.expiry_date},"${p.note || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ED-Extemp_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('Export CSV สำเร็จ', 'success');
  };

  const exportJSON = () => {
    if (!preps.length) { toast('ไม่มีข้อมูล', 'error'); return; }
    const blob = new Blob([JSON.stringify(preps, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ED-Extemp_${today()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast('Export JSON สำเร็จ', 'success');
  };

  return (
    <div className="page-section">
      <div className="card">
        <div className="card-header">
          <h3>ประวัติการผลิต</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-outline" onClick={exportCSV}>Export CSV</button>
            <button className="btn btn-sm btn-outline" onClick={exportJSON}>Export JSON</button>
          </div>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
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
            <input type="date" className="form-input" style={{ width: 'auto' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ถึง</span>
            <input type="date" className="form-input" style={{ width: 'auto' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(search || roomFilter || dateFrom || dateTo) && (
              <button 
                className="btn btn-sm btn-ghost" 
                onClick={() => { setSearch(''); setRoomFilter(''); setDateFrom(''); setDateTo(''); }}
                style={{ color: 'var(--accent-red)' }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
        <div className="table-wrapper" style={{ padding: '0 24px 24px' }}>
          <table>
            <thead>
              <tr><th>#</th><th>วันที่</th><th>สูตรยา</th><th>ประเภท</th><th>ผู้ป่วย/ห้อง</th><th>Lot</th><th>จำนวน</th><th>ผู้เตรียม</th><th>สถานที่</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.id}</td>
                  <td>{fmtShort(p.date)}</td>
                  <td style={{ fontWeight: 500 }}>{p.formula_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className={`badge-tag ${p.mode === 'patient' ? 'blue' : 'teal'}`}>{p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}</span></td>
                  <td>{p.target}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.lot_no.replace('LOT-', '')}</td>
                  <td>{p.qty}</td>
                  <td>{p.prepared_by}</td>
                  <td><span className="badge-tag green">{p.location === 'ห้องยาในศัลยกรรม' ? 'IPD Surg' : (p.location === 'ห้องจ่ายยาผู้ป่วยนอก' ? 'OPD' : p.location)}</span></td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => handlePrint(p)} title="พิมพ์ฉลาก">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                    </button>
                    {(user?.role === 'admin' || user?.name === p.prepared_by) && (
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(p.id)} title="ลบรายการ">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                    {(user?.role === 'admin' || user?.name === p.prepared_by) && (
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p.id)} title="แก้ไขรายการ" style={{ marginLeft: '4px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>ไม่พบรายการ</td></tr>
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
    </div>
  );
}
