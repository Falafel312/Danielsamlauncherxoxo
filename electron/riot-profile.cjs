const http = require('node:http');
const https = require('node:https');
const { validateAccount } = require('../shared/riot.cjs');

function decodeProfile(data) {
  const invalid = () => { throw new Error('The backend returned invalid profile data.'); };
  const text = (value, max) => typeof value === 'string' && value.length <= max ? value : invalid();
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : invalid();
  if (!data?.summoner || !Array.isArray(data.matches) || data.matches.length > 20 || !Number.isFinite(Date.parse(data.fetchedAt))) invalid();
  const summoner = { name: text(data.summoner.name, 64), tag: text(data.summoner.tag, 16), level: number(data.summoner.level), icon: number(data.summoner.icon) };
  const ranked = data.ranked == null ? null : { tier: text(data.ranked.tier, 24), division: text(data.ranked.division, 5), leaguePoints: number(data.ranked.leaguePoints), wins: number(data.ranked.wins), losses: number(data.ranked.losses) };
  const matches = data.matches.map(match => {
    if (!match || typeof match.win !== 'boolean' || !Array.isArray(match.items) || match.items.length > 6) invalid();
    const result = { id: text(match.id, 64), championKey: text(match.championKey, 10), win: match.win, vision: match.vision === null ? null : number(match.vision), items: match.items.map(number) };
    for (const field of ['kills', 'deaths', 'assists', 'cs', 'duration', 'timestamp', 'queueId', 'damage', 'gold']) result[field] = number(match[field]);
    return result;
  });
  return { summoner, ranked, matches, fetchedAt: new Date(data.fetchedAt).toISOString(), notice: typeof data.notice === 'string' ? data.notice.slice(0, 240) : '', retryAfter: Math.max(0, Number(data.retryAfter) || 0) };
}

function fetchProfile(input) {
  const config = validateAccount(input);
  const url = new URL(`${config.serverUrl}/v1/profile`);
  url.searchParams.set('riotId', config.riotId); url.searchParams.set('platform', config.platform);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, { headers: { Accept: 'application/json' } }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 512 * 1024) req.destroy(new Error('The backend response was too large.')); else chunks.push(chunk); });
      res.on('error', () => req.destroy(new Error('The backend connection was interrupted.')));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode !== 200) {
            const error = new Error(typeof data.message === 'string' ? data.message.slice(0, 240) : 'The Riot backend could not load your account.');
            error.retryAfter = Math.max(0, Number(data.retryAfter) || Number(res.headers['retry-after']) || 0);
            throw error;
          }
          resolve(decodeProfile(data));
        } catch (error) { reject(error instanceof SyntaxError ? new Error('The backend returned invalid JSON.') : error); }
      });
    });
    const timer = setTimeout(() => req.destroy(new Error('The Riot backend timed out. Your overlay is still available.')), 45000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', error => reject(new Error(['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(error.code) ? 'Could not reach your Riot backend. Start it or check the URL in Settings.' : error.message)));
  });
}

// Cloud refreshes never run on the three-second live-game polling path.
function createProfileController({ fetcher = fetchProfile, onChange, now = Date.now }) {
  let config, revision = 0, active = null, nextRefresh = 0, profile = null;
  const status = (state, message = '', lastUpdated = null) => ({ status: state, message, lastUpdated });
  function configure(next) {
    config = validateAccount(next, true); revision++; active = null; nextRefresh = 0; profile = null;
    onChange({ summoner: null, ranked: null, matches: [], profile: status(config.riotId ? 'idle' : 'unconfigured') });
  }
  async function refresh(force = false) {
    if (!config?.riotId) return;
    if (active) return active;
    if (now() < nextRefresh && !force) return;
    // Manual refreshes may bypass the regular interval, never the error backoff.
    if (now() < nextRefresh && profile?.profile.status === 'error') return;
    const run = revision, account = { ...config };
    onChange({ profile: status('loading', '', profile?.profile.lastUpdated || null) });
    const operation = (async () => {
      try {
        const result = await Promise.resolve().then(() => fetcher(account));
        if (run !== revision) return;
        profile = { summoner: result.summoner, ranked: result.ranked, matches: result.matches, profile: status(result.notice ? 'partial' : 'connected', result.notice, result.fetchedAt) };
        nextRefresh = now() + (result.retryAfter ? Math.max(60, result.retryAfter) * 1000 : 300000);
        onChange(profile);
      } catch (error) {
        if (run !== revision) return;
        const failed = status('error', error.message, profile?.profile.lastUpdated || null);
        profile = { ...(profile || {}), profile: failed };
        nextRefresh = now() + Math.max(30, error.retryAfter || 0) * 1000;
        onChange({ profile: failed });
      } finally { if (run === revision) active = null; }
    })();
    active = operation; return operation;
  }
  return { configure, refresh };
}
module.exports = { fetchProfile, createProfileController, decodeProfile };
