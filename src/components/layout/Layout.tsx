import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePath } from '../../lib/utils';
import Swal from 'sweetalert2';

export default function Layout() {
  const { user, logout, location: stationName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard': return 'แดชบอร์ด';
      case '/prepare':   return 'เตรียมยา';
      case '/history':   return 'ประวัติการผลิต';
      case '/formulas':  return 'สูตรตำรับยา';
      case '/users':     return 'จัดการผู้ใช้';
      default:           return 'ED-Extemp';
    }
  };

  const getStationColor = (name: string) => {
    if (name.includes('ศัลยกรรม'))  return { bg: 'var(--accent-blue-light)',  text: 'var(--accent-blue)' };
    if (name.includes('ผู้ป่วยนอก')) return { bg: 'var(--accent-green-light)', text: 'var(--accent-green)' };
    return { bg: 'var(--accent-blue-light)', text: 'var(--accent-blue)' };
  };

  const stationStyle = stationName ? getStationColor(stationName) : { bg: '', text: '' };
  const avatarSrc = resolvePath(user?.profile_image || '/avatars/male-pharmacist.png');

  const closeSidebar = () => setSidebarOpen(false);

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
              <h2>ED-Extemp</h2>
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
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          {/* Hamburger (mobile only) */}
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

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {stationName && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: stationStyle.bg, color: stationStyle.text,
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {stationName}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {user?.role === 'admin' ? 'Admin' : 'Pharmacist'}
                </div>
              </div>
              <div
                onClick={() => navigate('/profile')}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden',
                  cursor: 'pointer', border: '2px solid var(--border)',
                  flexShrink: 0, transition: 'var(--tr)',
                }}
              >
                <img
                  src={avatarSrc}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = resolvePath('/avatars/male-pharmacist.png'); }}
                />
              </div>
              <button
                onClick={() => {
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
                }}
                title="ออกจากระบบ"
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  padding: '5px', borderRadius: '8px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '19px', height: '19px' }}>
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
    </div>
  );
}
