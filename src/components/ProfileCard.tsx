import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useUsers } from '../hooks/useUsers';
import { usePreps } from '../hooks/usePreps';
import { resolvePath } from '../lib/utils';
import type { User } from '../types';
import Swal from 'sweetalert2';

interface ProfileCardProps {
  targetUser: User;
  isOwnProfile: boolean;
  isAdmin?: boolean;
  onClose?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ProfileCard({ targetUser, isOwnProfile, isAdmin, onClose }: ProfileCardProps) {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const { updateUser } = useUsers();
  const { preps } = usePreps();
  const navigate = useNavigate();

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);

  const [newName, setNewName] = useState(targetUser.name);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Temp avatar state for preview before saving
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);

  const canEdit = isOwnProfile || isAdmin;

  const startAvatarEdit = () => {
    setTempAvatar(targetUser.profile_image || '/avatars/male-pharmacist.png');
    setShowAvatarPicker(true);
  };

  const activeAvatarSrc = showAvatarPicker && tempAvatar ? tempAvatar : resolvePath(targetUser.profile_image || '/avatars/male-pharmacist.png');

  // Stats
  const myPreps = useMemo(
    () => preps.filter(p => p.prepared_by === targetUser.name),
    [preps, targetUser.name]
  );

  const totalQty = useMemo(
    () => myPreps.reduce((sum, p) => sum + (p.qty || 0), 0),
    [myPreps]
  );

  const distinctFormulas = useMemo(
    () => new Set(myPreps.map(p => p.formula_id)).size,
    [myPreps]
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast('ขนาดไฟล์ต้องไม่เกิน 5 MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTempAvatar(base64); // Just set preview
    };
    reader.readAsDataURL(file);
  };

  const saveAvatar = async () => {
    if (!tempAvatar || !canEdit) return;
    
    // confirm
    const result = await Swal.fire({
      title: 'ยืนยันการเปลี่ยนรูปโปรไฟล์?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    const ok = await updateUser(targetUser.id, { profile_image: tempAvatar });
    if (ok) {
      toast('เปลี่ยนรูปโปรไฟล์สำเร็จ', 'success');
      refreshUser();
      setShowAvatarPicker(false);
      setTempAvatar(null);
    } else {
      toast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  const cancelAvatarEdit = () => {
    setShowAvatarPicker(false);
    setTempAvatar(null);
  };

  const handleNameChange = async () => {
    if (!canEdit) return;
    if (!newName.trim()) { toast('กรุณากรอกชื่อ', 'error'); return; }
    
    // confirm
    const result = await Swal.fire({
      title: 'ยืนยันการเปลี่ยนชื่อ?',
      text: `"เปลี่ยนจาก "${targetUser.name}" เป็น "${newName}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });
    
    if (!result.isConfirmed) return;

    const ok = await updateUser(targetUser.id, { name: newName });
    if (ok) {
      toast('เปลี่ยนชื่อสำเร็จ', 'success');
      refreshUser();
      setShowNameEdit(false);
    } else {
      toast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const handlePasswordChange = async () => {
    if (!canEdit) return;
    if (!newPassword) { toast('กรุณากรอกรหัสผ่านใหม่', 'error'); return; }
    
    // Require old password only if it's the user checking themselves, NOT admin
    if (isOwnProfile && !isAdmin) {
        if (!oldPassword) { toast('กรุณากรอกรหัสผ่านเดิม', 'error'); return; }
        if (oldPassword !== targetUser.password) { toast('รหัสผ่านเดิมไม่ถูกต้อง', 'error'); return; }
    }
    
    const ok = await updateUser(targetUser.id, { password: newPassword });
    if (ok) {
      toast('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
      setOldPassword('');
      setNewPassword('');
      refreshUser();
      setShowPasswordEdit(false);
    } else {
      toast('เกิดข้อผิดพลาด', 'error');
    }
  };

  return (
    <div className="profile-card" style={{ position: 'relative' }}>
      {onClose && (
        <button 
            onClick={onClose}
            style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                zIndex: 10
            }}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </button>
      )}
      <div className="profile-card-header"></div>
      
      <div 
        className="profile-card-image" 
        onClick={() => canEdit && startAvatarEdit()}
        style={{ cursor: canEdit ? 'pointer' : 'default' }}
      >
        <img src={activeAvatarSrc} alt="Profile" />
        {isOwnProfile && (
          <div className="profile-card-image-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}
      </div>

      {showAvatarPicker && isOwnProfile && (
        <div className="avatar-picker">
          <div className="avatar-picker-title">เลือกรูปโปรไฟล์</div>
          <div className="avatar-picker-options">
            <div 
              className={`avatar-option ${tempAvatar === '/avatars/male-pharmacist.png' ? 'active' : ''}`}
              onClick={() => setTempAvatar('/avatars/male-pharmacist.png')}
            >
              <img src={resolvePath('/avatars/male-pharmacist.png')} alt="ชาย" />
              <span>ชาย</span>
            </div>
            <div 
              className={`avatar-option ${tempAvatar === '/avatars/female-pharmacist.png' ? 'active' : ''}`}
              onClick={() => setTempAvatar('/avatars/female-pharmacist.png')}
            >
              <img src={resolvePath('/avatars/female-pharmacist.png')} alt="หญิง" />
              <span>หญิง</span>
            </div>
          </div>
          <div className="avatar-picker-divider">
            <span>หรืออัพโหลดรูปของคุณ</span>
          </div>
          <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            อัพโหลดรูป (สูงสุด 5 MB)
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className="btn btn-sm btn-primary" onClick={saveAvatar} style={{ flex: 1 }}>ยืนยันเปลี่ยนรูป</button>
            <button className="btn btn-sm btn-outline" onClick={cancelAvatarEdit}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="profile-card-info">
        <div className="profile-card-name">{targetUser.name}</div>
        <div className="profile-card-role">
          <span className={`badge-tag ${targetUser.role === 'admin' ? 'purple' : 'blue'}`}>
            {targetUser.role === 'admin' ? 'Admin' : 'Pharmacist'}
          </span>
        </div>
        <div className="profile-card-id">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Username: {targetUser.pha_id}
        </div>
      </div>

      <div className="profile-card-stats">
        <div className="profile-stat-item">
          <div className="profile-stat-value">{totalQty}</div>
          <div className="profile-stat-label">ยาที่ผลิต</div>
        </div>
        <div className="profile-stat-item">
          <div className="profile-stat-value">{distinctFormulas}</div>
          <div className="profile-stat-label">ชนิดยา</div>
        </div>
        <div className="profile-stat-item">
          <div className="profile-stat-value">{myPreps.length}</div>
          <div className="profile-stat-label">รายการ</div>
        </div>
      </div>

      <button className="profile-card-cta" onClick={() => navigate('/history', { state: { filterBy: targetUser.name } })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        ดูประวัติย้อนหลัง
      </button>

      {canEdit && (
        <div className="profile-card-settings">
          <div className="settings-section">
            <button 
              className={`settings-toggle ${showNameEdit ? 'open' : ''}`}
              onClick={() => setShowNameEdit(!showNameEdit)}
            >
              <div className="settings-toggle-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                เปลี่ยนชื่อ
              </div>
              <svg className="settings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showNameEdit && (
              <div className="settings-body">
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>ชื่อใหม่</label>
                  <input 
                    className="form-input" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    placeholder="ระบุชื่อใหม่"
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-primary" onClick={handleNameChange} style={{ flex: 1 }}>บันทึก</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setShowNameEdit(false)} style={{ flex: 1 }}>ยกเลิก</button>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <button 
              className={`settings-toggle ${showPasswordEdit ? 'open' : ''}`}
              onClick={() => setShowPasswordEdit(!showPasswordEdit)}
            >
              <div className="settings-toggle-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                เปลี่ยนรหัสผ่าน
              </div>
              <svg className="settings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showPasswordEdit && (
              <div className="settings-body">
                {(!isAdmin || isOwnProfile) && (
                    <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>รหัสผ่านเดิม</label>
                    <input 
                        className="form-input" 
                        type="password"
                        value={oldPassword} 
                        onChange={e => setOldPassword(e.target.value)}
                    />
                    </div>
                )}
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>รหัสผ่านใหม่</label>
                  <input 
                    className="form-input" 
                    type="password"
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-primary" onClick={handlePasswordChange} style={{ flex: 1 }}>บันทึก</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setShowPasswordEdit(false)} style={{ flex: 1 }}>ยกเลิก</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
