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
    <div className="station-page">
      {/* Same animated orbs as login page */}
      <div className="login-page" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} aria-hidden />

      <div className="station-container">
        {/* Header */}
        <div className="station-page-header">
          <div className="station-page-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <div className="station-page-title">เลือกห้องทำงาน</div>
          <div className="station-page-subtitle">กรุณาเลือกห้องยาที่ท่านปฏิบัติงาน</div>
        </div>

        {/* Station cards */}
        <div className="station-grid">
          <button className="station-card blue" onClick={() => handleSelect('ห้องจ่ายยาผู้ป่วยในศัลยกรรม')}>
            <div className="station-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="station-info">
              <h3>ห้องจ่ายยาผู้ป่วยในศัลยกรรม</h3>
              <span>IPD Surgery Ward</span>
            </div>
            <div className="station-arrow">→</div>
          </button>

          <button className="station-card green" onClick={() => handleSelect('ห้องจ่ายยาผู้ป่วยนอก')}>
            <div className="station-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div className="station-info">
              <h3>ห้องจ่ายยาผู้ป่วยนอก</h3>
              <span>OPD Pharmacy</span>
            </div>
            <div className="station-arrow">→</div>
          </button>
        </div>

        {/* Back button */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button className="station-back-btn" onClick={handleLogout}>
            ← กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>

        <div className="login-footer" style={{ marginTop: '20px' }}>
          © 2026 Uttaradit Hospital · Pharmacy Department
        </div>
      </div>
    </div>
  );
}
