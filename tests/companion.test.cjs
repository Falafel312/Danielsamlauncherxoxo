const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCompanionController } = require('../electron/companion.cjs');
const { createGameKeyMonitor } = require('../electron/game-keys.cjs');
const { REMINDERS, SCOREBOARD } = require('../shared/overlay-settings.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
test('companion layer follows Tab/focus, preserves click-through and hides with overlay', async () => {
  let focus, starts = 0, stops = 0;
  class Window {
    constructor(options) { this.bounds = { x: 0, y: 0, width: 1920, height: 1080 }; this.options = options; this.visible = false; }
    setAlwaysOnTop(value) { this.top = value; } setIgnoreMouseEvents(value) { this.ignore = value; }
    getBounds() { return this.bounds; } setBounds(value) { this.bounds = value; }
    isVisible() { return this.visible; } hide() { this.visible = false; } showInactive() { this.visible = true; }
    on() {} close() { this.closed = true; }
  }
  const state = { settings: { reminders: { ...REMINDERS }, scoreboard: { ...SCOREBOARD } }, overlay: { visible: true }, live: { time: 100, health: 1000, maxHealth: 1000 }, companion: { focused: false, tab: false, alerts: [], error: '', previewUntil: 0, previewKind: null } };
  const controller = createCompanionController({ BrowserWindow: Window, screen: { getPrimaryDisplay: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }), screenToDipRect: (_, r) => ({ ...r, width: r.width / 2, height: r.height / 2 }) }, secure() {}, load: async () => {}, state, emit() {}, monitorFactory: change => { focus = change; return { start: () => starts++, stop: () => stops++ }; } });
  try {
    controller.update(); assert.equal(starts, 1);
    const bounds = { x: 1920, y: 0, width: 2560, height: 1440 };
    focus({ focused: true, tab: true, bounds }); await tick();
    const window = controller.getWindow();
    assert.equal(window.visible, true); assert.equal(window.options.focusable, false); assert.equal(window.ignore, true);
    assert.deepEqual(window.bounds, { x: 1920, y: 0, width: 1280, height: 720 });
    focus({ focused: true, tab: false, bounds }); await tick(); assert.equal(window.visible, false);
    focus({ focused: false, tab: true, bounds }); await tick(); assert.equal(window.visible, false);
    focus({ focused: true, tab: true, bounds }); await tick(); assert.equal(window.visible, true);
    state.overlay.visible = false; controller.update(); await tick(); assert.equal(window.visible, false); assert.equal(stops, 1);
    await controller.preview('health'); assert.equal(window.visible, true);
    await assert.rejects(controller.preview('unrecognized'));
  } finally { controller.stop(); }
});
test('Windows Tab helper starts and emits a validated focus snapshot', { skip: process.platform !== 'win32', timeout: 20000 }, async () => {
  let monitor;
  try {
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('Windows focus snapshot timed out')); monitor.stop(); }, 15000);
      monitor = createGameKeyMonitor(value => { clearTimeout(timeout); setImmediate(() => resolve(value)); }, error => { clearTimeout(timeout); reject(new Error(error)); });
      monitor.start();
    });
    assert.equal(typeof result.focused, 'boolean'); assert.equal(typeof result.tab, 'boolean');
  } finally { monitor?.stop(); }
});
