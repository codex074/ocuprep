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
// Patient-name lookup is no longer done here: the renderer asks the Vercel functions in /api
// (src/lib/patientLookup.ts), so this app embeds no token.

const DEFAULT_SETTINGS = {
  updateManifestUrl: '',
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      delete saved.hosxpToken;
      delete saved.hosxpTokenHis;
      delete saved.hosxpApiUrl;
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

// Network/shared printers can leave Electron waiting indefinitely while the
// Windows print spooler tries to contact the host PC. Keep those waits bounded
// so a disconnected host never makes the rest of YATA unusable.
const PRINT_JOB_TIMEOUT_MS = 30000;
const PRINT_FONT_TIMEOUT_MS = 5000;

function withTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

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

// --- IPC Handlers ---
// A v2.0.3 renderer still cached by the service worker calls these two; keep them answering.
ipcMain.handle('lookup-hn', () => ({
  ok: false, failure: true, message: 'กรุณาปิดแล้วเปิดแอปใหม่เพื่อใช้การค้นชื่อแบบใหม่',
}));
ipcMain.handle('get-hn-settings', () => ({ hosxpApiUrl: '', hasToken: false, hasTokenHis: false }));

ipcMain.handle('save-hn-settings', (_event, s) => {
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

// --- Label printing (8.5×6cm) — ONE delivery path, see Audit.md P0 ---
// The renderer sends the full label HTML; we render it in a hidden window and
// print it with webContents.print() using the canonical Windows DEVMODE encoding:
// portrait-normalized paper (width ≤ length) plus the orientation flag —
// { width: 60000, height: 85000 }, landscape: true. Validated fleet-wide in
// v1.0.13. Do NOT change to { width: 85000, height: 60000 }, landscape: false —
// that combination is the original 90°-rotation P0 bug.
//
// 🔴 There is deliberately NO silent-print path (removed 2026-07-13).
// v1.0.17 added one — printToPDF + a bundled SumatraPDF spooling to a printer saved
// in the profile — to escape the rotation bug. It became the rotation bug: on the
// Zebra ZD230 fleet the silent path printed every label rotated 90°, while this
// dialog path printed correctly on the same machine. Not one station ever had it
// working. Each attempt to add a shortcut around the print dialog has produced a new
// way to rotate labels (see the ledger in Audit.md), so the shortcut is gone: every
// print goes through the dialog. The cost is one extra click per job.
// Do not reintroduce silent printing without a machine that reproduces both paths.
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
    // Continue with the fallback font if the client cannot reach Google Fonts.
    try {
      await withTimeout(
        printWin.webContents.executeJavaScript(
          'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
        ),
        PRINT_FONT_TIMEOUT_MS,
        'โหลดฟอนต์สำหรับพิมพ์ไม่สำเร็จภายใน 5 วินาที',
      );
    } catch {}

    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        finish({
          success: false,
          reason: 'เครื่องพิมพ์ไม่ตอบสนองภายใน 30 วินาที กรุณาตรวจสอบเครื่องแม่ข่ายหรือ Print Spooler',
        });
      }, PRINT_JOB_TIMEOUT_MS);

      try {
        printWin.webContents.print(
          {
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' },
            // Canonical DEVMODE encoding for the dialog path — see the comment
            // above the handler and Audit.md P0 before changing either value.
            pageSize: { width: 60000, height: 85000 },
            landscape: true,
          },
          (success, reason) => finish({ success, reason }),
        );
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });

    if (!result.success) {
      return { ok: false, message: result.reason || 'ยกเลิกการพิมพ์' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[print-labels]', e.message);
    return { ok: false, message: e.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    fs.rm(tmpFile, { force: true }, () => {});
  }
});

// --- Compact IPD label printing (7.5×3.5cm) ---
// New, separate print path added for the small IPD label stock. Mirrors the
// print-labels handler above exactly (same dialog-only discipline, same
// font-wait/timeout behavior). The pageSize/landscape pairing below is
// derived from the SAME portrait-normalize + landscape convention validated
// for the 8.5×6cm case (width ≤ height, landscape:true) — content is
// authored 75mm wide × 35mm tall, so the portrait-normalized DEVMODE is
// { width: 35000, height: 75000 }. This has NOT been physically validated
// on a real printer yet — test on actual IPD label stock before trusting
// this for production. Do not touch the print-labels handler above while
// adding this; keep the two paths fully independent (see Audit.md P0).
ipcMain.handle('print-compact-label', async (_event, html) => {
  if (typeof html !== 'string' || !html) {
    return { ok: false, message: 'ไม่มีเนื้อหาให้พิมพ์' };
  }
  const tmpFile = path.join(app.getPath('temp'), `yata-compact-label-${process.pid}-${printSeq++}.html`);
  let printWin = null;
  try {
    fs.writeFileSync(tmpFile, html, 'utf8');
    printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await printWin.loadFile(tmpFile);

    try {
      await withTimeout(
        printWin.webContents.executeJavaScript(
          'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
        ),
        PRINT_FONT_TIMEOUT_MS,
        'โหลดฟอนต์สำหรับพิมพ์ไม่สำเร็จภายใน 5 วินาที',
      );
    } catch {}

    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        finish({
          success: false,
          reason: 'เครื่องพิมพ์ไม่ตอบสนองภายใน 30 วินาที กรุณาตรวจสอบเครื่องแม่ข่ายหรือ Print Spooler',
        });
      }, PRINT_JOB_TIMEOUT_MS);

      try {
        printWin.webContents.print(
          {
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' },
            // Derived-by-convention DEVMODE for 75×35mm content — see comment
            // above the handler. NOT physically validated yet.
            pageSize: { width: 35000, height: 75000 },
            landscape: true,
          },
          (success, reason) => finish({ success, reason }),
        );
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });

    if (!result.success) {
      return { ok: false, message: result.reason || 'ยกเลิกการพิมพ์' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[print-compact-label]', e.message);
    return { ok: false, message: e.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    fs.rm(tmpFile, { force: true }, () => {});
  }
});

// Label-printer selection (get-label-printer-settings / save-label-printer) was
// removed with the silent-print path on 2026-07-13 — see the print handler above.

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
  win.on('closed', () => {
    win = null;
  });

  // Older desktop builds registered the PWA service worker on this localhost
  // origin. Its auto-update handler reloads the page when a new app bundle is
  // detected, which can clear a Login form that is already being filled in.
  // Electron has its own updater, so remove only SW/Cache Storage here while
  // preserving localStorage (the signed-in session and other app settings).
  try {
    await withTimeout(
      win.webContents.session.clearStorageData({
        origin: `http://127.0.0.1:${APP_PORT}`,
        storages: ['serviceworkers', 'cachestorage'],
      }),
      5000,
      'ล้าง service worker เดิมไม่สำเร็จภายใน 5 วินาที',
    );
  } catch (error) {
    console.warn('[desktop-cache-cleanup]', error.message);
  }

  await win.loadURL(`http://127.0.0.1:${APP_PORT}/`);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
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
