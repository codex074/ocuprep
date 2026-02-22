import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

export default function ForceChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) { toast('กรุณากรอกรหัสผ่านใหม่', 'error'); return; }
    if (password !== confirmPassword) { toast('รหัสผ่านไม่ตรงกัน', 'error'); return; }
    if (password.length < 4) { toast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 'error'); return; }

    setSubmitting(true);
    
    // Update password and clear the flag
    const { error } = await supabase
      .from('users')
      .update({ 
        password: password,
        must_change_password: false 
      })
      .eq('id', user?.id || 0);

    if (error) {
      toast('เกิดข้อผิดพลาด: ' + error.message, 'error');
      setSubmitting(false);
      return;
    }

    await refreshUser();
    setSubmitting(false);
    toast('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
    navigate('/station-select', { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <div className="login-header">เปลี่ยนรหัสผ่าน</div>
        <div className="login-subtext">กรุณาตั้งรหัสผ่านใหม่เพื่อความปลอดภัย</div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>รหัสผ่านใหม่</label>
            <input 
              type="password" 
              className="login-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="New Password"
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>ยืนยันรหัสผ่านใหม่</label>
            <input 
              type="password" 
              className="login-input" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              placeholder="Confirm Password"
            />
          </div>
          
          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </form>
      </div>
    </div>
  );
}
