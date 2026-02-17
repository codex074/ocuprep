import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useFormulas } from '../hooks/useFormulas';
import Modal from '../components/ui/Modal';
import type { Formula } from '../types';

export default function FormulasPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formulas, createFormula, updateFormula, deleteFormula } = useFormulas();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  
  // Password modal state
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'save' | 'delete' | null>(null);
  const [form, setForm] = useState<{
    code: string;
    name: string;
    short_name: string;
    description: string;
    concentration: string;
    expiry_days: number;
    expiry_unit: 'days' | 'hours';
    price: number;
    category: string;
    storage: string;
    ingredients: { name: string; amount: string }[];
    method: string[];
  }>({ 
    code: '', name: '', short_name: '', description: '', concentration: '', expiry_days: 7, expiry_unit: 'days', price: 0, category: 'antibiotic', storage: 'เก็บในตู้เย็น 2-8°C',
    ingredients: [{ name: '', amount: '' }],
    method: ['']
  });

  const cc: Record<string, string> = { antibiotic: 'blue', antifungal: 'purple', steroid: 'amber', lubricant: 'green', other: 'teal' };
  const cl: Record<string, string> = { antibiotic: 'Antibiotic', antifungal: 'Antifungal', steroid: 'Steroid', lubricant: 'Lubricant', other: 'Other' };

  const parseIngredients = (str: string | null): { name: string; amount: string }[] => {
    if (!str) return [{ name: '', amount: '' }];
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') return parsed;
    } catch {}
    // Fallback for legacy plain text: try to split by newlines or just return as one item
    return str.split('\n').filter(s => s.trim()).map(s => ({ name: s.trim(), amount: '' }));
  };

  const parseMethod = (str: string | null): string[] => {
    if (!str) return [''];
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') return parsed;
    } catch {}
    // Fallback for legacy plain text
    return str.split('\n').filter(s => s.trim());
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ 
      code: '', name: '', short_name: '', description: '', concentration: '', expiry_days: 7, expiry_unit: 'days', price: 0, category: 'antibiotic', storage: 'เก็บในตู้เย็น 2-8°C',
      ingredients: [{ name: '', amount: '' }],
      method: ['']
    });
    setModalOpen(true);
  };

  const openEdit = (f: Formula) => {
    // if (user?.role !== 'admin') { toast('เฉพาะ Admin ที่แก้ไขสูตรได้', 'info'); return; } // Old check
    setEditId(f.id);
    const isHours = f.expiry_days < 0;
    setForm({
      code: f.code || '', name: f.name, short_name: f.short_name || '', description: f.description || '', concentration: f.concentration || '',
      expiry_days: Math.abs(f.expiry_days),
      expiry_unit: isHours ? 'hours' : 'days',
      price: f.price, category: f.category || 'other', storage: f.storage || 'เก็บในตู้เย็น 2-8°C',
      ingredients: parseIngredients(f.ingredients),
      method: parseMethod(f.method)
    });
    setModalOpen(true);
  };

  const confirmAction = async () => {
    console.log('Confirming:', pendingAction, 'input:', password, 'user:', user);
    if (!user || password.trim() !== user.password) {
      toast('รหัสผ่านไม่ถูกต้อง', 'error');
      console.error('Password mismatch');
      return;
    }

    if (pendingAction === 'delete' && editId) {
      console.log('Attempting delete:', editId);
      const ok = await deleteFormula(editId);
      console.log('Delete result:', ok);
      toast(ok ? 'ลบสูตรสำเร็จ' : 'เกิดข้อผิดพลาดในการลบ', ok ? 'success' : 'error');
      if (ok) {
        setModalOpen(false);
        setShowPassword(false);
        setPassword('');
      }
    } else if (pendingAction === 'save') {
      console.log('Attempting save');
      await performSave();
    }
  };

  const performSave = async () => {
    // Filter out empty rows
    const validIngredients = form.ingredients.filter(i => i.name.trim());
    const validMethod = form.method.filter(m => m.trim());

    // Calculate expiry_days for DB (negative if hours)
    let finalExpiry = Math.abs(form.expiry_days) || 7;
    if (form.expiry_unit === 'hours') finalExpiry = -finalExpiry;

    const d = {
      code: form.code.trim(), name: form.name.trim(), short_name: form.short_name.trim(), description: form.description.trim(), concentration: form.concentration.trim(),
      expiry_days: finalExpiry, 
      price: form.price || 0, category: form.category, storage: form.storage.trim(),
      ingredients: JSON.stringify(validIngredients),
      method: JSON.stringify(validMethod)
    };

    let ok: boolean;
    if (editId) {
      ok = await updateFormula(editId, d);
      console.log('Update result:', ok);
      toast(ok ? 'แก้ไขสูตรสำเร็จ' : 'เกิดข้อผิดพลาดในการแก้ไข', ok ? 'success' : 'error');
    } else {
      ok = await createFormula(d);
      toast(ok ? 'เพิ่มสูตรสำเร็จ' : 'เกิดข้อผิดพลาด', ok ? 'success' : 'error');
    }
    
    if (ok) {
      setModalOpen(false);
      setShowPassword(false);
      setPassword('');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('กรุณากรอกชื่อสูตรตำรับ', 'error'); return; }
    
    if (editId) {
      // Require password for edit
      setPendingAction('save');
      setShowPassword(true);
    } else {
      // Direct save for create
      await performSave();
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    setPendingAction('delete');
    setShowPassword(true);
  };

  // Helper fields updater
  const updateIng = (idx: number, field: 'name' | 'amount', val: string) => {
    const next = [...form.ingredients];
    next[idx][field] = val;
    setForm(f => ({ ...f, ingredients: next }));
  };
  const addIng = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: '' }] }));
  const removeIng = (idx: number) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));

  const updateMet = (idx: number, val: string) => {
    const next = [...form.method];
    next[idx] = val;
    setForm(f => ({ ...f, method: next }));
  };
  const addMet = () => setForm(f => ({ ...f, method: [...f.method, ''] }));
  const removeMet = (idx: number) => setForm(f => ({ ...f, method: f.method.filter((_, i) => i !== idx) }));

  return (
    <div className="page-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>สูตรตำรับยาทั้งหมด</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>เพิ่ม แก้ไข หรือลบสูตรตำรับ</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={openAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            เพิ่มสูตรตำรับ
          </button>
        )}
      </div>

      <div className="formula-grid">
        {formulas.map(f => (
          <div className="formula-card" key={f.id} onClick={() => openEdit(f)}>
            <h4>{f.code ? <span style={{ color: 'var(--primary)', marginRight: '6px' }}>[{f.code}]</span> : null}{f.name}</h4>
            <div className="fdesc">{f.description || '-'}</div>
            <div className="fmeta">
              <span className={`badge-tag ${cc[f.category || 'other'] || 'teal'}`}>{cl[f.category || 'other'] || f.category}</span>
              <span className="badge-tag amber">{f.concentration}</span>
              <span className="badge-tag green">อายุ {Math.abs(f.expiry_days)} {f.expiry_days < 0 ? 'ชม.' : 'วัน'}</span>
              {f.price > 0 && <span className="badge-tag red">{f.price} ฿</span>}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? (user?.role === 'admin' ? 'แก้ไขสูตรตำรับ' : 'รายละเอียดสูตรตำรับ') : 'เพิ่มสูตรตำรับยา'}
        width="650px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            {editId && user?.role === 'admin' ? (
              <button className="btn btn-danger" onClick={handleDelete}>ลบสูตร</button>
            ) : <div />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>ปิด</button>
              {user?.role === 'admin' && (
                <button className="btn btn-primary" onClick={handleSave}>บันทึก</button>
              )}
            </div>
          </div>
        }
      >
        <div className="form-row">
          <div className="form-group" style={{ flex: '0 0 120px' }}>
            <label>รหัสยา (Code)</label>
            <input className="form-input" placeholder="เช่น F01" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={user?.role !== 'admin'} />
          </div>
          <div className="form-group">
            <label>ชื่อสูตรตำรับ <span className="req">*</span></label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={user?.role !== 'admin'} />
          </div>
        </div>
        <div className="form-group">
          <label>ชื่อยาย่อ (สำหรับฉลากติดขวด)</label>
          <input className="form-input" placeholder="เช่น Vanco ED" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} disabled={user?.role !== 'admin'} />
        </div>
        <div className="form-group">
          <label>คำอธิบาย</label>
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} disabled={user?.role !== 'admin'} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>ความเข้มข้น</label>
            <input className="form-input" value={form.concentration} onChange={e => setForm(f => ({ ...f, concentration: e.target.value }))} disabled={user?.role !== 'admin'} />
          </div>
          <div className="form-group">
            <label>อายุยา ({form.expiry_unit === 'days' ? 'วัน' : 'ชั่วโมง'})</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" type="number" value={form.expiry_days} onChange={e => setForm(f => ({ ...f, expiry_days: +e.target.value || 0 }))} style={{ flex: 1 }} disabled={user?.role !== 'admin'} />
              <select className="form-select" value={form.expiry_unit} onChange={e => setForm(f => ({ ...f, expiry_unit: e.target.value as 'days' | 'hours' }))} style={{ width: '100px' }} disabled={user?.role !== 'admin'}>
                <option value="days">วัน</option>
                <option value="hours">ชม.</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Ingredients */}
        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>ส่วนประกอบ (Ingredients)</span>
            {user?.role === 'admin' && (
              <button type="button" className="btn btn-sm btn-outline" onClick={addIng} style={{ padding: '2px 8px', fontSize: '11px' }}>+ เพิ่มรายการ</button>
            )}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {form.ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" placeholder="ชื่อสาร" value={ing.name} onChange={e => updateIng(i, 'name', e.target.value)} style={{ flex: 2 }} disabled={user?.role !== 'admin'} />
                <input className="form-input" placeholder="จำนวน/หน่วย" value={ing.amount} onChange={e => updateIng(i, 'amount', e.target.value)} style={{ flex: 1 }} disabled={user?.role !== 'admin'} />
                {user?.role === 'admin' && (
                  <button type="button" className="btn btn-danger" onClick={() => removeIng(i)} style={{ padding: '0 10px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Method */}
        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>วิธีเตรียม (Method)</span>
            {user?.role === 'admin' && (
              <button type="button" className="btn btn-sm btn-outline" onClick={addMet} style={{ padding: '2px 8px', fontSize: '11px' }}>+ เพิ่มขั้นตอน</button>
            )}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {form.method.map((met, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '13px', paddingTop: '10px', color: '#94a3b8', width: '20px' }}>{i + 1}.</span>
                <input className="form-input" placeholder="ขั้นตอนการผลิต..." value={met} onChange={e => updateMet(i, e.target.value)} style={{ flex: 1 }} disabled={user?.role !== 'admin'} />
                {user?.role === 'admin' && (
                  <button type="button" className="btn btn-danger" onClick={() => removeMet(i)} style={{ padding: '0 10px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>ราคา (บาท)</label>
            <input className="form-input" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value || 0 }))} disabled={user?.role !== 'admin'} />
          </div>
          <div className="form-group">
            <label>หมวดหมู่</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} disabled={user?.role !== 'admin'}>
              <option value="antibiotic">Antibiotic</option>
              <option value="antifungal">Antifungal</option>
              <option value="steroid">Steroid</option>
              <option value="lubricant">Lubricant</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>การเก็บรักษา (Storage)</label>
          <input className="form-input" placeholder="เช่น เก็บในตู้เย็น 2-8°C" value={form.storage} onChange={e => setForm(f => ({ ...f, storage: e.target.value }))} disabled={user?.role !== 'admin'} />
        </div>
      </Modal>

      <Modal isOpen={showPassword} onClose={() => setShowPassword(false)}
        title="ยืนยันรหัสผ่าน"
        width="400px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowPassword(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={confirmAction}>ยืนยัน</button>
          </>
        }
      >
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            {pendingAction === 'delete' ? 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบ' : 'กรุณากรอกรหัสผ่านเพื่อบันทึกการแก้ไข'}
          </p>
          <input 
            type="password" 
            className="form-input" 
            placeholder="รหัสผ่าน Admin" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmAction()}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
