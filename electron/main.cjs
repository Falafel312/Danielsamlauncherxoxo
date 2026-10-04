const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { requestLive, sanitizeSettings } = require('./league.cjs');
const { DEFAULT_ACCOUNT, validateAccount } = require('../shared/riot.cjs');
const { createProfileController } = require('./riot-profile.cjs');
const { createUpdateService, parseUpdateProvider } = require('./updates.cjs');
const { createBuildService } = require('./builds.cjs');
const { REMINDERS, SCOREBOARD } = require('../shared/overlay-settings.cjs');
const { createCompanionController } = require('./companion.cjs');
const releaseConfig = require('./update-config.json');
if (process.env.RIFT_TEST_USER_DATA) app.setPath('userData', process.env.RIFT_TEST_USER_DATA);
// Preserve the existing update identity and preferences across the display-name change.
if (!process.env.RIFT_TEST_USER_DATA) app.setPath('userData', path.join(app.getPath('appData'), 'Danielsamlauncherxoxo'));
app.setName('DPM.lol');
let getBuild; let csSamples = []; let lastLiveIdentity = ''; let lastLiveTime = 0;
let mainWindow, overlayWindow, timer, profileTimer, profileController, updateTimer, updateService, polling = false, settingsFile, overlayBounds;
let saveTail = Promise.resolve();
let companion;
const defaults = { autoOverlay: true, clickThrough: true, opacity: 0.68, scale: 1, csTarget: 8, csDisplay: 'graph', autoDownloadUpdates: true, updateUrl: releaseConfig.url, widgets: { cs: true, vision: true, waves: true }, reminders: { ...REMINDERS }, scoreboard: { ...SCOREBOARD } };
let state = { connection: 'offline', phase: 'None', summoner: null, ranked: null, matches: [], account: { ...DEFAULT_ACCOUNT }, profile: { status: 'unconfigured', message: '', lastUpdated: null }, live: null, settings: defaults, overlay: { visible: false, editing: false }, companion: { focused: false, tab: false, alerts: [], error: '', previewUntil: 0, previewKind: null }, shortcuts: { toggle: false, edit: false }, lastUpdated: null };
const productionUrl = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
const devUrl = !app.isPackaged && process.env.RIFT_DEV_URL === 'http://127.0.0.1:5173' ? process.env.RIFT_DEV_URL : null;
function isTrusted(event) { const frame = event.senderFrame; if (!frame || frame !== event.sender.mainFrame) return false; try { const url = new URL(frame.url); return devUrl ? url.origin === devUrl : url.protocol === 'file:' && url.pathname === new URL(productionUrl).pathname; } catch { return false; } }
function handle(channel, fn) { ipcMain.handle(channel, (event, ...args) => { if (!isTrusted(event)) throw new Error('Untrusted app frame.'); return fn(event, ...args); }); }
function emit() { for (const window of [mainWindow, overlayWindow, companion?.getWindow()]) if (window && !window.isDestroyed()) window.webContents.send('rift:state', state); }
function save() { const contents = JSON.stringify({ settings: state.settings, account: state.account, overlayBounds }, null, 2); const operation = saveTail.catch(() => {}).then(async () => { const next = `${settingsFile}.tmp`; await fs.writeFile(next, contents); await fs.rename(next, settingsFile); }); saveTail = operation; return operation; }
function secure(window) {
  window.webContents.setWindowOpenHandler(({ url }) => { try { const parsed = new URL(url); if (parsed.protocol === 'https:' && (['developer.riotgames.com', 'op.gg'].includes(parsed.hostname) || (parsed.hostname === 'github.com' && parsed.pathname.startsWith('/Falafel312/Danielsamlauncherxoxo/')))) shell.openExternal(url); } catch {} return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!(devUrl ? url.startsWith(`${devUrl}/`) : url.split('#')[0] === productionUrl)) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}
async function load(window, hash = '') { if (devUrl) await window.loadURL(`${devUrl}/#${hash}`); else await window.loadFile(path.join(__dirname, '../dist/index.html'), { hash }); }
async function createMain() {
  const display = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({ width: Math.min(1440, display.width - 70), height: Math.min(970, display.height - 60), minWidth: 980, minHeight: 650, backgroundColor: '#101114', title: 'DPM.lol', icon: path.join(__dirname, '../dist/dpm.ico'), frame: false, show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  secure(mainWindow);
  mainWindow.once('ready-to-show', () => { if (process.env.RIFT_DESKTOP_TEST !== '1') mainWindow.show(); });
  mainWindow.on('closed', () => { mainWindow = null; app.quit(); });
  await load(mainWindow);
}
function containedBounds() {
  const display = overlayBounds ? screen.getDisplayMatching(overlayBounds).workArea : screen.getPrimaryDisplay().workArea;
  const width = Math.round(336 * state.settings.scale), height = Math.round(360 * state.settings.scale);
  return { x: Math.max(display.x, Math.min(overlayBounds?.x ?? display.x + display.width - width - 28, display.x + display.width - width)), y: Math.max(display.y, Math.min(overlayBounds?.y ?? display.y + 160, display.y + display.height - height)), width, height };
}
async function ensureOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return;
  overlayWindow = new BrowserWindow({ ...containedBounds(), transparent: true, frame: false, resizable: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false, title: 'DPM.lol overlay', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  secure(overlayWindow);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(state.settings.clickThrough, { forward: true });
  overlayWindow.on('moved', () => { if (overlayWindow && !overlayWindow.isDestroyed()) { overlayBounds = overlayWindow.getBounds(); save().catch(() => {}); } });
  overlayWindow.on('closed', () => { overlayWindow = null; state.overlay = { visible: false, editing: false }; emit(); });
  await load(overlayWindow, '/overlay');
}
async function showOverlay(show) {
  if (show) { await ensureOverlay(); overlayWindow.showInactive(); }
  else if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  state.overlay.visible = show;
  if (!show && state.overlay.editing) setEditing(false);
  if (!show) { state.companion.previewUntil = 0; state.companion.previewKind = null; }
  companion?.update();
  emit();
}
function setEditing(editing) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  state.overlay.editing = editing;
  overlayWindow.setFocusable(editing);
  overlayWindow.setIgnoreMouseEvents(!editing && state.settings.clickThrough, { forward: true });
  emit();
}
async function poll() {
  if (polling) return state;
  polling = true;
  try {
    const previousLive = !!state.live;
    state.live = await requestLive().catch(() => null);
    if (state.live) {
      const live = state.live;
      const identity = `${live.name}:${live.championId}`;
      if (!previousLive || identity !== lastLiveIdentity || live.time < lastLiveTime) csSamples = [];
      if (!csSamples.length || live.time - csSamples[csSamples.length - 1].time >= 15) csSamples.push({ time: live.time, value: live.csPerMin });
      csSamples = csSamples.slice(-240);
      live.csHistory = [...csSamples]; lastLiveIdentity = identity; lastLiveTime = live.time;
    } else { csSamples = []; lastLiveTime = 0; }
    state.connection = state.live ? 'in-game' : state.summoner ? 'connected' : 'offline';
    state.phase = state.live ? 'InProgress' : 'None';
    if (!state.live && previousLive) profileController.refresh(true).catch(() => {});
    if (state.live && !previousLive && state.settings.autoOverlay && process.env.RIFT_DESKTOP_TEST !== '1') await showOverlay(true);
    if (!state.live && previousLive) await showOverlay(false);
    state.lastUpdated = new Date().toISOString();
    companion?.update();
    emit();
  } finally { polling = false; }
  return state;
}
function registerIpc() {
  handle('rift:state', () => state);
  handle('rift:build', (_event, champion, role, refresh) => getBuild(champion, role, refresh === true));
  handle('rift:refresh', async () => { await Promise.all([poll(), profileController.refresh(true)]); return state; });
  handle('rift:account', async (event, input) => {
    if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error('Account connections are configured from the main app.');
    try {
      const account = validateAccount(input, true);
      state.account = account; profileController.configure(account); await save(); emit();
      profileController.refresh(true).catch(() => {});
      return { ok: true, message: account.riotId ? 'Account saved. Connecting to Riot…' : 'Account disconnected.' };
    } catch (error) { return { ok: false, message: error.message }; }
  });
  handle('rift:settings', async (_event, input) => { state.settings = sanitizeSettings(input, state.settings); if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.setBounds(containedBounds()); setEditing(state.overlay.editing); } if (typeof input?.autoDownloadUpdates === 'boolean') updateService.configure(state.settings); companion?.update(); await save(); emit(); return state.settings; });
  handle('rift:preview-reminder', async (event, kind) => {
    if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error('Previews are configured from the main app.');
    await companion.preview(kind);
  });
  handle('rift:updates', async (event, action, url) => {
    if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error('Updates are configured from the main app.');
    if (action === 'configure') { try { parseUpdateProvider(url); updateService.configure({ ...state.settings, updateUrl: url.trim() }); state.settings.updateUrl = url.trim(); await save(); emit(); if (state.settings.updateUrl) updateService.check(); return { ok: true, message: state.settings.updateUrl ? 'Release server saved. Installed builds will check and download new versions automatically.' : 'Release server cleared.' }; } catch (error) { return { ok: false, message: error.message }; } }
    if (action === 'check') return updateService.check();
    if (action === 'install') return updateService.install();
    throw new Error('Unknown update action.');
  });
  handle('rift:overlay', async (_event, action) => {
    if (action === 'show' || action === 'hide' || action === 'toggle') await showOverlay(action === 'show' || (action === 'toggle' && !state.overlay.visible));
    else if (action === 'edit') { await showOverlay(true); setEditing(!state.overlay.editing); }
    else if (action === 'reset') { overlayBounds = null; if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setBounds(containedBounds()); await save(); }
    else throw new Error('Unknown overlay action.');
    return state.overlay;
  });
  handle('rift:window', (event, action) => { const window = BrowserWindow.fromWebContents(event.sender); if (window !== mainWindow) return; if (action === 'minimize') window.minimize(); else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize(); else if (action === 'close') window.close(); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    settingsFile = path.join(app.getPath('userData'), 'preferences.json');
    try { const saved = JSON.parse(await fs.readFile(settingsFile, 'utf8')); state.settings = sanitizeSettings(saved.settings, defaults); if (typeof saved.settings?.updateUrl === 'string') { parseUpdateProvider(saved.settings.updateUrl); state.settings.updateUrl = saved.settings.updateUrl; } if (saved.account) state.account = validateAccount(saved.account, true); overlayBounds = saved.overlayBounds?.width ? saved.overlayBounds : null; } catch {}
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    // Rewrite older preferences to remove the obsolete League installation path.
    await save();
    profileController = createProfileController({ onChange: update => {
      Object.assign(state, update);
      state.connection = state.live ? 'in-game' : state.summoner ? 'connected' : 'offline';
      emit();
    } });
    profileController.configure(state.account);
    const catalog = { champions: Object.values(JSON.parse(await fs.readFile(path.join(__dirname, '../dist/data/champions.json'), 'utf8')).data), items: JSON.parse(await fs.readFile(path.join(__dirname, '../dist/data/items.json'), 'utf8')).data, runes: JSON.parse(await fs.readFile(path.join(__dirname, '../dist/data/runes.json'), 'utf8')) };
    getBuild = createBuildService({ catalog, cacheDirectory: path.join(app.getPath('userData'), 'build-cache') });
    const installed = app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE && ['Uninstall DPM.lol.exe', 'Uninstall Danielsamlauncherxoxo.exe'].some(name => require('node:fs').existsSync(path.join(path.dirname(process.execPath), name)));
    updateService = createUpdateService({ version: app.getVersion(), supported: installed, emit: updates => { state.updates = updates; emit(); }, isInGame: () => !!state.live || ['InProgress','Reconnect'].includes(state.phase) });
    updateService.configure(state.settings);
    state.updates = updateService.getStatus();
    companion = createCompanionController({ BrowserWindow, screen, secure, load, state, emit });
    registerIpc();
    state.shortcuts.toggle = globalShortcut.register('CommandOrControl+Shift+O', () => showOverlay(!state.overlay.visible));
    state.shortcuts.edit = globalShortcut.register('CommandOrControl+Shift+L', async () => { await showOverlay(true); setEditing(!state.overlay.editing); });
    await createMain();
    poll().catch(() => {});
    profileController.refresh().catch(() => {});
    profileTimer = setInterval(() => profileController.refresh().catch(() => {}), 10000);
    // Every fresh gold/inventory snapshot recalculates Waves to item in the HUD,
    // including gold from kills, assists, passive income, and component purchases.
    timer = setInterval(() => poll().catch(() => {}), 3000);
    if (state.settings.updateUrl) setTimeout(() => updateService.check(), 6000);
    updateTimer = setInterval(() => { if (state.settings.updateUrl) updateService.check(); }, 4 * 60 * 60 * 1000);
    if (process.env.RIFT_DESKTOP_TEST === '1' && !app.isPackaged) require('../scripts/desktop-harness.cjs')({ app, mainWindow, getState: () => state, showOverlay, setEditing, getOverlay: () => overlayWindow, companion });
  }).catch(error => { console.error(error.message); app.quit(); });
}
app.on('before-quit', () => { companion?.stop(); clearInterval(timer); clearInterval(profileTimer); clearInterval(updateTimer); globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => app.quit());
