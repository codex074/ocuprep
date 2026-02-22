import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { useToast } from '../contexts/ToastContext';
import type { Prep } from '../types';

interface EditPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  prep: Prep | null;
  onUpdate: (id: number, updates: Partial<Prep>) => Promise<boolean>;
}

export default function EditPrepModal({ isOpen, onClose, prep, onUpdate }: EditPrepModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    date: '', lot_no: '', qty: 1, expiry_date: '', note: '',
    hn: '', patient_name: '', dest_room: ''
  });

  useEffect(() => {
    if (prep) {
      setForm({
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

  const handleSave = async () => {
    if (!prep) return;

    // Calculate new target string
    let newTarget = prep.target;
    if (prep.mode === 'patient') {
      if (!form.hn.trim() || !form.patient_name.trim()) { 
        toast('กรุณากรอก HN และชื่อผู้ป่วย', 'error'); 
        return; 
      }
      newTarget = `HN: ${form.hn.trim()} - ${form.patient_name.trim()}`;
    } else {
      if (form.dest_room) {
        newTarget = `Stock → ${form.dest_room}`;
      }
    }

    const updates = {
      ...form,
      target: newTarget,
      qty: +form.qty,
    };

    const ok = await onUpdate(prep.id, updates);
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขรายการผลิต" width="500px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave}>บันทึกการแก้ไข</button>
        </div>
      }
    >
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
      
      {prep?.mode === 'patient' ? (
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
          <input className="form-input" value={form.dest_room} onChange={e => setForm(f => ({ ...f, dest_room: e.target.value }))} />
        </div>
      )}

      <div className="form-group">
        <label>วันหมดอายุ</label>
        <input className="form-input" type="text" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} placeholder="YYYY-MM-DD HH:MM" />
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>* ควรระรุในรูปแบบ YYYY-MM-DD หรือ YYYY-MM-DD HH:mm</div>
      </div>

      <div className="form-group">
        <label>หมายเหตุ</label>
        <textarea className="form-textarea" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
      </div>
    </Modal>
  );
}
