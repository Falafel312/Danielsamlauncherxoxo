const http = require('node:http');
const { createRiotService, ApiError } = require('./riot-api.cjs');

function createServer({ service = createRiotService({ apiKey: process.env.RIOT_API_KEY?.trim() }), host = '127.0.0.1' } = {}) {
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
  return http.createServer(async (req, res) => {
    const send = (status, data, retryAfter = 0) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) });
      res.end(JSON.stringify(data));
    };
    // Desktop requests have no browser Origin. Reject browser cross-origin calls
    // and DNS rebinding against the default, loopback-only backend.
    if (req.headers.origin) return send(403, { code: 'ORIGIN_DENIED', message: 'Connect through the DPM.lol desktop app.' });
    let url;
    try {
      const authority = new URL(`http://${req.headers.host}`);
      if (local && !['127.0.0.1', 'localhost', '[::1]'].includes(authority.hostname)) return send(403, { message: 'Invalid host.' });
      if (!req.url.startsWith('/') || req.url.startsWith('//')) return send(400, { message: 'Invalid request.' });
      url = new URL(req.url, authority);
    } catch { return send(400, { message: 'Invalid request.' }); }
    if (req.method !== 'GET') return send(405, { message: 'Only GET is supported.' });
    if (req.url.length > 1024) return send(414, { message: 'Request is too long.' });
    if (url.pathname === '/health') return send(200, { service: 'DPM.lol Riot API', configured: service.configured });
    if (url.pathname !== '/v1/profile') return send(404, { message: 'Endpoint not found.' });
    try { send(200, await service.getProfile({ riotId: url.searchParams.get('riotId'), platform: url.searchParams.get('platform') })); }
    catch (error) {
      const known = error instanceof ApiError;
      send(known ? error.status : 502, { code: known ? error.code : 'BACKEND_ERROR', message: known ? error.message : 'Account data is temporarily unavailable.', retryAfter: known ? error.retryAfter : 0 }, known ? error.retryAfter : 0);
    }
  });
}
if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4317);
  const server = createServer({ host });
  server.requestTimeout = 60000; server.headersTimeout = 10000;
  server.listen(port, host, () => console.log(`DPM.lol Riot backend listening on ${host}:${port}. API key ${process.env.RIOT_API_KEY ? 'configured' : 'missing; see server/.env.example'}.`));
  server.on('error', error => { console.error(`Backend could not start (${error.code || 'unknown error'}).`); process.exitCode = 1; });
}
module.exports = { createServer };
