import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useUsers } from '../hooks/useUsers';
import { resolvePath } from '../lib/utils';
import { openLoadingModal, closeLoadingModal } from '../lib/loadingModal';
import Modal from '../components/ui/Modal';
import ProfileCard from '../components/ProfileCard';
import LoadingState from '../components/ui/LoadingState';
import RefreshButton from '../components/ui/RefreshButton';
import type { User } from '../types';
import Swal from 'sweetalert2';

export default function UsersPage() {
  const { user: curUser } = useAuth();
  const { toast } = useToast();
  const { users, loading, refreshing, fetchUsers, createUser, updateUser, toggleUser, deleteUser } = useUsers();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  // Edit/Create state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', pha_id: '', password: '', role: 'user' as 'admin' | 'user', profile_image: '' });

  // View state
  const [viewUser, setViewUser] = useState<User | null>(null);

  const cols = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0D9488'];

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.pha_id.trim()) {
      toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return;
    }

    setSaving(true);
    openLoadingModal(editId ? 'กำลังบันทึกการแก้ไขผู้ใช้...' : 'กำลังเพิ่มผู้ใช้งาน...');
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
      closeLoadingModal();
      setSaving(false);
      toast(ok ? 'แก้ไขผู้ใช้สำเร็จ' : 'เกิดข้อผิดพลาด', ok ? 'success' : 'error');
      if (ok) setModalOpen(false);
    } else {
      // Create mode
      if (!form.password) { toast('กรุณากรอกรหัสผ่าน', 'error'); return; }
      const err = await createUser({
        name: form.name.trim(), pha_id: form.pha_id.trim(),
        password: form.password, role: form.role, active: true,
        profile_image: form.profile_image || undefined
      });
      closeLoadingModal();
      if (err) { setSaving(false); toast(err, 'error'); return; }
      setSaving(false);
      toast(`เพิ่ม ${form.name.trim()} สำเร็จ`, 'success');
      setModalOpen(false);
    }
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

    Swal.fire({
      title: 'กำลังลบผู้ใช้งาน...',
      text: 'กรุณารอสักครู่',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const ok = await deleteUser(id);
    Swal.close();
    if (ok) {
      toast('ลบผู้ใช้งานสำเร็จ', 'success');
    } else {
      toast('เกิดข้อผิดพลาดในการลบผู้ใช้งาน', 'error');
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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = normalizedSearch
    ? users.filter((u) => {
        const haystacks = [
          u.name,
          u.pha_id,
          u.role,
          u.active ? 'active' : 'inactive',
          u.active ? 'ใช้งาน' : 'ปิดใช้งาน',
          u.role === 'admin' ? 'admin' : 'user',
        ];
        return haystacks.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
      })
    : users;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="page-section">
      <div className="page-actions">
        <RefreshButton refreshing={refreshing} onClick={() => fetchUsers(true)} />
      </div>

      {loading ? (
        <LoadingState title="กำลังโหลดข้อมูลผู้ใช้" description="ระบบกำลังดึงรายชื่อผู้ใช้งานจากฐานข้อมูล" />
      ) : (
        <>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>จัดการผู้ใช้งาน</h3>
            {normalizedSearch && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                พบ {filteredUsers.length} รายการ
              </p>
            )}
          </div>
          <button className="btn btn-sm btn-primary" onClick={openAdd}>เพิ่มผู้ใช้</button>
        </div>
        <div style={{ padding: '0 24px 16px' }}>
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="ค้นหาชื่อ, username, role หรือสถานะ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>เภสัชกร</th><th>Username</th><th>รหัสผ่าน</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>
                    {normalizedSearch ? 'ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา' : 'ยังไม่มีผู้ใช้งาน'}
                  </td>
                </tr>
              )}
              {visibleUsers.map((u, i) => (
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
        {filteredUsers.length > 0 && (
          <div className="list-pagination">
            <div className="list-pagination-text">
              หน้า {safePage} / {totalPages} • แสดง {startIndex + 1}-{startIndex + visibleUsers.length} จาก {filteredUsers.length} รายการ
            </div>
            <div className="list-pagination-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
              >
                ← ก่อนหน้า
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage >= totalPages}
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="btn-spinner" /> กำลังบันทึก...</> : 'บันทึก'}
            </button>
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
        </>
      )}
    </div>
  );
}
