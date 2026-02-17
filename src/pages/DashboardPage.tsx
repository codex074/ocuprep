import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fmtShort, today, getMonthRange } from '../lib/utils';
import { generateLabelHtml, generateBottleLabelsHtml, printAllLabels } from '../lib/print';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import EditPrepModal from '../components/EditPrepModal';
import type { Prep, Formula } from '../types';

export default function DashboardPage() {
  const [preps, setPreps] = useState<Prep[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [formulaCount, setFormulaCount] = useState(0);
  const [editPrep, setEditPrep] = useState<Prep | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    const [start, end] = getMonthRange();
    const { data: p } = await supabase
      .from('preps')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('id', { ascending: false });
    
    if (p) setPreps(p as Prep[]);
    
    const { data: fData, count } = await supabase.from('formulas').select('*', { count: 'exact' });
    if (fData) setFormulas(fData as Formula[]);
    setFormulaCount(count || 0);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (id: number, updates: Partial<Prep>) => {
    const { error } = await supabase.from('preps').update(updates).eq('id', id);
    if (!error) {
      toast('แก้ไขรายการสำเร็จ', 'success');
      await fetchData();
      return true;
    }
    toast('เกิดข้อผิดพลาดในการแก้ไข', 'error');
    return false;
  };

  const handlePrint = (prep: Prep) => {
    const formula = formulas.find(f => f.id === prep.formula_id);
    const patientHtml = generateLabelHtml(prep);
    if (formula) {
      const bottleHtml = generateBottleLabelsHtml(prep, formula);
      printAllLabels(patientHtml, bottleHtml);
    } else {
      // Fallback: patient label only
      printAllLabels(patientHtml, '');
    }
  };

  const t = today();
  const todayPreps = preps.filter(p => p.date === t);
  const patientPreps = preps.filter(p => p.mode === 'patient');
  const recent = preps.slice(0, 5);

  // Summary count
  const cnt: Record<string, number> = {};
  preps.forEach(p => { cnt[p.formula_name] = (cnt[p.formula_name] || 0) + p.qty; });
  const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const cols = ['blue', 'green', 'amber', 'purple', 'teal', 'red'];

  const stats = [
    { v: preps.length, l: 'รายการทั้งหมด', c: 'blue', path: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></> },
    { v: todayPreps.length, l: 'ผลิตวันนี้', c: 'green', path: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></> },
    { v: patientPreps.length, l: 'เฉพาะราย (Patient)', c: 'amber', path: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
    { v: formulaCount, l: 'สูตรตำรับ', c: 'purple', path: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></> },
  ];

  return (
    <div className="page-section">
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
            <h3>รายการล่าสุด</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/history')}>ดูทั้งหมด →</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>วันที่</th><th>สูตรยา</th><th>จำนวน</th><th>ประเภท</th><th>ผู้เตรียม</th><th></th></tr></thead>
                <tbody>
                  {recent.length ? recent.map(p => (
                    <tr key={p.id}>
                      <td>{fmtShort(p.date)}</td>
                      <td style={{ fontWeight: 500 }}>{p.formula_name}</td>
                      <td>{p.qty}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><span className={`badge-tag ${p.mode === 'patient' ? 'blue' : 'teal'}`}>{p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}</span></td>
                      <td>{p.prepared_by}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); handlePrint(p); }} title="พิมพ์ฉลาก">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>
                        {(user?.role === 'admin' || user?.name === p.prepared_by) && (
                          <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEditPrep(p); }} title="แก้ไข" style={{ marginLeft: '4px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>ยังไม่มีรายการ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>สรุปสูตรยา</h3></div>
          <div className="card-body">
            {sorted.length ? sorted.map(([n, c], i) => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0',
                borderBottom: i < sorted.length - 1 ? '1px solid #F1F5F9' : 'none'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{n}</span>
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
    </div>
  );
}
