const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
fs.mkdirSync(path.join(root, '.qa'), { recursive: true });
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
const staging = fs.mkdtempSync(path.join(root, '.qa/backend-package-'));
const folder = path.join(staging, 'DPM.lol-Riot-Backend');
// Explicit allowlist: actual .env files and developer credentials cannot enter the archive.
for (const file of ['server/index.cjs', 'server/riot-api.cjs', 'server/.env.example', 'server/README.md', 'shared/riot.cjs']) {
  const target = path.join(folder, file);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target);
}
fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ name: 'dpm-lol-riot-backend', version, private: true, engines: { node: '>=24' }, scripts: { start: 'node --env-file-if-exists=server/.env server/index.cjs', api: 'node --env-file-if-exists=server/.env server/index.cjs' } }, null, 2));
fs.copyFileSync(path.join(root, 'server/README.md'), path.join(folder, 'README.md'));
const archive = path.join(root, 'release', `DPM.lol-Riot-Backend-${version}.zip`);
const quote = value => `'${value.replaceAll("'", "''")}'`;
fs.rmSync(archive, { force: true });
// Use the Windows .NET ZIP implementation without depending on optional modules.
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem'); [IO.Compression.ZipFile]::CreateFromDirectory(${quote(folder)}, ${quote(archive)}, [IO.Compression.CompressionLevel]::Optimal, $true)`], { windowsHide: true, stdio: 'inherit' });
console.log(`Backend package: ${path.basename(archive)}`);
