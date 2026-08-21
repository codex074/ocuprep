import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Combobox from './ui/Combobox';
import { useToast } from '../contexts/ToastContext';
import { openLoadingModal, closeLoadingModal } from '../lib/loadingModal';
import { addDays } from '../lib/utils';
import { cleanChemicalItems, normalizeChemicalItems } from '../lib/chemicalItems';
import type { ChemicalItem, Prep } from '../types';
import type { Formula } from '../types';

interface EditPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  prep: Prep | null;
  formulas: Formula[];
  onUpdate: (id: number, updates: Partial<Prep>) => Promise<boolean>;
}

const STATION_OPTIONS = [
  { value: 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม', label: 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม (ปิดใช้งาน)' },
  { value: 'ห้องจ่ายยาผู้ป่วยใน', label: 'ห้องจ่ายยาผู้ป่วยใน (Inpatient Pharmacy)' },
  { value: 'ห้องจ่ายยาผู้ป่วยนอก', label: 'ห้องจ่ายยาผู้ป่วยนอก' },
  { value: 'ห้องเคมีบำบัด', label: 'ห้องเคมีบำบัด' },
];

type HnStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'offline';

const normalizeHn = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 9) return '';
  return digits.padStart(9, '0');
};

export default function EditPrepModal({ isOpen, onClose, prep, formulas, onUpdate }: EditPrepModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [hnStatus, setHnStatus] = useState<HnStatus>('idle');
  const [form, setForm] = useState({
    formula_id: 0,
    mode: 'patient' as 'patient' | 'stock',
    location: '',
    date: '', lot_no: '', qty: 1, expiry_date: '', note: '',
    chemical_items: [{ name: '', lot_no: '', expiry_date: '' }] as ChemicalItem[],
    chemical_lot_no: '', chemical_expiry_date: '',
    hn: '', patient_name: '', dest_room: '',
    is_expired: false
  });

  useEffect(() => {
    if (prep) {
      setForm({
        formula_id: prep.formula_id,
        mode: prep.mode,
        location: prep.location || '',
        date: prep.date,
        lot_no: prep.lot_no,
        qty: prep.qty || 1,
        expiry_date: prep.expiry_date || '',
        note: prep.note || '',
        chemical_items: normalizeChemicalItems(prep.chemical_items, prep.chemical_lot_no, prep.chemical_expiry_date),
        chemical_lot_no: prep.chemical_lot_no || '',
        chemical_expiry_date: prep.chemical_expiry_date || '',
        hn: prep.hn || '',
        patient_name: prep.patient_name || '',
        dest_room: prep.dest_room || '',
        is_expired: prep.is_expired ?? false
      });
      setHnStatus('idle');
    }
  }, [prep]);

  const selectedFormula = formulas.find((formula) => formula.id === form.formula_id)
    ?? formulas.find((formula) => formula.id === prep?.formula_id)
    ?? null;

  useEffect(() => {
    if (!selectedFormula || !form.date) return;
    const nextExpiryDate = addDays(form.date, selectedFormula.expiry_days);
    setForm((current) => current.expiry_date === nextExpiryDate
      ? current
      : { ...current, expiry_date: nextExpiryDate });
  }, [form.date, selectedFormula]);

  useEffect(() => {
    if (form.mode !== 'stock') return;

    const nextDestRoom = form.location === 'ห้องจ่ายยาผู้ป่วยนอก'
      ? 'คลินิกตา'
      : form.location === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || form.location === 'ห้องยาในศัลยกรรม' || form.location === 'ห้องจ่ายยาผู้ป่วยใน'
        ? 'ห้องจ่ายยาผู้ป่วยใน'
        : '';

    setForm((current) => current.dest_room === nextDestRoom
      ? current
      : { ...current, dest_room: nextDestRoom });
  }, [form.location, form.mode]);

  const updateChemicalItem = (index: number, field: keyof ChemicalItem, value: string) => {
    setForm((current) => ({
      ...current,
      chemical_items: current.chemical_items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  };

  const lookupPatientByHN = async (rawHn: string) => {
    const digits = rawHn.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 9) return;

    setHnStatus('loading');
    try {
      let ok = false;
      let fullName = '';

      let failure = false;

      if (window.electronAPI?.lookupHN) {
        const result = await window.electronAPI.lookupHN(digits);
        ok = result.ok;
        fullName = result.patient?.fullName ?? '';
        failure = Boolean(result.failure);
      } else {
        const response = await fetch(
          `http://127.0.0.1:3100/api/patient?q=${encodeURIComponent(digits)}`,
          { signal: AbortSignal.timeout(5000) },
        );
        const data = await response.json() as { ok: boolean; patient?: { fullName: string } };
        ok = data.ok;
        fullName = data.patient?.fullName ?? '';
      }

      if (ok && fullName) {
        setForm((current) => (
          current.hn.replace(/\D/g, '') === digits
            ? { ...current, patient_name: fullName }
            : current
        ));
        setHnStatus('found');
      } else if (failure) {
        setHnStatus('offline');
      } else {
        setHnStatus('notfound');
      }
    } catch {
      setHnStatus('offline');
    }
  };

  const handleSave = async () => {
    if (!prep || saving) return;
    if (!selectedFormula) {
      toast('กรุณาเลือกสูตรยา', 'error');
      return;
    }
    if (!form.location) {
      toast('กรุณาเลือกห้องทำงาน', 'error');
      return;
    }

    // Calculate new target string
    let newTarget = prep.target;
    let normalizedHn = '';
    if (form.mode === 'patient') {
      normalizedHn = normalizeHn(form.hn);
      if (!normalizedHn || !form.patient_name.trim()) {
        toast('กรุณากรอก HN อย่างน้อย 7 หลัก และชื่อผู้ป่วย', 'error');
        return; 
      }
      newTarget = `HN: ${normalizedHn} - ${form.patient_name.trim()}`;
    } else {
      if (!form.dest_room) {
        toast('ไม่สามารถกำหนดห้องปลายทางจากห้องทำงานได้', 'error');
        return;
      }
      newTarget = `Stock → ${form.dest_room}`;
    }

    const chemicalItems = cleanChemicalItems(form.chemical_items);
    const firstChemicalItem = chemicalItems[0];
    const updates = {
      ...form,
      formula_id: selectedFormula.id,
      formula_name: selectedFormula.name,
      concentration: selectedFormula.concentration,
      location: form.location,
      target: newTarget,
      qty: +form.qty,
      hn: form.mode === 'patient' ? normalizedHn : '',
      patient_name: form.mode === 'patient' ? form.patient_name.trim() : '',
      dest_room: form.mode === 'stock' ? form.dest_room : '',
      chemical_items: chemicalItems,
      chemical_lot_no: firstChemicalItem?.lot_no || '',
      chemical_expiry_date: firstChemicalItem?.expiry_date || '',
      is_expired: form.mode === 'stock' ? form.is_expired : false,
    };

    setSaving(true);
    openLoadingModal('กำลังบันทึกการแก้ไขรายการ...');
    const ok = await onUpdate(prep.id, updates);
    closeLoadingModal();
    setSaving(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขรายการผลิต" width="760px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="btn-spinner" /> กำลังบันทึก...</> : 'บันทึกการแก้ไข'}
          </button>
        </div>
      }
    >
      <div className="form-group">
        <label>ชื่อยา</label>
        <Combobox
          options={formulas.map((formula) => ({
            value: formula.id,
            label: `${formula.name}${formula.concentration ? ` (${formula.concentration})` : ''}`,
            code: formula.code,
          }))}
          value={form.formula_id}
          onChange={(value) => setForm((current) => ({ ...current, formula_id: Number(value) }))}
          placeholder="ค้นหาสูตรยา (ชื่อ หรือ รหัส)"
        />
      </div>

      <div className="form-group">
        <label>ห้องทำงาน</label>
        <select
          className="form-select"
          value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
        >
          <option value="">เลือกห้องทำงาน</option>
          {STATION_OPTIONS.map((station) => (
            <option key={station.value} value={station.value}>{station.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>รูปแบบการเตรียม</label>
        <div className="toggle-group">
          <div
            className={`toggle-option patient${form.mode === 'patient' ? ' active' : ''}`}
            onClick={() => setForm((current) => ({ ...current, mode: 'patient' }))}
          >
            เฉพาะราย (Patient)
          </div>
          <div
            className={`toggle-option stock${form.mode === 'stock' ? ' active' : ''}`}
            onClick={() => setForm((current) => ({ ...current, mode: 'stock' }))}
          >
            Stock
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>วันที่เตรียม</label>
        <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Lot No.</label>
          <input className="form-input" value={form.lot_no} onChange={e => setForm(f => ({ ...f, lot_no: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>จำนวน (ขวด)</label>
          <input className="form-input" type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: +e.target.value }))} />
        </div>
      </div>
      
      {form.mode === 'patient' ? (
        <div className="form-row">
          <div className="form-group">
            <label>HN ผู้ป่วย <span className="req">*</span></label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="form-input"
                placeholder="เช่น 003812345"
                value={form.hn}
                maxLength={9}
                inputMode="numeric"
                onChange={e => {
                  setForm(current => ({ ...current, hn: e.target.value.replace(/\D/g, '').slice(0, 9) }));
                  setHnStatus('idle');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && form.hn.replace(/\D/g, '').length >= 7) {
                    e.preventDefault();
                    void lookupPatientByHN(form.hn);
                  }
                }}
                onBlur={() => {
                  if (form.hn.replace(/\D/g, '').length >= 7) void lookupPatientByHN(form.hn);
                }}
              />
              <button
                type="button"
                title="ค้นหาชื่อผู้ป่วยจาก HN"
                disabled={hnStatus === 'loading' || form.hn.replace(/\D/g, '').length < 7}
                onClick={() => void lookupPatientByHN(form.hn)}
                style={{ padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
              >
                {hnStatus === 'loading'
                  ? <span className="btn-spinner" />
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                }
              </button>
            </div>
            {hnStatus === 'found' && <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>พบข้อมูลผู้ป่วย — กรอกชื่อโดยอัตโนมัติแล้ว</p>}
            {hnStatus === 'notfound' && <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>ไม่พบ HN นี้ในระบบ — กรอกชื่อด้วยตนเอง</p>}
            {hnStatus === 'offline' && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                {window.electronAPI
                  ? 'ไม่สามารถเชื่อมต่อ HOSxP — ตรวจสอบเครือข่ายภายในหรือติดต่อผู้ดูแลระบบ'
                  : 'ไม่สามารถเชื่อมต่อ HN Lookup — กรุณาเปิดแอป HN Lookup ก่อน'
                }
              </p>
            )}
          </div>
          <div className="form-group">
            <label>ชื่อ-นามสกุล <span className="req">*</span></label>
            <input className="form-input" value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
          </div>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>ห้องปลายทาง</label>
            <input className="form-input" value={form.dest_room} readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }} />
          </div>
          <div className="form-group">
            <label className="switch-label">
              <span>เตรียมทดแทนขวดที่หมดอายุ</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_expired}
                className={`switch-toggle${form.is_expired ? ' active' : ''}`}
                onClick={() => setForm(f => ({ ...f, is_expired: !f.is_expired }))}
              >
                <span className="switch-knob" />
              </button>
            </label>
            {form.is_expired && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--accent-red)' }}>
                ยาขวดนี้เตรียมขึ้นเพื่อทดแทนขวดเดิมที่หมดอายุโดยยังไม่ได้ใช้ — นับเป็นมูลค่าสูญเสีย
              </p>
            )}
          </div>
        </>
      )}

      <div className="form-group">
        <label>วันหมดอายุ</label>
        <input className="form-input" type="text" value={form.expiry_date} readOnly placeholder="YYYY-MM-DD HH:MM" />
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>* ระบบคำนวณอัตโนมัติตามวันที่เตรียมและอายุยาของสูตรที่เลือก</div>
      </div>

      <div className="form-group">
        <label>Lot No. และ Exp. สารเคมีที่ใช้เตรียม</label>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <div>ชื่อสารเคมี</div>
            <div>Lot No.</div>
            <div>Exp.</div>
          </div>
          {form.chemical_items.map((item, index) => (
            <div
              key={index}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  className="form-input"
                  value={item.name}
                  readOnly
                  aria-readonly="true"
                  style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  className="form-input"
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
        <textarea className="form-textarea" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
      </div>
    </Modal>
  );
}
