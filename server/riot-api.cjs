const { PLATFORMS, parseRiotId, validatePlatform } = require('../shared/riot.cjs');

class ApiError extends Error {
  constructor(status, code, message, retryAfter = 0) { super(message); Object.assign(this, { status, code, retryAfter }); }
}
const number = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
function normalizeMatch(raw, puuid) {
  const info = raw?.info;
  if (!info || info.gameType === 'CUSTOM_GAME' || info.queueId === 0) return null;
  const player = info.participants?.find(p => p.puuid === puuid);
  if (!player || !raw.metadata?.matchId || !number(info.gameDuration)) return null;
  return {
    id: String(raw.metadata.matchId), championKey: String(player.championId), win: player.win === true,
    kills: number(player.kills), deaths: number(player.deaths), assists: number(player.assists),
    cs: number(player.totalMinionsKilled) + number(player.neutralMinionsKilled),
    duration: number(info.gameDuration), timestamp: number(info.gameStartTimestamp || info.gameCreation), queueId: number(info.queueId),
    damage: number(player.totalDamageDealtToChampions), gold: number(player.goldEarned),
    vision: typeof player.visionScore === 'number' && Number.isFinite(player.visionScore) ? number(player.visionScore) : null,
    items: Array.from({ length: 6 }, (_, i) => number(player[`item${i}`])).filter(Boolean),
  };
}
function createRiotService({ apiKey, fetcher = fetch, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), interval = 80 } = {}) {
  const profiles = new Map(), matches = new Map(), pending = new Map();
  let tail = Promise.resolve(), requests = [], blockedUntil = 0, lastRequest = 0;
  function remember(cache, key, value, max) { cache.delete(key); cache.set(key, { time: now(), value }); if (cache.size > max) cache.delete(cache.keys().next().value); }
  function request(route, endpoint) {
    // Serial pacing plus both developer-key windows. A 429 pauses the whole key.
    const operation = tail.catch(() => {}).then(async () => {
      if (!apiKey) throw new ApiError(503, 'KEY_MISSING', 'Set RIOT_API_KEY on the DPM.lol backend, then restart it.');
      const remaining = blockedUntil - now();
      if (remaining > 0) throw new ApiError(429, 'RATE_LIMITED', 'Riot requests are paused. Retrying automatically.', Math.ceil(remaining / 1000));
      requests = requests.filter(time => now() - time < 120000);
      if (requests.length >= 100) throw new ApiError(429, 'RATE_LIMITED', 'Riot requests are paused. Retrying automatically.', Math.max(1, Math.ceil((requests[0] + 120000 - now()) / 1000)));
      const wait = Math.max(0, interval - (now() - lastRequest));
      if (wait) await pause(wait);
      requests.push(now()); lastRequest = now();
      let response;
      try {
        response = await fetcher(`https://${route}.api.riotgames.com${endpoint}`, { headers: { 'X-Riot-Token': apiKey, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
      } catch { throw new ApiError(502, 'RIOT_OFFLINE', 'Riot could not be reached. Your live overlay is still available.'); }
      if (!response.ok) {
        if (response.status === 429) {
          const header = response.headers.get('retry-after');
          const seconds = /^\d+(\.\d+)?$/.test(header || '') ? Number(header) : Math.ceil((Date.parse(header) - now()) / 1000);
          const retryAfter = Math.max(1, Number.isFinite(seconds) ? seconds : 120);
          blockedUntil = now() + retryAfter * 1000;
          throw new ApiError(429, 'RATE_LIMITED', 'Riot requests are paused. Retrying automatically.', retryAfter);
        }
        if ([401, 403].includes(response.status)) throw new ApiError(503, 'KEY_REJECTED', 'Riot rejected the backend API key. Renew or replace it on the server.');
        if (response.status === 404) throw new ApiError(404, 'NOT_FOUND', 'Account not found. Check the Riot ID and League server.');
        throw new ApiError(502, 'RIOT_UNAVAILABLE', 'Riot account data is temporarily unavailable.');
      }
      try { return await response.json(); } catch { throw new ApiError(502, 'INVALID_RIOT_DATA', 'Riot returned incomplete account data.'); }
    });
    tail = operation;
    return operation;
  }
  async function getProfile(input) {
    let id, platform;
    try { id = parseRiotId(input.riotId); platform = validatePlatform(input.platform); }
    catch (error) { throw new ApiError(400, 'INVALID_ACCOUNT', error.message); }
    const key = `${platform}:${id.gameName.toLowerCase()}#${id.tagLine.toLowerCase()}`;
    const cached = profiles.get(key);
    if (cached && now() - cached.time < 60000) return cached.value;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 8) throw new ApiError(429, 'BUSY', 'The backend is busy. Try again shortly.', 30);
    const operation = (async () => {
      const region = PLATFORMS[platform];
      // ACCOUNT-V1 uses three clusters; SEA accounts are available through ASIA.
      const account = await request(region === 'sea' ? 'asia' : region, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(id.gameName)}/${encodeURIComponent(id.tagLine)}`);
      if (typeof account?.puuid !== 'string' || !account.puuid) throw new ApiError(502, 'INVALID_RIOT_DATA', 'Riot returned incomplete account data.');
      const puuid = encodeURIComponent(account.puuid);
      const [summoner, entries, ids] = await Promise.all([
        request(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
        request(platform, `/lol/league/v4/entries/by-puuid/${puuid}`),
        request(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`),
      ]);
      if (!summoner || !Array.isArray(entries) || !Array.isArray(ids)) throw new ApiError(502, 'INVALID_RIOT_DATA', 'Riot returned incomplete account data.');
      const rank = entries.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
      const recent = []; let notice = '', retryAfter = 0;
      for (const matchId of ids.slice(0, 20)) {
        if (typeof matchId !== 'string' || !/^[A-Z0-9]+_\d+$/.test(matchId)) continue;
        const matchKey = `${account.puuid}:${matchId}`;
        try {
          const saved = matches.get(matchKey);
          let match;
          if (saved && now() - saved.time < 86400000) match = saved.value;
          else { match = normalizeMatch(await request(region, `/lol/match/v5/matches/${encodeURIComponent(matchId)}`), account.puuid); remember(matches, matchKey, match, 500); }
          if (match) recent.push(match);
        } catch (error) {
          if (error.code === 'NOT_FOUND') continue;
          if (error.code === 'KEY_REJECTED') throw error;
          notice = 'Some recent matches could not load. Retrying automatically.';
          retryAfter = error.retryAfter || 60; break;
        }
      }
      // Keep previously loaded games if a later refresh is interrupted.
      const combined = notice ? [...new Map([...recent, ...(cached?.value.matches || [])].map(match => [match.id, match])).values()] : recent;
      const profile = {
        summoner: { name: account.gameName || id.gameName, tag: account.tagLine || id.tagLine, level: number(summoner.summonerLevel), icon: number(summoner.profileIconId) },
        ranked: rank ? { tier: String(rank.tier || 'UNRANKED'), division: String(rank.rank || ''), leaguePoints: number(rank.leaguePoints), wins: number(rank.wins), losses: number(rank.losses) } : null,
        matches: combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20),
        fetchedAt: new Date(now()).toISOString(), notice, retryAfter,
      };
      remember(profiles, key, profile, 100); return profile;
    })();
    pending.set(key, operation);
    try { return await operation; } finally { pending.delete(key); }
  }
  return { getProfile, configured: !!apiKey };
}
module.exports = { ApiError, normalizeMatch, createRiotService };
