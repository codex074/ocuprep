import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function LoginPage() {
  const [phaId, setPhaId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phaId.trim()) { toast('กรุณากรอก Username', 'error'); return; }
    if (!password) { toast('กรุณากรอก Password', 'error'); return; }
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
        <div className="login-header">
          Sign In
        </div>
        <div className="login-subtext">
          ED-Extemp — Uttaradit Hospital
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <input 
            type="text" 
            className="login-input" 
            placeholder="Username" 
            autoComplete="off"
            value={phaId} 
            onChange={e => setPhaId(e.target.value)} 
          />
          <input 
            type="password" 
            className="login-input" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          
          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting ? 'Sign In' : 'Sign In'}
          </button>
          

        </form>
        
        <div className="login-footer">
           © 2026 Uttaradit Hospital
        </div>
      </div>
    </div>
  );
}
