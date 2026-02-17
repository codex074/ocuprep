import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useFormulas } from '../hooks/useFormulas';
import { usePreps } from '../hooks/usePreps';
import { today, addDays, fmtDate, fmtDateTime } from '../lib/utils';
import { generateLabelHtml, generateBottleLabelsHtml, printAllLabels } from '../lib/print';
import Modal from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';

export default function PreparePage() {
  const { user, location: curLoc } = useAuth();
  const { toast } = useToast();
  const { formulas } = useFormulas();
  const { preps, createPrep } = usePreps();
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

  // ... (existing code for useEffect, helpers, etc. stays the same, I will use replace_file_content carefully)

  // Wait, I should not replace the whole file or large chunks if not needed.
  // The tool instructions say: "StartLine and EndLine should specify a range of lines containing precisely the instances of TargetContent that you wish to edit."
  // I will make two separate edits: one for import, one for the usage.
  // Actually, I can do it in two steps or use multi_replace if I was using that tool, but here I will use replace_file_content for each.
  
  // Let's do the import first.


  useEffect(() => {
    const nextId = preps.length > 0 ? Math.max(...preps.map(p => p.id)) + 1 : 1;
    const now = new Date();
    setLotNo(`LOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(nextId).padStart(3, '0')}`);
  }, [preps]);

  useEffect(() => {
    if (mode === 'stock') {
      if (curLoc === 'ห้องจ่ายยาผู้ป่วยนอก') setRoom('คลินิกตา');
      else if (curLoc === 'ห้องยาในศัลยกรรม') setRoom('ห้องจ่ายยาอุบัติเหตุฉุกเฉิน');
      else setRoom('');
    }
  }, [mode, curLoc]);

  const selectedFormula = formulas.find(f => f.id === +formulaId);

  // Helper to render ingredients/method
  const renderIngredients = (str: string | null) => {
    if (!str) return '-';
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return (
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {parsed.map((p, i) => (
              <li key={i}>{p.name} {p.amount ? `(${p.amount})` : ''}</li>
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

  // Helper for printing
  const getIngredientsHtml = (str: string | null) => {
    if (!str) return '-';
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return `<ul style="margin:0;padding-left:20px">${parsed.map(p => `<li>${p.name} ${p.amount ? `(${p.amount})` : ''}</li>`).join('')}</ul>`;
      }
    } catch {}
    return `<pre style="font-family:Sarabun,sans-serif;white-space:pre-wrap;margin:0">${str}</pre>`;
  };

  const getMethodHtml = (str: string | null) => {
    if (!str) return '-';
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return `<ol style="margin:0;padding-left:20px">${parsed.map(p => `<li>${p}</li>`).join('')}</ol>`;
      }
    } catch {}
    return `<pre style="font-family:Sarabun,sans-serif;white-space:pre-wrap;margin:0">${str}</pre>`;
  };

  const handleSave = async () => {
    if (!selectedFormula) { toast('กรุณาเลือกสูตรตำรับยา', 'error'); return; }
    if (!lotNo.trim()) { toast('กรุณากรอก Lot No.', 'error'); return; }
    let target = '';
    if (mode === 'patient') {
      if (!hn.trim() || !patientName.trim()) { toast('กรุณากรอก HN และชื่อผู้ป่วย', 'error'); return; }
      target = `HN: ${hn.trim()} - ${patientName.trim()}`;
    } else {
      if (!room) { toast('กรุณาเลือกห้องปลายทาง', 'error'); return; }
      target = `Stock → ${room}`;
    }

    const ok = await createPrep({
      formula_id: selectedFormula.id,
      formula_name: selectedFormula.name,
      concentration: selectedFormula.concentration,
      mode,
      target,
      hn: mode === 'patient' ? hn.trim() : '',
      patient_name: mode === 'patient' ? patientName.trim() : '',
      dest_room: mode === 'stock' ? room : '',
      lot_no: lotNo.trim(),
      date,
      expiry_date: addDays(date, selectedFormula.expiry_days), // addDays now handles negative (hours) logic
      qty,
      note: note.trim(),
      prepared_by: user?.name || '',
      location: curLoc,
    });

    if (ok) {
      toast(`บันทึกสำเร็จ: ${selectedFormula.name} (${qty} ขวด)`, 'success');
      setHn(''); setPatientName(''); setNote(''); setQty(1);
    } else {
      toast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  const handlePrintLabel = () => {
    if (!selectedFormula) { toast('กรุณาเลือกสูตรตำรับยาก่อน', 'error'); return; }
    const d = date || today();
    // Use full datetime for expiration if it's hours (negative days)
    const isHours = selectedFormula.expiry_days < 0;
    const exp = addDays(d, selectedFormula.expiry_days);
    const expStr = isHours ? fmtDateTime(exp) : fmtDate(exp);
    const dateStr = fmtDate(d);

    const pn = mode === 'patient' ? (patientName || '-') : 'Stock';
    const hnVal = mode === 'patient' ? (hn || '-') : '-';
    setPrintTitle('ฉลากยา (Patient Label)');
    
    setPrintContent(`<div class="label-preview"><div class="lb"><div class="row"><span>ชื่อยา:</span><strong>${selectedFormula.name}</strong></div><div class="row"><span>ความเข้มข้น:</span><strong>${selectedFormula.concentration}</strong></div><div class="row"><span>ผู้ป่วย:</span><strong>${pn}${hnVal !== '-' ? ' (HN: ' + hnVal + ')' : ''}</strong></div><div class="row"><span>Lot No.:</span><span>${lotNo}</span></div><div class="row"><span>วันที่เตรียม:</span><span>${dateStr}</span></div><div class="row" style="color:var(--accent-red);font-weight:600"><span>วันหมดอายุ:</span><span>${expStr}</span></div><div class="row"><span>วิธีใช้:</span><span>หยอดตาตามแพทย์สั่ง</span></div><div class="row"><span>การเก็บรักษา:</span><span>เก็บในตู้เย็น 2-8°C</span></div></div><div class="lf">ผู้เตรียม: ${user?.name || '-'} | ${curLoc}</div></div>`);
    setPrintModal(true);
  };

  const handlePrintBatch = () => {
    if (!selectedFormula) { toast('กรุณาเลือกสูตรตำรับยาก่อน', 'error'); return; }
    const d = date || today();
    const isHours = selectedFormula.expiry_days < 0;
    const exp = addDays(d, selectedFormula.expiry_days);
    const expStr = isHours ? fmtDateTime(exp) : fmtDate(exp);

    setPrintTitle('ใบสูตรผลิต (Batch Sheet)');
    
    const ingHtml = getIngredientsHtml(selectedFormula.ingredients);
    const metHtml = getMethodHtml(selectedFormula.method);

    setPrintContent(`<div style="border:2px solid #333;border-radius:8px;padding:24px;font-size:13px;line-height:1.8"><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px"><h3 style="font-size:16px">ใบสูตรผลิต (Batch Production Record)</h3><p style="color:#666">โรงพยาบาลอุตรดิตถ์ — กลุ่มงานเภสัชกรรม</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px"><div><strong>ชื่อตำรับ:</strong> ${selectedFormula.name}</div><div><strong>ความเข้มข้น:</strong> ${selectedFormula.concentration}</div><div><strong>Lot No.:</strong> ${lotNo}</div><div><strong>จำนวน:</strong> ${qty} ขวด</div><div><strong>วันที่ผลิต:</strong> ${fmtDate(d)}</div><div><strong>วันหมดอายุ:</strong> ${expStr}</div></div><div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:16px"><h4 style="font-size:14px;margin-bottom:8px">ส่วนประกอบ</h4><div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #eee">${ingHtml}</div></div><div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:16px"><h4 style="font-size:14px;margin-bottom:8px">วิธีเตรียม</h4><div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #eee">${metHtml}</div></div><div style="border-top:2px solid #333;padding-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px"><div style="text-align:center"><div style="border-bottom:1px solid #999;height:50px"></div><strong>ผู้เตรียม (Prepared by)</strong><div style="color:#666;font-size:11px">วันที่: ____/____/____</div></div><div style="text-align:center"><div style="border-bottom:1px solid #999;height:50px"></div><strong>ผู้ตรวจสอบ (Checked by)</strong><div style="color:#666;font-size:11px">วันที่: ____/____/____</div></div></div></div>`);
    setPrintModal(true);
  };

  const doPrint = () => {
    // If printing patient label, combine with bottle labels
    if (printTitle.includes('Label') && selectedFormula) {
      const d = date || today();
      const exp = addDays(d, selectedFormula.expiry_days);
      const mockPrep = {
        id: 0, formula_id: selectedFormula.id, formula_name: selectedFormula.name,
        concentration: selectedFormula.concentration, mode: mode as 'patient' | 'stock',
        target: mode === 'patient' ? `HN: ${hn} - ${patientName}` : `Stock → ${room}`,
        hn: mode === 'patient' ? hn : '', patient_name: mode === 'patient' ? patientName : '',
        dest_room: mode === 'stock' ? room : '',
        lot_no: lotNo, date: d, expiry_date: exp, qty, note: '',
        prepared_by: user?.name || '-', location: curLoc,
      };
      const patientHtml = generateLabelHtml(mockPrep);
      const bottleHtml = generateBottleLabelsHtml(mockPrep, selectedFormula);
      printAllLabels(patientHtml, bottleHtml);
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
      <div className="card">
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
            <div className="toggle-group">
              <div className={`toggle-option${mode === 'patient' ? ' active' : ''}`} onClick={() => setMode('patient')}>เฉพาะราย (Patient)</div>
              <div className={`toggle-option${mode === 'stock' ? ' active' : ''}`} onClick={() => setMode('stock')}>Stock</div>
            </div>
          </div>

          {mode === 'patient' && (
            <div className="form-row">
              <div className="form-group">
                <label>HN ผู้ป่วย <span className="req">*</span></label>
                <input className="form-input" placeholder="เช่น 12345678" value={hn} onChange={e => setHn(e.target.value)} />
              </div>
              <div className="form-group">
                <label>ชื่อ-นามสกุล <span className="req">*</span></label>
                <input className="form-input" placeholder="เช่น สมชาย ใจดี" value={patientName} onChange={e => setPatientName(e.target.value)} />
              </div>
            </div>
          )}

          {mode === 'stock' && (
            <div className="form-group">
              <label>ห้องปลายทาง <span className="req">*</span></label>
              <input className="form-input" value={room} readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }} />
            </div>
          )}

          <div className="form-row-3">
            <div className="form-group">
              <label>Lot No. <span className="req">*</span></label>
              <input className="form-input" value={lotNo} onChange={e => setLotNo(e.target.value)} />
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
            <label>หมายเหตุ</label>
            <textarea className="form-textarea" rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {selectedFormula && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--accent-blue)', marginBottom: '10px' }}>รายละเอียดสูตรตำรับ</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
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

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              บันทึก
            </button>
            <button className="btn btn-success" onClick={handlePrintLabel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              พิมพ์ฉลากยา
            </button>
            <button className="btn btn-outline" onClick={handlePrintBatch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              พิมพ์ใบสูตรผลิต
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
    </div>
  );
}
