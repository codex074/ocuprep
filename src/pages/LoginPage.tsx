import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function LoginPage() {
  const [phaId, setPhaId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phaId.trim()) { toast('กรุณากรอก Username', 'error'); return; }
    if (!password)     { toast('กรุณากรอก Password', 'error'); return; }
    setSubmitting(true);
    const err = await login(phaId.trim(), password);
    setSubmitting(false);
    if (err) { toast(err, 'error'); return; }
    toast('เข้าสู่ระบบสำเร็จ กรุณาเลือกห้องทำงาน', 'success');
    navigate('/station-select');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo */}
        <div className="login-logo" style={{ background: 'transparent', boxShadow: 'none' }}>
          <img src={`${import.meta.env.BASE_URL}logo/hoslogo.png`} alt="Hospital Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <div className="login-header">ยินดีต้อนรับ</div>
        <div className="login-subtext">ED-Extemp · โรงพยาบาลอุตรดิตถ์</div>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Username */}
          <div className="login-input-group">
            <span className="login-input-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <input
              type="text"
              className="login-input"
              placeholder="Username"
              autoComplete="off"
              value={phaId}
              onChange={e => setPhaId(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="login-input-group" style={{ position: 'relative' }}>
            <span className="login-input-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input
              type={showPw ? 'text' : 'password'}
              className="login-input"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex',
              }}
              tabIndex={-1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                {showPw
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                }
              </svg>
            </button>
          </div>

          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting
              ? <><span className="btn-spinner" /> กำลังเข้าสู่ระบบ...</>
              : <>เข้าสู่ระบบ</>
            }
          </button>
        </form>

        <div className="login-footer">© 2026 Uttaradit Hospital · Pharmacy Department</div>
      </div>
    </div>
  );
}
