import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProfileCard from '../components/ProfileCard';

function withClientTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: number | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  });
}

function LabelPrinterCard() {
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadWarning, setLoadWarning] = useState('');

  const loadPrinters = () => {
    setLoading(true);
    setLoadWarning('');
    void withClientTimeout(
      window.electronAPI!.getLabelPrinterSettings(),
      12000,
      'ระบบเครื่องพิมพ์ไม่ตอบสนองภายใน 12 วินาที',
    )
      .then((s) => {
        setPrinters(s.printers);
        setSelected(s.labelPrinter);
        setLoadWarning(s.warning || '');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'ติดต่อระบบเครื่องพิมพ์ไม่ได้';
        setLoadWarning(`${message} กรุณาตรวจสอบเครื่องแม่ข่ายหรือ Print Spooler แล้วลองใหม่`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadPrinters, []);

  const savedPrinterMissing = selected !== '' && !printers.some((p) => p.name === selected);

  const handleSave = async () => {
    setSaving(true);
    setLoadWarning('');
    try {
      await withClientTimeout(
        window.electronAPI!.saveLabelPrinter(selected),
        5000,
        'บันทึกเครื่องพิมพ์ไม่สำเร็จภายใน 5 วินาที',
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึกเครื่องพิมพ์ไม่สำเร็จ';
      setLoadWarning(`${message} กรุณาลองใหม่โดยไม่ต้องปิดแอป`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '480px', marginTop: '16px' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h3>เครื่องพิมพ์ฉลาก</h3>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>พิมพ์ฉลากสติ๊กเกอร์ด้วย</label>
          <select
            className="form-input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loading}
          >
            <option value="">ถามทุกครั้ง (เปิดหน้าต่างเลือกเครื่องพิมพ์)</option>
            {savedPrinterMissing && (
              <option value={selected}>{selected} (ไม่พบเครื่องพิมพ์นี้)</option>
            )}
            {printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}{p.isDefault ? ' (ค่าเริ่มต้นของ Windows)' : ''}
              </option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          เมื่อเลือกเครื่องพิมพ์ไว้ แอปจะส่งงานพิมพ์ฉลากไปที่เครื่องนั้นทันที
          โดยไม่ต้องกดผ่านหน้าต่างพิมพ์ทุกครั้ง — เงื่อนไข: ไดรเวอร์เครื่องพิมพ์นั้น
          ต้องตั้งขนาดสติ๊กเกอร์เริ่มต้นเป็น 85×60 มม. ไว้ (ตั้งครั้งเดียว ทั้งใน
          Printing Preferences และ Printer Properties → Advanced → Printing Defaults)
        </p>
        {loadWarning && (
          <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 10px' }}>
            <div>{loadWarning} แอปส่วนอื่นยังใช้งานต่อได้ตามปกติ</div>
            <label htmlFor="manual-label-printer" style={{ display: 'block', marginTop: '8px', color: '#92400e' }}>
              หรือกรอกชื่อเครื่องพิมพ์เครือข่ายโดยตรง
            </label>
            <input
              id="manual-label-printer"
              className="form-input"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              placeholder="เช่น \\SERVER\\ชื่อเครื่องพิมพ์"
              style={{ marginTop: '4px' }}
            />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <button className="btn btn-secondary" type="button" onClick={loadPrinters} disabled={loading}>
            {loading ? 'กำลังโหลด...' : 'โหลดรายชื่อใหม่'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saved && <span style={{ fontSize: '13px', color: '#16a34a' }}>บันทึกแล้ว</span>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
              {saving ? <><span className="btn-spinner" /> กำลังบันทึก...</> : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      {window.electronAPI && <LabelPrinterCard />}
      {window.electronAPI && <HnSettingsCard />}
    </div>
  );
}
