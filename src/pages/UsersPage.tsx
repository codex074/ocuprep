import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useUsers } from '../hooks/useUsers';
import { resolvePath } from '../lib/utils';
import Modal from '../components/ui/Modal';
import ProfileCard from '../components/ProfileCard';
import type { User } from '../types';
import Swal from 'sweetalert2';

export default function UsersPage() {
  const { user: curUser } = useAuth();
  const { toast } = useToast();
  const { users, createUser, updateUser, toggleUser, deleteUser } = useUsers();
  
  // Edit/Create state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', pha_id: '', password: '', role: 'user' as 'admin' | 'user', profile_image: '' });

  // View state
  const [viewUser, setViewUser] = useState<User | null>(null);

  const cols = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0D9488'];

  const handleSave = async () => {
    if (!form.name.trim() || !form.pha_id.trim()) {
      toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return;
    }

    if (editId) {
      // Edit mode
      const updates: any = { 
        name: form.name.trim(), 
        pha_id: form.pha_id.trim(), 
        role: form.role,
        profile_image: form.profile_image || null 
      };
      if (form.password) {
        updates.password = form.password; 
        updates.must_change_password = true;
      }
      
      const ok = await updateUser(editId, updates);
      toast(ok ? 'แก้ไขผู้ใช้สำเร็จ' : 'เกิดข้อผิดพลาด', ok ? 'success' : 'error');
    } else {
      // Create mode
      if (!form.password) { toast('กรุณากรอกรหัสผ่าน', 'error'); return; }
      const err = await createUser({
        name: form.name.trim(), pha_id: form.pha_id.trim(),
        password: form.password, role: form.role, active: true,
        profile_image: form.profile_image || undefined
      });
      if (err) { toast(err, 'error'); return; }
      toast(`เพิ่ม ${form.name.trim()} สำเร็จ`, 'success');
    }
    setModalOpen(false);
  };

  const handleToggle = async (id: number) => {
    if (id === curUser?.id) { toast('ไม่สามารถปิดใช้งานตนเองได้', 'error'); return; }
    const ok = await toggleUser(id);
    if (ok) {
      const u = users.find(x => x.id === id);
      toast(`${u?.active ? 'ปิด' : 'เปิด'}ใช้งาน ${u?.name}`, 'success');
    }
  };

  const handleDelete = async (id: number) => {
    if (id === curUser?.id) { toast('ไม่สามารถลบตนเองได้', 'error'); return; }
    
    const result = await Swal.fire({
      title: 'ต้องการลบผู้ใช้งาน?',
      text: "ข้อมูลผู้ใช้จะถูกลบถาวร!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ลบผู้ใช้',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    const ok = await deleteUser(id);
    if (ok) {
      Swal.fire('ลบสำเร็จ!', 'ผู้ใช้งานถูกลบแล้ว.', 'success');
    } else {
      toast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', pha_id: '', password: '', role: 'user', profile_image: '/avatars/male-pharmacist.png' });
    setModalOpen(true);
  };

  const openEdit = (u: any) => {
    setEditId(u.id);
    setForm({ name: u.name, pha_id: u.pha_id, password: '', role: u.role, profile_image: u.profile_image || '/avatars/male-pharmacist.png' });
    setModalOpen(true);
  };

  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  const togglePasswordVisibility = (id: number) => {
    const next = new Set(visiblePasswords);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisiblePasswords(next);
  };

  return (
    <div className="page-section">
      <div className="card">
        <div className="card-header">
          <h3>จัดการผู้ใช้งาน</h3>
          <button className="btn btn-sm btn-primary" onClick={openAdd}>เพิ่มผู้ใช้</button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>เภสัชกร</th><th>Username</th><th>รหัสผ่าน</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td onClick={() => setViewUser(u)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar-sm" style={{ padding: 0, overflow: 'hidden' }}>
                        {u.profile_image ? (
                           <img src={resolvePath(u.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                           <div style={{ width: '100%', height: '100%', background: cols[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.name.charAt(0)}</div>
                        )}
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{u.pha_id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', minWidth: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{visiblePasswords.has(u.id) ? u.password : '••••••'}</span>
                      <button 
                        className="btn-icon-sm" 
                        onClick={() => togglePasswordVisibility(u.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
                        title={visiblePasswords.has(u.id) ? 'ซ่อน' : 'แสดง'}
                      >
                        {visiblePasswords.has(u.id) ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td><span className={`badge-tag ${u.role === 'admin' ? 'purple' : 'blue'}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                  <td><span className={`badge-tag ${u.active ? 'green' : 'red'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => setViewUser(u)} title="ดูข้อมูล">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(u)} title="แก้ไข">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleToggle(u.id)} title={u.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                      </svg>
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(u.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSave}>บันทึก</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>ชื่อ-นามสกุล <span className="req">*</span></label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Username <span className="req">*</span></label>
            <input className="form-input" value={form.pha_id} onChange={e => setForm(f => ({ ...f, pha_id: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>{editId ? 'เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน'} {editId ? '' : <span className="req">*</span>}</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>สิทธิ์</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>รูปโปรไฟล์</label>
          <div className="avatar-picker-options" style={{ justifyContent: 'flex-start' }}>
            <div 
              className={`avatar-option ${form.profile_image === '/avatars/male-pharmacist.png' ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, profile_image: '/avatars/male-pharmacist.png' }))}
            >
              <img src={resolvePath('/avatars/male-pharmacist.png')} alt="ชาย" />
              <span>ชาย</span>
            </div>
            <div 
              className={`avatar-option ${form.profile_image === '/avatars/female-pharmacist.png' ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, profile_image: '/avatars/female-pharmacist.png' }))}
            >
              <img src={resolvePath('/avatars/female-pharmacist.png')} alt="หญิง" />
              <span>หญิง</span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)} title="ข้อมูลผู้ใช้งาน" variant="clean">
        {viewUser && (
           <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ProfileCard 
              targetUser={viewUser} 
              isOwnProfile={curUser?.id === viewUser.id} 
              isAdmin={curUser?.role === 'admin'}
              onClose={() => setViewUser(null)}
            />
           </div>
        )}
      </Modal>
    </div>
  );
}
