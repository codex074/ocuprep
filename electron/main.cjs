'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const urlLib = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Fixed port so localStorage persists across launches
const APP_PORT = 37200;

// --- Settings ---
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
let embeddedSecrets = {};
try {
  embeddedSecrets = require('./secrets.cjs');
} catch {
  console.warn('[HOSxP] electron/secrets.cjs is not present');
}
const EMBEDDED_HOSXP_TOKEN = embeddedSecrets.hosxpToken || '';
const EMBEDDED_HOSXP_TOKEN_HIS = embeddedSecrets.hosxpTokenHis || '';

const DEFAULT_SETTINGS = {
  hosxpApiUrl: 'http://172.17.1.70:3000',
  updateManifestUrl: '',
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      delete saved.hosxpToken;
      delete saved.hosxpTokenHis;
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e.message);
  }
}

let settings = loadSettings();

// --- Static file server (serves dist/ so Firebase gets http:// origin) ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(distPath, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = urlLib.parse(req.url);
      let pathname = '/';
      try {
        pathname = decodeURIComponent(parsed.pathname || '/');
      } catch {
        res.writeHead(400); res.end('Bad request'); return;
      }
      const filePathCandidate = path.resolve(distPath, `.${pathname}`);
      if (filePathCandidate !== distPath && !filePathCandidate.startsWith(`${distPath}${path.sep}`)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      let filePath = filePathCandidate;

      try {
        if (fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch {
        // File not found — SPA fallback to index.html (HashRouter handles routing)
        filePath = path.join(distPath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        filePath = path.join(distPath, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = MIME[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

// --- HOSxP API caller (GET with JSON body using raw http/https) ---
function callHosxpApi(apiUrl, apiPath, token, hn) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ HN: hn });
    const parsed = new urlLib.URL(apiPath, apiUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      reject(new Error('HOSxP API URL ต้องเป็น http หรือ https'));
      return;
    }
    const mod = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ statusCode: res.statusCode, body: {} }); }
      });
    });

    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function normalizePatient(raw, source) {
  const givenName = [raw.pname, raw.fname].filter(Boolean).join('');
  return {
    source,
    hn:       raw.hn       || '',
    vn:       raw.vn       || '',
    qn:       raw.oqueue   || '',
    pname:    raw.pname    || '',
    fname:    raw.fname    || '',
    lname:    raw.lname    || '',
    fullName: [givenName, raw.lname].filter(Boolean).join(' '),
  };
}

async function lookupPatient(hn) {
  const { hosxpApiUrl } = settings;
  if (!EMBEDDED_HOSXP_TOKEN && !EMBEDDED_HOSXP_TOKEN_HIS) {
    throw new Error('แอปชุดนี้ไม่ได้ฝัง Token สำหรับเชื่อมต่อ HOSxP');
  }

  if (EMBEDDED_HOSXP_TOKEN) try {
    const r = await callHosxpApi(hosxpApiUrl, '/api/hosxp/patient', EMBEDDED_HOSXP_TOKEN, hn);
    if (r.statusCode === 200 && r.body?.data?.[0]) {
      return normalizePatient(r.body.data[0], 'hosxp/patient');
    }
  } catch (e) { console.error('[HN] primary:', e.message); }

  if (EMBEDDED_HOSXP_TOKEN_HIS) try {
    const r = await callHosxpApi(hosxpApiUrl, '/api/hosxp/HIS', EMBEDDED_HOSXP_TOKEN_HIS, hn);
    if (r.statusCode === 200 && r.body?.data?.[0]) {
      return normalizePatient(r.body.data[0], 'hosxp/HIS');
    }
  } catch (e) { console.error('[HN] HIS fallback:', e.message); }

  return null;
}

// --- IPC Handlers ---
ipcMain.handle('lookup-hn', async (_event, hn) => {
  const digits = String(hn).replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 9) {
    return { ok: false, message: 'HN ต้องมี 7–9 หลัก' };
  }
  const normalizedHN = digits.padStart(9, '0');
  try {
    const patient = await lookupPatient(normalizedHN);
    if (patient) return { ok: true, patient };
    return { ok: false, message: `ไม่พบข้อมูลผู้ป่วย (HN: ${normalizedHN})` };
  } catch (e) {
    return { ok: false, message: String(e.message) };
  }
});

ipcMain.handle('get-hn-settings', () => ({
  hosxpApiUrl: settings.hosxpApiUrl,
  hasToken: Boolean(EMBEDDED_HOSXP_TOKEN),
  hasTokenHis: Boolean(EMBEDDED_HOSXP_TOKEN_HIS),
}));

