import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Combobox from './ui/Combobox';
import { useToast } from '../contexts/ToastContext';
import { openLoadingModal, closeLoadingModal } from '../lib/loadingModal';
import { addDays } from '../lib/utils';
import type { Prep } from '../types';
import type { Formula } from '../types';

interface EditPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  prep: Prep | null;
  formulas: Formula[];
  onUpdate: (id: number, updates: Partial<Prep>) => Promise<boolean>;
}

const STATION_OPTIONS = [
  'ห้องจ่ายยาผู้ป่วยในศัลยกรรม',
  'ห้องจ่ายยาผู้ป่วยนอก',
];

export default function EditPrepModal({ isOpen, onClose, prep, formulas, onUpdate }: EditPrepModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    formula_id: 0,
    mode: 'patient' as 'patient' | 'stock',
    location: '',
    date: '', lot_no: '', qty: 1, expiry_date: '', note: '',
    hn: '', patient_name: '', dest_room: ''
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
        hn: prep.hn || '',
        patient_name: prep.patient_name || '',
        dest_room: prep.dest_room || ''
      });
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
      : form.location === 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม' || form.location === 'ห้องยาในศัลยกรรม'
        ? 'ห้องจ่ายยาอุบัติเหตุฉุกเฉิน'
        : '';

    setForm((current) => current.dest_room === nextDestRoom
      ? current
      : { ...current, dest_room: nextDestRoom });
  }, [form.location, form.mode]);

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
    if (form.mode === 'patient') {
      if (!form.hn.trim() || !form.patient_name.trim()) { 
        toast('กรุณากรอก HN และชื่อผู้ป่วย', 'error'); 
        return; 
      }
      newTarget = `HN: ${form.hn.trim()} - ${form.patient_name.trim()}`;
    } else {
      if (!form.dest_room) {
        toast('ไม่สามารถกำหนดห้องปลายทางจากห้องทำงานได้', 'error');
        return;
      }
      newTarget = `Stock → ${form.dest_room}`;
    }

    const updates = {
      ...form,
      formula_id: selectedFormula.id,
      formula_name: selectedFormula.name,
      concentration: selectedFormula.concentration,
      location: form.location,
      target: newTarget,
      qty: +form.qty,
      hn: form.mode === 'patient' ? form.hn.trim() : '',
      patient_name: form.mode === 'patient' ? form.patient_name.trim() : '',
      dest_room: form.mode === 'stock' ? form.dest_room : '',
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
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขรายการผลิต" width="500px"
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
            <option key={station} value={station}>{station}</option>
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
            <label>HN</label>
            <input className="form-input" value={form.hn} onChange={e => setForm(f => ({ ...f, hn: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <div className="form-group">
            <label>ชื่อผู้ป่วย</label>
            <input className="form-input" value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label>ห้องปลายทาง</label>
          <input className="form-input" value={form.dest_room} readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }} />
        </div>
      )}

      <div className="form-group">
        <label>วันหมดอายุ</label>
        <input className="form-input" type="text" value={form.expiry_date} readOnly placeholder="YYYY-MM-DD HH:MM" />
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>* ระบบคำนวณอัตโนมัติตามวันที่เตรียมและอายุยาของสูตรที่เลือก</div>
      </div>

      <div className="form-group">
        <label>หมายเหตุ</label>
        <textarea className="form-textarea" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
      </div>
    </Modal>
  );
}
