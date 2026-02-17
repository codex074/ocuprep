import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';

export default function Layout() {
  const { user, logout, location: stationName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Debug user data
  console.log('Layout user:', user?.id, user?.name, 'Has Image:', !!user?.profile_image, user?.profile_image ? user.profile_image.substring(0, 30) + '...' : 'N/A');

  // Debug user data removed

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard': return 'แดชบอร์ด';
      case '/prepare': return 'เตรียมยา';
      case '/history': return 'ประวัติการผลิต';
      case '/formulas': return 'สูตรตำรับยา';
      case '/users': return 'จัดการผู้ใช้';
      default: return 'ED-Extemp';
    }
  };

  const dateStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const getStationColor = (name: string) => {
    if (name.includes('ศัลยกรรม')) return { bg: 'var(--accent-blue-light)', text: 'var(--accent-blue)' };
    if (name.includes('ผู้ป่วยนอก')) return { bg: 'var(--accent-green-light)', text: 'var(--accent-green)' };
    return { bg: 'var(--accent-blue-light)', text: 'var(--accent-blue)' };
  };

  const stationStyle = stationName ? getStationColor(stationName) : { bg: '', text: '' };

  const avatarSrc = user?.profile_image || '/avatars/male-pharmacist.png';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="s-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className="s-title">
            <h2>ED-Extemp</h2>
            <p>Pharmacy System</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">หน้าหลัก</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            แดชบอร์ด
          </NavLink>
          <NavLink to="/prepare" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            เตรียมยา
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            ประวัติการผลิต
          </NavLink>

          <div className="nav-label">จัดการระบบ</div>
          <NavLink to="/formulas" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            สูตรตำรับยา
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              จัดการผู้ใช้
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <div className="user-avatar" style={{ padding: 0, overflow: 'hidden' }}>
              <img 
                src={avatarSrc} 
                alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/avatars/male-pharmacist.png';
                }}
              />
            </div>
            <div className="user-details">
              <div className="name">{user?.name || 'User'}</div>
              <div className="role">{user?.role === 'admin' ? 'Admin' : 'Pharmacist'}</div>
            </div>
            <button className="logout-btn" onClick={() => {
              Swal.fire({
                title: 'ต้องการออกจากระบบ?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'ใช่, ออกจากระบบ',
                cancelButtonText: 'ยกเลิก'
              }).then((result) => {
                if (result.isConfirmed) {
                  logout();
                  navigate('/login');
                }
              });
            }} title="ออกจากระบบ">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1 className="page-title">
            {getPageTitle(location.pathname)}
          </h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {stationName && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: stationStyle.bg, color: stationStyle.text,
                padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {stationName}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{user?.name || ''}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr}</span>
            </div>
          </div>
        </header>
        <div className="main-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