ipcMain.handle('save-hn-settings', (_event, s) => {
  if (typeof s?.hosxpApiUrl === 'string' && s.hosxpApiUrl.trim()) {
    const parsed = new urlLib.URL(s.hosxpApiUrl.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL ไม่ถูกต้อง');
    settings.hosxpApiUrl = parsed.toString().replace(/\/$/, '');
  }
  if (typeof s?.updateManifestUrl === 'string') {
    const value = s.updateManifestUrl.trim();
    if (value) {
      const parsed = new urlLib.URL(value);
      if (parsed.protocol !== 'https:') throw new Error('Update URL ต้องเป็น https');
    }
    settings.updateManifestUrl = value;
  }
  saveSettings(settings);
  return { ok: true };
});

// --- Portable updater (Vercel manifest + SHA-256 verified executable) ---
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
let updateInProgress = false;

function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function request(url, onResponse, onError, timeout, redirectCount = 0) {
  let parsed;
  try {
    parsed = new urlLib.URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Update URL ต้องเป็น https');
  } catch (error) {
    onError(error);
    return;
  }
  const req = https.get(parsed, {
    headers: { 'User-Agent': `YATA/${app.getVersion()}`, Accept: 'application/json' },
  }, (res) => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      res.resume();
      if (redirectCount >= 5) {
        onError(new Error('มี redirect มากเกินไป'));
        return;
      }
      request(
        new urlLib.URL(res.headers.location, parsed).toString(),
        onResponse,
        onError,
        timeout,
        redirectCount + 1,
      );
      return;
    }
    onResponse(res);
  });
  req.setTimeout(timeout, () => req.destroy(new Error('Update server timeout')));
  req.on('error', onError);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    request(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Update server ตอบกลับ ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) res.destroy(new Error('Manifest ใหญ่เกินไป'));
      });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('Manifest ไม่ใช่ JSON ที่ถูกต้อง')); }
      });
      res.on('error', reject);
    }, reject, 15000);
  });
}

function downloadAndHash(url, destination) {
  return new Promise((resolve, reject) => {
    request(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`ดาวน์โหลดอัปเดตไม่สำเร็จ (${res.statusCode})`));
        return;
      }
      const hash = crypto.createHash('sha256');
      const output = fs.createWriteStream(destination, { mode: 0o600 });
      res.on('data', (chunk) => hash.update(chunk));
      res.pipe(output);
      output.on('finish', () => output.close(() => resolve(hash.digest('hex'))));
      output.on('error', reject);
      res.on('error', reject);
    }, reject, 120000);
  });
}

function installPortableUpdate(downloadedFile) {
  const currentExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const scriptPath = path.join(app.getPath('temp'), `yata-update-${Date.now()}.ps1`);
  const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
  const script = [
    `$pidToWait = ${process.pid}`,
    `$source = ${psQuote(downloadedFile)}`,
    `$target = ${psQuote(currentExe)}`,
    'Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue',
    'Start-Sleep -Milliseconds 500',
    'Copy-Item -LiteralPath $source -Destination $target -Force',
    'Start-Process -FilePath $target',
    'Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue',
    'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue',
  ].join('\r\n');
  fs.writeFileSync(scriptPath, script, 'utf8');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  app.quit();
}

