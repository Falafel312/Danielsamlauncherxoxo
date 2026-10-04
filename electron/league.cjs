const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
// Only this loopback agent accepts League's self-signed certificate.
const leagueAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 6 });
function requestLocal({ port, password }, endpoint, method = 'GET', body) {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535 || !endpoint.startsWith('/')) return Promise.reject(new Error('Invalid local endpoint.'));
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const headers = { Accept: 'application/json' };
    if (password) headers.Authorization = `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`;
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const req = https.request({ hostname: '127.0.0.1', port, path: endpoint, method, headers, agent: leagueAgent, timeout: 2200 }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) req.destroy(new Error('Local response too large.')); else chunks.push(chunk); });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) { const err = new Error(`League client returned ${res.statusCode}.`); err.status = res.statusCode; reject(err); return; }
        try { const text = Buffer.concat(chunks).toString('utf8'); resolve(text ? JSON.parse(text) : null); } catch { reject(new Error('Invalid League response.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('League connection timed out.')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
function parseLockfile(text) {
  const [name, pid, port, password, protocol] = text.trim().split(':');
  if (!name || !/^\d+$/.test(pid || '') || !/^\d+$/.test(port || '') || Number(port) < 1 || Number(port) > 65535 || !password || protocol !== 'https') throw new Error('Invalid League lockfile.');
  return { port: Number(port), password };
}
async function discoverLockfile(customPath, cachedPath) {
  const candidates = [customPath, cachedPath, 'C:/Riot Games/League of Legends/lockfile', 'D:/Riot Games/League of Legends/lockfile', 'C:/Program Files/Riot Games/League of Legends/lockfile', 'C:/Program Files (x86)/Riot Games/League of Legends/lockfile'].filter(Boolean);
  for (const candidate of candidates) { try { return { ...parseLockfile(await fs.readFile(candidate, 'utf8')), file: candidate }; } catch {} }
  if (process.platform !== 'win32') return null;
  const executable = await new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" -ErrorAction SilentlyContinue | Select-Object -First 1).ExecutablePath"], { windowsHide: true, timeout: 3500 }, (err, stdout) => resolve(err ? '' : stdout.trim()));
  });
  if (executable) { try { const file = path.join(path.dirname(executable), 'lockfile'); return { ...parseLockfile(await fs.readFile(file, 'utf8')), file }; } catch {} }
  return null;
}
function normalizeLive(raw) {
  if (!raw?.activePlayer || !raw?.gameData || !Array.isArray(raw.allPlayers)) throw new Error('Incomplete live game data.');
  const active = raw.activePlayer;
  const identity = active.riotId || active.summonerName;
  const player = raw.allPlayers.find(p => (p.riotId || p.summonerName) === identity || (p.riotIdGameName && p.riotIdGameName === active.riotIdGameName));
  if (!player) throw new Error('Active player is missing from the live game.');
  const scores = player.scores || {};
  const seconds = Math.max(0, Number(raw.gameData.gameTime) || 0);
  return {
    time: seconds, championName: player.championName || '', championId: String(player.rawChampionName || '').replace(/^game_character_displayname_/, ''),
    name: active.riotId || active.summonerName || 'Summoner', level: Number(active.level) || 1,
    kills: Number(scores.kills) || 0, deaths: Number(scores.deaths) || 0, assists: Number(scores.assists) || 0,
    cs: Number(scores.creepScore) || 0, csPerMin: seconds > 0 ? (Number(scores.creepScore) || 0) / (seconds / 60) : 0,
    vision: typeof scores.wardScore === 'number' && Number.isFinite(scores.wardScore) ? Math.max(0, scores.wardScore) : null,
    csHistory: [],
    gold: Number(active.currentGold) || 0,
    items: (player.items || []).map(item => ({ id: item.itemID, name: item.displayName, count: item.count })),
    health: Number(active.championStats?.currentHealth) || 0, maxHealth: Number(active.championStats?.maxHealth) || 0,
    attackDamage: Number(active.championStats?.attackDamage) || 0, abilityPower: Number(active.championStats?.abilityPower) || 0,
    gameMode: raw.gameData.gameMode || 'CLASSIC',
    mapNumber: Number.isInteger(raw.gameData.mapNumber) ? raw.gameData.mapNumber : null,
    role: ({ TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'adc', UTILITY: 'support' })[player.position] || 'auto',
  };
}
function normalizeMatches(raw, summonerId) {
  const games = raw?.games?.games || raw?.games || [];
  if (!Array.isArray(games)) return [];
  return games.map(game => {
    const identity = game.participantIdentities?.find(p => Number(p.player?.summonerId) === Number(summonerId));
    const participant = game.participants?.find(p => p.participantId === identity?.participantId) || (game.participants?.length === 1 ? game.participants[0] : null);
    if (!participant) return null;
    const stats = participant.stats || {};
    return { id: String(game.gameId), championKey: String(participant.championId), win: !!stats.win, kills: stats.kills || 0, deaths: stats.deaths || 0, assists: stats.assists || 0, cs: (stats.totalMinionsKilled || 0) + (stats.neutralMinionsKilled || 0), duration: game.gameDuration || 0, timestamp: game.gameCreation || 0, queueId: game.queueId, damage: stats.totalDamageDealtToChampions || 0, gold: stats.goldEarned || 0, vision: typeof stats.visionScore === 'number' && Number.isFinite(stats.visionScore) ? stats.visionScore : null, items: [0,1,2,3,4,5].map(i => stats[`item${i}`]).filter(Boolean) };
  }).filter(Boolean);
}
function validateRunePage(input, paths) {
  if (!input || typeof input.champion !== 'string' || !/^[A-Za-z0-9]{1,30}$/.test(input.champion)) throw new Error('Choose a valid champion.');
  const primary = paths.find(p => p.id === input.primaryStyleId);
  const secondary = paths.find(p => p.id === input.subStyleId);
  const perks = input.selectedPerkIds;
  if (!primary || !secondary || primary.id === secondary.id || !Array.isArray(perks) || perks.length !== 9 || !perks.every(Number.isInteger)) throw new Error('Choose two different rune paths and nine valid runes.');
  if (!primary.slots.every((slot, i) => slot.runes.some(r => r.id === perks[i]))) throw new Error('The primary runes must include one rune from each slot.');
  const secondarySlots = perks.slice(4,6).map(id => secondary.slots.findIndex(slot => slot.runes.some(r => r.id === id)));
  if (secondarySlots.some(i => i < 1) || secondarySlots[0] === secondarySlots[1]) throw new Error('Secondary runes must come from two different non-keystone slots.');
  const shardSlots = [[5008,5005,5007],[5008,5010,5001],[5011,5013,5001]];
  if (!perks.slice(6).every((id,i) => shardSlots[i].includes(id))) throw new Error('Choose valid stat shards.');
  return { name: `DPM.lol • ${input.champion}`, primaryStyleId: primary.id, subStyleId: secondary.id, selectedPerkIds: perks, current: true };
}
function sanitizeSettings(input, previous) {
  const result = { ...previous };
  if (typeof input?.autoOverlay === 'boolean') result.autoOverlay = input.autoOverlay;
  if (typeof input?.clickThrough === 'boolean') result.clickThrough = input.clickThrough;
  if (typeof input?.autoDownloadUpdates === 'boolean') result.autoDownloadUpdates = input.autoDownloadUpdates;
  if (typeof input?.opacity === 'number' && Number.isFinite(input.opacity)) result.opacity = Math.max(0.35, Math.min(1, input.opacity));
  if (typeof input?.scale === 'number' && Number.isFinite(input.scale)) result.scale = Math.max(0.8, Math.min(1.4, input.scale));
  if (typeof input?.csTarget === 'number' && Number.isFinite(input.csTarget)) result.csTarget = Math.max(1, Math.min(12, input.csTarget));
  if (['number', 'graph'].includes(input?.csDisplay)) result.csDisplay = input.csDisplay;
  if (input?.widgets && typeof input.widgets === 'object') result.widgets = Object.fromEntries(['cs','vision','waves','goal'].map(key => {
    const value = input.widgets[key] ?? (key === 'waves' ? input.widgets.gold : undefined);
    return [key, typeof value === 'boolean' ? value : previous.widgets[key] ?? (key === 'waves' ? previous.widgets.gold : undefined) ?? true];
  }));
  return result;
}
async function upsertRunePage(credentials, input, paths, request = requestLocal) {
  const page = validateRunePage(input, paths);
  const pages = await request(credentials, '/lol-perks/v1/pages');
  const owned = pages.find(p => p.name === page.name && p.isEditable !== false)
    || pages.find(p => p.name === `Rift • ${input.champion}` && p.isEditable !== false);
  if (owned) await request(credentials, `/lol-perks/v1/pages/${owned.id}`, 'PUT', page);
  else await request(credentials, '/lol-perks/v1/pages', 'POST', page);
  return page.name;
}
module.exports = { requestLocal, parseLockfile, discoverLockfile, normalizeLive, normalizeMatches, validateRunePage, sanitizeSettings, upsertRunePage };
