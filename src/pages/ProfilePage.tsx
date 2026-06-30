import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProfileCard from '../components/ProfileCard';

function HnSettingsCard() {
  const [apiUrl, setApiUrl] = useState('');
  const [version, setVersion] = useState('');
  const [updateManifestUrl, setUpdateManifestUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void window.electronAPI!.getHnSettings().then((s) => {
      setApiUrl(s.hosxpApiUrl);
    });
    void window.electronAPI!.getAppInfo().then((info) => {
      setVersion(info.version);
      setUpdateManifestUrl(info.updateManifestUrl);
    });
  }, []);

  const handleSave = async () => {
    if (!apiUrl.trim()) return;
    setSaving(true);
    try {
      await window.electronAPI!.saveHnSettings({
        hosxpApiUrl: apiUrl.trim(),
        updateManifestUrl: updateManifestUrl.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      await window.electronAPI!.checkForUpdates();
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '480px', marginTop: '16px' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h3>HOSxP API</h3>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
          background: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #86efac',
        }}>
          พร้อมใช้งานภายในองค์กร
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>HOSxP API URL</label>
          <input
            className="form-input"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://172.17.1.70:3000"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          {saved && <span style={{ fontSize: '13px', color: '#16a34a' }}>บันทึกแล้ว</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !apiUrl.trim()}>
            {saving ? <><span className="btn-spinner" /> กำลังบันทึก...</> : 'บันทึก'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Token สำหรับเชื่อมต่อถูกกำหนดไว้ในแอปแล้ว ผู้ใช้ไม่ต้องตั้งค่าเพิ่มเติม
        </p>
        <hr style={{ width: '100%', border: 0, borderTop: '1px solid var(--border)' }} />
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Vercel Update Manifest URL</label>
          <input
            className="form-input"
            type="url"
            value={updateManifestUrl}
            onChange={(e) => setUpdateManifestUrl(e.target.value)}
            placeholder="https://your-project.vercel.app/updates/latest.json"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>YATA v{version || '—'}</span>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleCheckUpdate}
            disabled={checkingUpdate || !updateManifestUrl.trim()}
          >
            {checkingUpdate ? 'กำลังตรวจสอบ...' : 'ตรวจสอบอัปเดต'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="page-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px' }}>
      <ProfileCard targetUser={user} isOwnProfile={true} />
      {window.electronAPI && <HnSettingsCard />}
    </div>
  );
}