async function checkForUpdates({ interactive = false } = {}) {
  if (!app.isPackaged) return { ok: true, updateAvailable: false, message: 'โหมดพัฒนาไม่มีการอัปเดต' };
  if (!settings.updateManifestUrl) {
    return { ok: false, message: 'ยังไม่ได้ตั้งค่า Vercel Update Manifest URL' };
  }
  if (updateInProgress) return { ok: false, message: 'กำลังตรวจสอบหรือดาวน์โหลดอัปเดตอยู่' };

  updateInProgress = true;
  try {
    const manifest = await getJson(settings.updateManifestUrl);
    if (
      typeof manifest?.version !== 'string'
      || typeof manifest?.url !== 'string'
      || !/^[a-f0-9]{64}$/i.test(manifest?.sha256 || '')
    ) throw new Error('Manifest ขาด version, url หรือ sha256');
    if (compareVersions(manifest.version, app.getVersion()) <= 0) {
      if (interactive) dialog.showMessageBox(win, { type: 'info', message: 'YATA เป็นเวอร์ชันล่าสุดแล้ว' });
      return { ok: true, updateAvailable: false, version: manifest.version };
    }

    const answer = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['ดาวน์โหลดและอัปเดต', 'ภายหลัง'],
      defaultId: 0,
      cancelId: 1,
      title: 'พบ YATA เวอร์ชันใหม่',
      message: `พบเวอร์ชัน ${manifest.version} (ปัจจุบัน ${app.getVersion()})`,
      detail: manifest.notes || 'แอปจะเปิดใหม่อัตโนมัติหลังดาวน์โหลดเสร็จ',
      noLink: true,
    });
    if (answer.response !== 0) return { ok: true, updateAvailable: true, version: manifest.version };

    const destination = path.join(app.getPath('temp'), `YATA-${manifest.version}-portable.exe`);
    const actualHash = await downloadAndHash(manifest.url, destination);
    if (actualHash.toLowerCase() !== manifest.sha256.toLowerCase()) {
      fs.rmSync(destination, { force: true });
      throw new Error('SHA-256 ของไฟล์อัปเดตไม่ตรงกับ manifest');
    }
    installPortableUpdate(destination);
    return { ok: true, updateAvailable: true, version: manifest.version };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (interactive) dialog.showErrorBox('อัปเดต YATA ไม่สำเร็จ', message);
    else console.error('[updater]', message);
    return { ok: false, message };
  } finally {
    updateInProgress = false;
  }
}

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  updateManifestUrl: settings.updateManifestUrl,
  packaged: app.isPackaged,
}));
ipcMain.handle('check-for-updates', () => checkForUpdates({ interactive: true }));

// --- Label printing with a program-locked page size (8.5×6cm) ---
// The renderer sends the full label HTML; we render it in a hidden window and
// print via webContents.print() with an explicit pageSize. This makes every PC
// print identically regardless of its printer-driver default paper size — which
// was causing some machines to feed/skip several blank stickers per label.
// silent:false keeps the normal print dialog so the user still picks the printer.
let printSeq = 0;
ipcMain.handle('print-labels', async (_event, html) => {
  if (typeof html !== 'string' || !html) {
    return { ok: false, message: 'ไม่มีเนื้อหาให้พิมพ์' };
  }
  const tmpFile = path.join(app.getPath('temp'), `yata-label-${process.pid}-${printSeq++}.html`);
  let printWin = null;
  try {
    fs.writeFileSync(tmpFile, html, 'utf8');
    printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await printWin.loadFile(tmpFile);

    // Wait for web fonts (Sarabun) so the label lays out at its intended height
    // before printing; a fallback font can be taller and overflow the 6cm page.
    try {
      await printWin.webContents.executeJavaScript(
        'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
      );
    } catch {}

    const result = await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' },
          // 8.5cm × 6cm expressed in microns (1cm = 10000 microns).
          // width > height already describes the physical landscape label.
          pageSize: { width: 85000, height: 60000 },
          landscape: false,
        },
        (success, reason) => resolve({ success, reason }),
      );
    });

    if (!result.success) return { ok: false, message: result.reason || 'ยกเลิกการพิมพ์' };
    return { ok: true };
  } catch (e) {
    console.error('[print-labels]', e.message);
    return { ok: false, message: e.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    fs.rm(tmpFile, { force: true }, () => {});
  }
});

// --- Window ---
let win;
let staticServer;

async function createWindow() {
  const distPath = path.join(__dirname, '..', 'dist');

  if (!fs.existsSync(distPath)) {
    dialog.showErrorBox('YATA', 'ไม่พบโฟลเดอร์ dist/ — กรุณา build แอปก่อน (npm run build)');
    app.quit();
    return;
  }

  try {
    staticServer = await serveStatic(distPath, APP_PORT);
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      // Port already used by another instance — just load it
      console.log(`Port ${APP_PORT} in use — assuming app already running`);
    } else {
      dialog.showErrorBox('YATA', `ไม่สามารถเริ่ม server: ${e.message}`);
      app.quit();
      return;
    }
  }

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'YATA — ระบบบันทึกการผลิตยาตาเฉพาะราย',
    icon: path.join(distPath, 'icons', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${APP_PORT}/`);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  await createWindow();
  setTimeout(() => void checkForUpdates(), 5000);
  setInterval(() => void checkForUpdates(), UPDATE_INTERVAL_MS);
});

app.on('window-all-closed', () => {
  if (staticServer) staticServer.close();
  app.quit();
});
