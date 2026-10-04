const path = require('node:path');
const { createGameKeyMonitor } = require('./game-keys.cjs');
const { createReminderEngine } = require('./reminders.cjs');

function createCompanionController({ BrowserWindow, screen, secure, load, state, emit, monitorFactory = createGameKeyMonitor }) {
  let window, loading, bounds, monitoring = false, stopped = false;
  const engine = createReminderEngine();
  const wanted = () => !stopped && (state.companion.previewUntil > Date.now() ||
    (state.overlay.visible && state.live && state.companion.focused &&
      (state.companion.alerts.length || (state.companion.tab && state.settings.scoreboard.enabled))));
  async function sync() {
    if (!wanted()) { window?.hide(); return; }
    if (!window && !loading) loading = (async () => {
      window = new BrowserWindow({ ...screen.getPrimaryDisplay().bounds, transparent: true, frame: false,
        resizable: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: false,
        show: false, title: 'DPM.lol reminders', webPreferences: { preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
      secure(window); window.setAlwaysOnTop(true, 'screen-saver');
      window.setIgnoreMouseEvents(true, { forward: true });
      window.on('closed', () => { window = null; });
      await load(window, '/companion');
    })().finally(() => { loading = null; });
    if (loading) await loading;
    if (!wanted() || !window) { window?.hide(); return; }
    const target = state.companion.focused && bounds
      ? screen.screenToDipRect(null, bounds) : screen.getPrimaryDisplay().bounds;
    const current = window.getBounds();
    if (['x', 'y', 'width', 'height'].some(key => current[key] !== target[key])) window.setBounds(target);
    if (!window.isVisible()) window.showInactive();
  }
  function syncSafely() { sync().catch(() => {
    if (!stopped && state.companion.error !== 'The reminder layer could not open. Restart the app to retry.') {
      state.companion.error = 'The reminder layer could not open. Restart the app to retry.'; emit();
    }
  }); }
  function setFocus(value) {
    state.companion.focused = value.focused; state.companion.tab = value.focused && value.tab;
    bounds = value.bounds; emit(); syncSafely();
  }
  const monitor = monitorFactory(setFocus, error => { state.companion.error = error; emit(); });
  function update() {
    const enabled = !!state.live && state.overlay.visible && (state.settings.reminders.enabled || state.settings.scoreboard.enabled);
    if (enabled !== monitoring) { monitoring = enabled; enabled ? monitor.start() : monitor.stop(); }
    state.companion.alerts = engine.update(state.overlay.visible ? state.live : null, state.settings.reminders);
    syncSafely();
  }
  async function preview(kind) {
    if (!['health', 'mana', 'dragon', 'scoreboard'].includes(kind)) throw new Error('Unknown preview.');
    state.companion.previewKind = kind;
    state.companion.previewUntil = Date.now() + state.settings.reminders.duration * 1000;
    emit(); await sync();
  }
  const timer = setInterval(() => {
    const now = Date.now(), previous = state.companion.alerts.length;
    state.companion.alerts = state.companion.alerts.filter(alert => alert.expiresAt > now);
    const expired = state.companion.previewUntil > 0 && state.companion.previewUntil <= now;
    if (expired) { state.companion.previewUntil = 0; state.companion.previewKind = null; }
    if (previous !== state.companion.alerts.length || expired) { emit(); syncSafely(); }
  }, 250);
  function stop() { stopped = true; clearInterval(timer); monitor.stop(); window?.close(); }
  return { update, preview, stop, getWindow: () => window, setFocus };
}
module.exports = { createCompanionController };
