import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePath } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import Swal from 'sweetalert2';

export default function Layout() {
  const { user, logout, location: stationName, selectStation, sessionRemainingMs } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [stationModalOpen, setStationModalOpen] = useState(false);

  const stationOptions = [
    {
      value: 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม',
      label: 'ห้องจ่ายยาผู้ป่วยในศัลยกรรม',
      subtitle: 'IPD Surgery Ward',
      tone: 'blue',
    },
    {
      value: 'ห้องจ่ายยาผู้ป่วยนอก',
      label: 'ห้องจ่ายยาผู้ป่วยนอก',
      subtitle: 'OPD Pharmacy',
      tone: 'green',
    },
  ] as const;

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard': return 'แดชบอร์ด';
      case '/prepare':   return 'เตรียมยา';
      case '/history':   return 'ประวัติการผลิต';
      case '/formulas':  return 'สูตรตำรับยา';
      case '/users':     return 'จัดการผู้ใช้';
      case '/action-logs': return 'ประวัติการใช้งาน';
      default:           return 'YATA';
    }
  };

  const getStationColor = (name: string) => {
    if (name.includes('ศัลยกรรม'))  return { bg: 'var(--accent-blue-light)',  text: 'var(--accent-blue)' };
    if (name.includes('ผู้ป่วยนอก')) return { bg: 'var(--accent-green-light)', text: 'var(--accent-green)' };
    return { bg: 'var(--accent-blue-light)', text: 'var(--accent-blue)' };
  };

  const stationStyle = stationName ? getStationColor(stationName) : { bg: '', text: '' };
  const avatarSrc = resolvePath(user?.profile_image || '/avatars/male-pharmacist.png');
  const sessionMinutes = Math.floor(sessionRemainingMs / 60000);
  const sessionSeconds = Math.floor((sessionRemainingMs % 60000) / 1000);
  const sessionCountdown = `${String(sessionMinutes).padStart(2, '0')}:${String(sessionSeconds).padStart(2, '0')}`;

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = () => {
    setProfileMenuOpen(false);
    Swal.fire({
      title: 'ต้องการออกจากระบบ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ใช่, ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      borderRadius: '14px',
    } as any).then((result) => {
      if (result.isConfirmed) { logout(); navigate('/login'); }
    });
  };

  const handleStationChange = (nextStation: string) => {
    if (nextStation === stationName) {
      setStationModalOpen(false);
      return;
    }

    selectStation(nextStation);
    setStationModalOpen(false);
    toast(`เปลี่ยนห้องทำงานเป็น ${nextStation}`, 'success');
  };

  return (
    <div className="app-layout">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="s-logo" style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src={resolvePath('/logo/hoslogo.png')} alt="Hospital Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="s-title">
              <h2>YATA</h2>
              <p>Pharmacy System</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">หน้าหลัก</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeSidebar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            แดชบอร์ด
          </NavLink>
          <NavLink to="/prepare" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeSidebar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            เตรียมยา
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeSidebar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            ประวัติการผลิต
          </NavLink>
          <div className="nav-label">จัดการระบบ</div>
          <NavLink to="/formulas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeSidebar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            สูตรตำรับยา
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeSidebar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              จัดการผู้ใช้
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/action-logs" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeSidebar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              ประวัติการใช้งาน
            </NavLink>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          {/* Hamburger — desktop only, hidden on mobile */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="เปิด/ปิดเมนู"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="page-title">{getPageTitle(location.pathname)}</h1>

          <div className="header-actions">
            {stationName && (
              <button
                type="button"
                className="header-station"
                style={{ background: stationStyle.bg, color: stationStyle.text }}
                onClick={() => setStationModalOpen(true)}
                title="เปลี่ยนห้องทำงาน"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {stationName}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="header-station-chevron">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}

            <div className="header-user-cluster">
              <div className="header-user-text">
                <div className="header-user-name">{user?.name || 'User'}</div>
                <div className="header-user-role">
                  {user?.role === 'admin' ? 'Admin' : 'Pharmacist'}
                </div>
              </div>
              <div className={`header-session-chip${sessionRemainingMs <= 5 * 60 * 1000 ? ' warning' : ''}`} title="ระบบจะออกจากระบบอัตโนมัติหลังไม่มีการใช้งาน 1 ชั่วโมง">
                <span className="header-session-time">{sessionCountdown}</span>
              </div>
              <div
                className="header-avatar-button"
                onClick={() => navigate('/profile')}
              >
                <img
                  src={avatarSrc}
                  alt=""
                  className="header-avatar-image"
                  onError={(e) => { (e.target as HTMLImageElement).src = resolvePath('/avatars/male-pharmacist.png'); }}
                />
              </div>
              <button
                className="header-logout-btn"
                onClick={handleLogout}
                title="ออกจากระบบ"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="main-body">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span>หน้าหลัก</span>
        </NavLink>
        <NavLink to="/prepare" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span>เตรียมยา</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span>ประวัติ</span>
        </NavLink>
        <NavLink to="/formulas" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>สูตรยา</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/users" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>ผู้ใช้</span>
          </NavLink>
        )}

        {/* Profile button — avatar in bottom nav */}
        <button
          className={`bottom-nav-item bottom-nav-profile-btn${profileMenuOpen ? ' active' : ''}`}
          onClick={() => setProfileMenuOpen(o => !o)}
          aria-label="โปรไฟล์"
        >
          <img
            src={avatarSrc}
            alt=""
            className="bottom-nav-avatar"
            onError={(e) => { (e.target as HTMLImageElement).src = resolvePath('/avatars/male-pharmacist.png'); }}
          />
          <span>โปรไฟล์</span>
        </button>
      </nav>

      {/* Profile popup (mobile) */}
      {profileMenuOpen && (
        <>
          <div className="profile-popup-overlay" onClick={() => setProfileMenuOpen(false)} />
          <div className="profile-popup">
            {/* User info */}
            <div className="profile-popup-user">
              <img
                src={avatarSrc}
                alt=""
                className="profile-popup-avatar"
                onError={(e) => { (e.target as HTMLImageElement).src = resolvePath('/avatars/male-pharmacist.png'); }}
              />
              <div className="profile-popup-info">
                <div className="profile-popup-name">{user?.name || 'User'}</div>
                <div className="profile-popup-role">
                  {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'เภสัชกร'}
                  {stationName ? ` · ${stationName}` : ''}
                </div>
              </div>
            </div>

            <div className="profile-popup-divider" />

            {/* Actions */}
            <button
              className="profile-popup-action"
              onClick={() => { setProfileMenuOpen(false); navigate('/profile'); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              โปรไฟล์ของฉัน
            </button>

            {user?.role === 'admin' && (
              <button
                className="profile-popup-action"
                onClick={() => { setProfileMenuOpen(false); navigate('/action-logs'); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                ประวัติการใช้งาน
              </button>
            )}

            <button
              className="profile-popup-action profile-popup-logout"
              onClick={handleLogout}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              ออกจากระบบ
            </button>
          </div>
        </>
      )}

      <Modal
        isOpen={stationModalOpen}
        onClose={() => setStationModalOpen(false)}
        title="เปลี่ยนห้องทำงาน"
        width="520px"
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          {stationOptions.map((station) => {
            const isActive = station.value === stationName;
            return (
              <button
                key={station.value}
                type="button"
                className={`station-switch-card ${station.tone}${isActive ? ' active' : ''}`}
                onClick={() => handleStationChange(station.value)}
              >
                <div className={`station-switch-icon ${station.tone}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="station-switch-info">
                  <div className="station-switch-name">{station.label}</div>
                  <div className="station-switch-subtitle">{station.subtitle}</div>
                </div>
                <div className="station-switch-status">
                  {isActive ? 'กำลังใช้งาน' : 'เลือก'}
                </div>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
