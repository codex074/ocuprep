import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function StationSelectionPage() {
  const { selectStation, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSelect = (station: string) => {
    selectStation(station);
    toast(`เลือกห้องทำงาน: ${station}`, 'success');
    navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="login-page">
      <div className="login-container" style={{ width: '860px', maxWidth: '90vw' }}>
        <div className="login-header" style={{ marginBottom: '10px' }}>
          เลือกห้องทำงาน
        </div>
        <div className="login-subtext" style={{ marginBottom: '30px' }}>
          กรุณาเลือกห้องยาที่ท่านปฏิบัติงาน เพื่อเข้าสู่ระบบ
        </div>

        <div className="station-grid">
          <button className="station-card blue" onClick={() => handleSelect('ห้องยาในศัลยกรรม')}>
            <div className="station-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="station-info">
              <h3>ห้องยาในศัลยกรรม</h3>
              <span>IPD Surg</span>
            </div>
            <div className="station-arrow">→</div>
          </button>

          <button className="station-card green" onClick={() => handleSelect('ห้องจ่ายยาผู้ป่วยนอก')}>
            <div className="station-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div className="station-info">
              <h3>ห้องจ่ายยาผู้ป่วยนอก</h3>
              <span>OPD</span>
            </div>
            <div className="station-arrow">→</div>
          </button>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button className="station-back-btn" onClick={handleLogout}>
            ← กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
        <div className="login-footer">© 2026 Uttaradit Hospital — Pharmacy Department</div>
      </div>
    </div>
  );
}
