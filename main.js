// Moj Bioskop — glavni proces (Electron)
const { app, BrowserWindow, ipcMain, shell, net, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* dev bez paketa */ }

const UA = `MojBioskop v${app.getVersion()}`;
let win = null;
const streamHeaders = new Map(); // host -> { referer, ua }

const cacheDir = () => {
  const d = path.join(app.getPath('userData'), 'cache');
  fs.mkdirSync(d, { recursive: true });
  return d;
};

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#0b0b0f',
    title: 'Moj Bioskop',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Svaki pokušaj otvaranja novog prozora ide u podrazumevani pregledač
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
}

// Neki TV strimovi traže Referer / User-Agent; YouTube embed traži Referer
function setupHeaders() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const h = details.requestHeaders;
    try {
      const u = new URL(details.url);
      const s = streamHeaders.get(u.host);
      if (s) {
        if (s.referer) h['Referer'] = s.referer;
        if (s.ua) h['User-Agent'] = s.ua;
      }
      if (/(^|\.)(youtube|youtube-nocookie)\.com$/.test(u.host) && !h['Referer']) {
        h['Referer'] = 'https://www.youtube-nocookie.com/';
      }
    } catch (_) {}
    cb({ requestHeaders: h });
  });
}

async function doFetch(url, opts = {}) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Neispravan URL');
  const res = await net.fetch(url, {
    method: opts.method || 'GET',
    headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', ...(opts.headers || {}) },
    body: opts.body,
  });
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.text()).slice(0, 300); } catch (_) {}
    const err = new Error(`HTTP ${res.status} ${msg}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// ---------- IPC ----------
ipcMain.handle('http:json', async (_e, url, opts) => (await doFetch(url, opts)).json());

ipcMain.handle('http:buffer', async (_e, url, opts) => {
  const buf = await (await doFetch(url, opts)).arrayBuffer();
  return new Uint8Array(buf);
});

// JSON sa keširanjem na disku (za velike baze: TV kanali, katalog, YouTube)
ipcMain.handle('cache:json', async (_e, key, url, maxAgeHours = 24, force = false) => {
  const file = path.join(cacheDir(), key.replace(/[^a-z0-9_.-]/gi, '_') + '.json');
  let stale = null;
  try {
    const st = fs.statSync(file);
    stale = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!force && Date.now() - st.mtimeMs < maxAgeHours * 3600e3) return stale;
  } catch (_) {}
  try {
    const data = await (await doFetch(url)).json();
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
  } catch (err) {
    if (stale) return stale;
    throw err;
  }
});

ipcMain.handle('cache:clear', async () => {
  fs.rmSync(cacheDir(), { recursive: true, force: true });
  return true;
});

// Katalog sajtova: prvo onlajn verzija (da se novi sajtovi i naslovi pojave sami), pa ugrađena
ipcMain.handle('catalog:load', async (_e, url) => {
  const bundled = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'catalog.json'), 'utf8'));
  if (url && !url.includes('TVOJ-GITHUB-NALOG')) {
    try {
      const file = path.join(cacheDir(), 'catalog_remote.json');
      let remote;
      try {
        remote = await (await doFetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now())).json();
        fs.writeFileSync(file, JSON.stringify(remote));
      } catch (e) {
        if (fs.existsSync(file)) remote = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
      const local = bundled();
      if (remote && (remote.version || 0) >= (local.version || 0)) return { ...remote, source: 'online' };
      return { ...local, source: 'ugrađen' };
    } catch (_) {}
  }
  return { ...bundled(), source: 'ugrađen' };
});

ipcMain.handle('stream:headers', (_e, url, referer, ua) => {
  try {
    const host = new URL(url).host;
    if (referer || ua) streamHeaders.set(host, { referer, ua });
    else streamHeaders.delete(host);
  } catch (_) {}
  return true;
});

ipcMain.handle('open:external', (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  return true;
});

ipcMain.handle('file:subtitle', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Izaberi titl',
    properties: ['openFile'],
    filters: [{ name: 'Titlovi', extensions: ['srt', 'vtt', 'sub', 'txt'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return { name: path.basename(r.filePaths[0]), data: new Uint8Array(fs.readFileSync(r.filePaths[0])) };
});

ipcMain.handle('app:version', () => app.getVersion());

// ---------- Automatsko ažuriranje aplikacije ----------
function sendUpdate(state) { if (win && !win.isDestroyed()) win.webContents.send('update:status', state); }

function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  autoUpdater.on('update-available', (i) => sendUpdate({ state: 'available', version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'none' }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => sendUpdate({ state: 'error', message: String(e && e.message || e).slice(0, 200) }));
  const check = () => { if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 5000);
  setInterval(check, 4 * 3600e3);
}

ipcMain.handle('update:check', async () => {
  if (!autoUpdater || !app.isPackaged) return { state: 'dev' };
  try { await autoUpdater.checkForUpdates(); return { state: 'checking' }; }
  catch (e) { return { state: 'error', message: String(e.message || e) }; }
});
ipcMain.handle('update:install', () => { if (autoUpdater) autoUpdater.quitAndInstall(false, true); });

// ---------- Start ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    setupHeaders();
    createWindow();
    setupUpdater();
  });
  app.on('window-all-closed', () => app.quit());
}
