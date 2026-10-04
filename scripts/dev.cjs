const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const root = path.join(__dirname, '..');
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit', windowsHide: true });
let desktop;
let stopping = false;
function stop() { if (stopping) return; stopping = true; desktop?.kill(); vite.kill(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
vite.on('exit', stop);
function ready() {
  if (stopping) return;
  const req = http.get('http://127.0.0.1:5173', res => {
    res.resume();
    if (res.statusCode === 200) {
      const env = { ...process.env, RIFT_DEV_URL: 'http://127.0.0.1:5173' };
      delete env.ELECTRON_RUN_AS_NODE;
      desktop = spawn(require('electron'), [root], { cwd: root, env, stdio: 'inherit', windowsHide: true });
      desktop.on('exit', stop);
    } else setTimeout(ready, 400);
  });
  req.on('error', () => setTimeout(ready, 400));
}
ready();
