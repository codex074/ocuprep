import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useFormulas } from '../hooks/useFormulas';
import { usePreps } from '../hooks/usePreps';
import { today, addDays, fmtDate, multiplyAmount } from '../lib/utils';
import { generateBatchSheetHtml, generateLabelHtml, generateBottleLabelsHtml, generatePrepStickersHtml, printAllLabels } from '../lib/print';
import { openLoadingModal, closeLoadingModal } from '../lib/loadingModal';
import Modal from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import LoadingState from '../components/ui/LoadingState';
import RefreshButton from '../components/ui/RefreshButton';
import { chemicalItemsFromIngredients, cleanChemicalItems } from '../lib/chemicalItems';
import type { ChemicalItem, Prep } from '../types';

type PrepPayload = Omit<Prep, 'id' | 'created_at'>;

export default function PreparePage() {
  const { user, location: curLoc } = useAuth();
  const { toast } = useToast();
  const { formulas, loading: formulasLoading, refreshing: formulasRefreshing, fetchFormulas } = useFormulas();
  const { preps, loading: prepsLoading, refreshing: prepsRefreshing, fetchPreps, createPrep } = usePreps();
  const [formulaId, setFormulaId] = useState('');
  const [mode, setMode] = useState<'patient' | 'stock'>('patient');
  const [hn, setHn] = useState('');
  const [patientName, setPatientName] = useState('');
  const [room, setRoom] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [printModal, setPrintModal] = useState(false);
  const [printContent, setPrintContent] = useState('');
  const [printTitle, setPrintTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [chemicalItems, setChemicalItems] = useState<ChemicalItem[]>([{ name: '', lot_no: '', expiry_date: '' }]);
  const [isExpired, setIsExpired] = useState(false);
  const [printMockPrep, setPrintMockPrep] = useState<Prep | null>(null);
  const isRefreshing = formulasRefreshing || prepsRefreshing;

  useEffect(() => {
    const nextId = preps.length > 0 ? Math.max(...preps.map(p => p.id)) + 1 : 1;
    const now = new Date();
    setLotNo(`LOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(nextId).padStart(3, '0')}`);
  }, [preps]);

  useEffect(() => {
    if (mode === 'stock') {
      if (curLoc === 'ห้องจ่ายยาผู้ป่วยนอก') setRoom('คลินิกตา');
      else if (curLoc === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || curLoc === 'ห้องยาในศัลยกรรม') setRoom('ห้องจ่ายยาอุบัติเหตุฉุกเฉิน');
      else setRoom('');
    }
  }, [mode, curLoc]);

  const selectedFormula = formulas.find(f => f.id === +formulaId);

  useEffect(() => {
    setChemicalItems(chemicalItemsFromIngredients(selectedFormula?.ingredients ?? null));
  }, [selectedFormula?.id]);

  const updateChemicalItem = (index: number, field: keyof ChemicalItem, value: string) => {
    setChemicalItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  // Helper to render ingredients/method
  const renderIngredients = (str: string | null) => {
    if (!str) return '-';
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return (
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {parsed.map((p, i) => (
              <li key={i}>{p.name} {p.amount ? `(${multiplyAmount(p.amount, qty)})` : ''}</li>
            ))}
          </ul>
        );
      }
    } catch {}
    return <pre style={{ fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', margin: 0 }}>{str}</pre>;
  };

  const renderMethod = (str: string | null) => {
    if (!str) return '-';
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return (
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            {parsed.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        );
      }
    } catch {}
    return <pre style={{ fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', margin: 0 }}>{str}</pre>;
  };

  const normalizeHn = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 9) return '';
    return digits.padStart(9, '0');
  };

  const doSave = async (): Promise<boolean> => {
    if (saving) return false;
    if (!selectedFormula) { toast('กรุณาเลือกสูตรตำรับยา', 'error'); return false; }
    if (!lotNo.trim()) { toast('กรุณากรอก Lot No.', 'error'); return false; }
    let target = '';
    let normalizedHn = '';
    if (mode === 'patient') {
      normalizedHn = normalizeHn(hn);
      if (!normalizedHn || !patientName.trim()) {
        toast('กรุณากรอก HN อย่างน้อย 7 หลัก และชื่อผู้ป่วย', 'error'); return false;
      }
      target = `HN: ${normalizedHn} - ${patientName.trim()}`;
    } else {
      if (!room) { toast('กรุณาเลือกห้องปลายทาง', 'error'); return false; }
      target = `Stock → ${room}`;
    }

    const preparedChemicalItems = cleanChemicalItems(chemicalItems);
    const firstChemicalItem = preparedChemicalItems[0];
    const payload: PrepPayload = {
      formula_id: selectedFormula.id,
      formula_name: selectedFormula.name,
      concentration: selectedFormula.concentration,
      mode,
      target,
      hn: mode === 'patient' ? normalizedHn : '',
      patient_name: mode === 'patient' ? patientName.trim() : '',
      dest_room: mode === 'stock' ? room : '',
      lot_no: lotNo.trim(),
      date,
      expiry_date: addDays(date, selectedFormula.expiry_days),
      qty,
      note: note.trim(),
      prepared_by: user?.name || '',
      user_pha_id: user?.pha_id || '',
      location: curLoc,
      chemical_items: preparedChemicalItems,
      ...(firstChemicalItem?.lot_no ? { chemical_lot_no: firstChemicalItem.lot_no } : {}),
      ...(firstChemicalItem?.expiry_date ? { chemical_expiry_date: firstChemicalItem.expiry_date } : {}),
      ...(mode === 'stock' && isExpired ? { is_expired: true } : {}),
    };

    setSaving(true);
    openLoadingModal('กำลังบันทึกรายการผลิตยา...');
    try {
      const ok = await createPrep(payload);
      if (ok === true) {
        toast(`บันทึกสำเร็จ: ${payload.formula_name} (${payload.qty} ขวด)`, 'success');
        setHn('');
        setPatientName('');
        setNote('');
        setChemicalItems(chemicalItemsFromIngredients(selectedFormula.ingredients));
        setQty(1);
        setIsExpired(false);
        return true;
      } else {
        toast(ok, 'error');
        return false;
      }
    } finally {
      closeLoadingModal();
      setSaving(false);
    }
  };

  const handleSave = () => doSave();

  const handleClear = () => {
    setFormulaId('');
    setMode('patient');
    setHn('');
    setPatientName('');
    setRoom('');
    setDate(today());
    setQty(1);
    setNote('');
    setChemicalItems([{ name: '', lot_no: '', expiry_date: '' }]);
    setIsExpired(false);
  };

  const buildPrintSnap = (d: string, exp: string): Prep => {
    const preparedChemicalItems = cleanChemicalItems(chemicalItems);
    const firstChemicalItem = preparedChemicalItems[0];
    const hnNorm = mode === 'patient' ? normalizeHn(hn) : '';
    return {
      id: 0,
      formula_id: selectedFormula!.id,
      formula_name: selectedFormula!.name,
      concentration: selectedFormula!.concentration,
      mode: mode as 'patient' | 'stock',
      target: mode === 'patient' ? `HN: ${hnNorm} - ${patientName}` : `Stock → ${room}`,
      hn: hnNorm,
      patient_name: mode === 'patient' ? patientName : '',
      dest_room: mode === 'stock' ? room : '',
      lot_no: lotNo,
      date: d,
      expiry_date: exp,
      qty,
      note: note.trim(),
      prepared_by: user?.name || '-',
      user_pha_id: user?.pha_id || '',
      location: curLoc,
      chemical_items: preparedChemicalItems,
      chemical_lot_no: firstChemicalItem?.lot_no || undefined,
      chemical_expiry_date: firstChemicalItem?.expiry_date || undefined,
    };
  };

  const handlePrintLabel = async () => {
    if (!selectedFormula) { toast('กรุณาเลือกสูตรตำรับยาก่อน', 'error'); return; }
    if (mode === 'patient' && (!normalizeHn(hn) || !patientName.trim())) {
      toast('กรุณากรอก HN อย่างน้อย 7 หลัก และชื่อผู้ป่วยก่อนพิมพ์', 'error'); return;
    }
    if (mode === 'stock' && !room) { toast('กรุณาเลือกห้องปลายทางก่อนพิมพ์', 'error'); return; }

    const d = date || today();
    const exp = addDays(d, selectedFormula.expiry_days);
    const snap = buildPrintSnap(d, exp);
    setPrintMockPrep(snap);
    setPrintTitle('ฉลากยา (Patient Label)');
    const pn = mode === 'patient' ? (patientName || '-') : 'Stock';
    const hnVal = mode === 'patient' ? (normalizeHn(hn) || '-') : '-';
    setPrintContent(`<div class="label-preview"><div class="lb"><div class="row"><span>ชื่อยา:</span><strong>${selectedFormula.name}</strong></div><div class="row"><span>ความเข้มข้น:</span><strong>${selectedFormula.concentration}</strong></div><div class="row"><span>ผู้ป่วย:</span><strong>${pn}${hnVal !== '-' ? ' (HN: ' + hnVal + ')' : ''}</strong></div><div class="row"><span>Lot No.:</span><span>${lotNo}</span></div><div class="row"><span>วันที่เตรียม:</span><span>${fmtDate(d)}</span></div><div class="row" style="color:var(--accent-red);font-weight:600"><span>วันหมดอายุ:</span><span>${fmtDate(exp)}</span></div><div class="row"><span>วิธีใช้:</span><span>หยอดตาตามแพทย์สั่ง</span></div><div class="row"><span>การเก็บรักษา:</span><span>เก็บในตู้เย็น 2-8°C</span></div></div><div class="lf">ผู้เตรียม: ${user?.name || '-'} | ${curLoc}</div></div>`);
    await doSave();
    setPrintModal(true);
  };

  const handlePrintBatch = async () => {
    if (!selectedFormula) { toast('กรุณาเลือกสูตรตำรับยาก่อน', 'error'); return; }
    if (mode === 'patient' && (!normalizeHn(hn) || !patientName.trim())) {
      toast('กรุณากรอก HN อย่างน้อย 7 หลัก และชื่อผู้ป่วยก่อนพิมพ์', 'error'); return;
    }
    if (mode === 'stock' && !room) { toast('กรุณาเลือกห้องปลายทางก่อนพิมพ์', 'error'); return; }

    const d = date || today();
    const exp = addDays(d, selectedFormula.expiry_days);
    const snap = buildPrintSnap(d, exp);
    setPrintMockPrep(snap);
    setPrintTitle('ใบสูตรผลิต (Batch Sheet)');
    setPrintContent(generateBatchSheetHtml(snap, selectedFormula));
    await doSave();
    setPrintModal(true);
  };

  const doPrint = () => {
    if (printTitle.includes('Label') && printMockPrep && selectedFormula) {
      const patientHtml = generateLabelHtml(printMockPrep, selectedFormula);
      const bottleHtml = generateBottleLabelsHtml(printMockPrep, selectedFormula);
      const prepStickersHtml = generatePrepStickersHtml(printMockPrep, selectedFormula);
      printAllLabels(patientHtml, bottleHtml, prepStickersHtml);
    } else {
      // Batch sheet — existing behavior
      const w = window.open('', '_blank', 'width=600,height=800');
      if (!w) return;
      w.document.write(`<html><head><title>พิมพ์</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>body{font-family:'Sarabun',sans-serif;padding:20px}pre{font-family:'Sarabun',sans-serif;white-space:pre-wrap}</style></head><body>${printContent}</body></html>`);
      w.document.close();
      w.onload = () => w.print();
    }
  };

  return (
    <div className="page-section">
      <div className="page-actions">
        <RefreshButton
          refreshing={isRefreshing}
          onClick={() => {
            fetchFormulas(true);
            fetchPreps(true);
          }}
        />
      </div>

      {formulasLoading || prepsLoading ? (
        <LoadingState title="กำลังเตรียมข้อมูลสำหรับบันทึกยา" description="กำลังโหลดสูตรตำรับและเลขล็อตล่าสุดจากฐานข้อมูล" />
      ) : (
        <>
      <div className="card prepare-card">
        <div className="card-header"><h3>เตรียมยาตาเฉพาะราย</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label>เลือกสูตรตำรับยา <span className="req">*</span></label>
            <Combobox 
              options={formulas.map(f => ({ value: f.id, label: `${f.name} (${f.concentration})`, code: f.code }))}
              value={+formulaId}
              onChange={val => setFormulaId(val.toString())}
              placeholder="-- ค้นหาสูตรตำรับ (ชื่อ หรือ รหัส) --"
            />
          </div>

          <div className="form-group">
            <label>รูปแบบการเตรียม <span className="req">*</span></label>
            <div className="toggle-group prepare-mode-toggle">
              <div className={`toggle-option patient${mode === 'patient' ? ' active' : ''}`} onClick={() => setMode('patient')}>เฉพาะราย (Patient)</div>
              <div className={`toggle-option stock${mode === 'stock' ? ' active' : ''}`} onClick={() => setMode('stock')}>Stock</div>
            </div>
          </div>

          {mode === 'patient' && (
            <div className="form-row">
              <div className="form-group">
                <label>HN ผู้ป่วย <span className="req">*</span></label>
                <input
                  className="form-input"
                  placeholder="เช่น 1234567 (กรอก 7-9 หลัก)"
                  value={hn}
                  maxLength={9}
                  inputMode="numeric"
                  onChange={e => setHn(e.target.value.replace(/\D/g, '').slice(0, 9))}
                />
              </div>
              <div className="form-group">
                <label>ชื่อ-นามสกุล <span className="req">*</span></label>
                <input className="form-input" placeholder="เช่น สมชาย ใจดี" value={patientName} onChange={e => setPatientName(e.target.value)} />
              </div>
            </div>
          )}

          {mode === 'stock' && (
            <>
              <div className="form-group">
                <label>ห้องปลายทาง <span className="req">*</span></label>
                <input className="form-input" value={room} readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }} />
              </div>
              <div className="form-group">
                <label className="switch-label">
                  <span>เตรียมทดแทนขวดที่หมดอายุ</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isExpired}
                    className={`switch-toggle${isExpired ? ' active' : ''}`}
                    onClick={() => setIsExpired(v => !v)}
                  >
                    <span className="switch-knob" />
                  </button>
                </label>
                {isExpired && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--accent-red)' }}>
                    ยาขวดนี้เตรียมขึ้นเพื่อทดแทนขวดเดิมที่หมดอายุโดยยังไม่ได้ใช้ — นับเป็นมูลค่าสูญเสีย
                  </p>
                )}
              </div>
            </>
          )}

          <div className="form-row-3">
            <div className="form-group">
              <label>Lot No. <span className="req">*</span></label>
              <input
                className="form-input"
                value={lotNo}
                readOnly
                aria-readonly="true"
                style={{ backgroundColor: '#f8fafc', color: '#64748b', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="form-group">
              <label>วันที่เตรียม</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>จำนวน (ขวด)</label>
              <input className="form-input" type="number" min="1" value={qty} onChange={e => setQty(+e.target.value || 1)} />
            </div>
          </div>

          <div className="form-group">
            <label className="chemical-section-title">สารเคมีที่ใช้เตรียม</label>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <div>ชื่อสารเคมี</div>
                <div>Lot No. <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(ไม่บังคับ)</span></div>
                <div>Exp. <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(ไม่บังคับ)</span></div>
              </div>
              {chemicalItems.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      className="form-input"
                      placeholder="ชื่อสารเคมีจากสูตรตำรับ"
                      value={item.name}
                      readOnly
                      aria-readonly="true"
                      style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      className="form-input"
                      placeholder="เช่น CHEM-2026-001"
                      value={item.lot_no}
                      onChange={e => updateChemicalItem(index, 'lot_no', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      className="form-input"
                      type="date"
                      value={item.expiry_date}
                      onChange={e => updateChemicalItem(index, 'expiry_date', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>หมายเหตุ</label>
            <textarea className="form-textarea" rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {selectedFormula && (
            <div className="prepare-formula-panel-wrap">
              <div className="prepare-formula-panel">
                <h4 style={{ fontSize: '14px', color: 'var(--accent-blue)', marginBottom: '10px' }}>รายละเอียดสูตรตำรับ</h4>
                <div className="prepare-formula-grid" style={{ fontSize: '13px' }}>
                  <div><strong>ชื่อ:</strong> {selectedFormula.name}</div>
                  <div><strong>ความเข้มข้น:</strong> {selectedFormula.concentration}</div>
                  <div>
                    <strong>อายุยา:</strong> {Math.abs(selectedFormula.expiry_days)} {selectedFormula.expiry_days < 0 ? 'ชั่วโมง' : 'วัน'}
                  </div>
                  <div><strong>ราคา:</strong> {selectedFormula.price > 0 ? selectedFormula.price + ' บาท' : 'ไม่คิดค่าใช้จ่าย'}</div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '13px' }}>
                  <strong>ส่วนประกอบ:</strong>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {renderIngredients(selectedFormula.ingredients)}
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <strong>วิธีเตรียม:</strong>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {renderMethod(selectedFormula.method)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="prepare-action-row">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="btn-spinner" /> กำลังบันทึก...</> : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>บันทึก</>}
            </button>
            <button className="btn btn-success" onClick={handlePrintLabel} disabled={saving}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              พิมพ์ฉลากยา
            </button>
            <button className="btn btn-outline" onClick={handlePrintBatch} disabled={saving}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              พิมพ์ใบสูตรผลิต
            </button>
            <button className="btn btn-outline" onClick={handleClear} disabled={saving} style={{ marginLeft: 'auto', color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              ล้างฟอร์ม
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={printModal} onClose={() => setPrintModal(false)} title={printTitle}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setPrintModal(false)}>ปิด</button>
            <button className="btn btn-primary" onClick={doPrint}>พิมพ์</button>
          </>
        }
        width="520px"
      >
        <div dangerouslySetInnerHTML={{ __html: printContent }} />
      </Modal>
        </>
      )}
    </div>
  );
}
