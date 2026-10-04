import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createBuildService } = require('./electron/builds.cjs');
const catalog = { champions: Object.values(require('./public/data/champions.json').data), items: require('./public/data/items.json').data, runes: require('./public/data/runes.json') };
const getBuild = createBuildService({ catalog });
export default defineConfig({ base: './', server: { port: 5173, strictPort: true }, plugins: [react(), { name: 'dpm-build-preview', configureServer(server) {
  server.middlewares.use('/api/build', async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json');
    try { res.end(JSON.stringify(await getBuild(url.searchParams.get('champion'), url.searchParams.get('role') || 'auto', url.searchParams.get('refresh') === 'true'))); }
    catch (error) { res.statusCode = 502; res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Build unavailable.' })); }
  });
} }] });
