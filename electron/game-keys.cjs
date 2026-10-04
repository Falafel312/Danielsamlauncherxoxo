const path = require('node:path');
const { spawn } = require('node:child_process');
function createGameKeyMonitor(onChange, onError = () => {}) {
  let child = null, disabled = false;
  function stop() { const old = child; child = null; old?.kill(); onChange({ focused: false, tab: false, bounds: null }); }
  function start() {
    if (child || disabled || process.platform !== 'win32') return;
    // -Command reads our bundled script so execution does not depend on .ps1 association.
    const script = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'game-keys.ps1');
    try { child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', require('node:fs').readFileSync(script, 'utf8')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { disabled = true; onError('Windows could not monitor Tab. Restart the app to retry.'); return; }
    const current = child; let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString(); if (buffer.length > 16384) buffer = '';
      const lines = buffer.split(/\r?\n/); buffer = lines.pop();
      for (const line of lines) try {
        const value = JSON.parse(line);
        const rect = value.bounds;
        const valid = rect && ['x', 'y', 'width', 'height'].every(key => Number.isInteger(rect[key]) && Math.abs(rect[key]) < 65536) && rect.width >= 100 && rect.height >= 100;
        if (typeof value.focused === 'boolean' && typeof value.tab === 'boolean') onChange({ focused: value.focused && !!valid, tab: value.tab, bounds: valid ? rect : null });
      } catch {}
    });
    child.stderr.on('data', () => {});
    const failed = () => { if (child === current) { child = null; disabled = true; onChange({ focused: false, tab: false, bounds: null }); onError('Windows could not monitor Tab. Restart the app to retry.'); } };
    child.on('error', failed); child.on('exit', failed);
  }
  return { start, stop };
}
module.exports = { createGameKeyMonitor };
