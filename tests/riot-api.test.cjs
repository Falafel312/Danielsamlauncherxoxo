const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRiotService, normalizeMatch } = require('../server/riot-api.cjs');
const { createServer } = require('../server/index.cjs');
const { fetchProfile, createProfileController, decodeProfile } = require('../electron/riot-profile.cjs');
const { validateAccount, DEFAULT_ACCOUNT } = require('../shared/riot.cjs');

const input = { riotId: 'Test Player#EUW', platform: 'euw1' };
const fixture = { metadata: { matchId: 'EUW1_1234' }, info: { gameDuration: 1800, gameStartTimestamp: 1720000000000, queueId: 420, gameType: 'MATCHED_GAME', participants: [{ puuid: 'someone-else', kills: 99 }, { puuid: 'own-puuid', championId: 103, kills: 5, deaths: 2, assists: 8, totalMinionsKilled: 190, neutralMinionsKilled: 7, visionScore: 0, win: true, item0: 1056, item1: 3118 }] } };
const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
function fakeRiot(calls, override) {
  return async (url, options) => {
    calls.push({ url, options });
    const custom = override?.(url, options); if (custom) return custom;
    if (url.includes('/riot/account/')) return reply({ puuid: 'own-puuid', gameName: 'Test Player', tagLine: 'EUW' });
    if (url.includes('/summoner/')) return reply({ puuid: 'own-puuid', profileIconId: 29, summonerLevel: 247 });
    if (url.includes('/league/')) return reply([{ queueType: 'RANKED_SOLO_5x5', tier: 'EMERALD', rank: 'II', leaguePoints: 68, wins: 78, losses: 62 }]);
    if (url.includes('/ids?')) return reply(['EUW1_1234']);
    return reply(fixture);
  };
}
const service = (calls = [], options = {}) => createRiotService({ apiKey: 'test-server-secret', fetcher: fakeRiot(calls), interval: 0, ...options });

test('Riot profile uses current PUUID endpoints and only sends the key to Riot over HTTPS', async () => {
  const calls = [], api = service(calls);
  const profile = await api.getProfile(input);
  assert.equal(calls.length, 5);
  assert.equal(calls[0].url, 'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Test%20Player/EUW');
  assert.ok(calls.some(call => call.url === 'https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/own-puuid'));
  assert.ok(calls.some(call => call.url === 'https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/own-puuid'));
  assert.ok(calls.every(call => call.url.startsWith('https://') && call.options.headers['X-Riot-Token'] === 'test-server-secret' && call.options.redirect === 'error'));
  assert.equal(profile.summoner.name, 'Test Player'); assert.equal(profile.ranked.division, 'II');
  assert.equal(profile.matches[0].cs, 197); assert.equal(profile.matches[0].kills, 5); assert.equal(profile.matches[0].vision, 0);
  assert.deepEqual(profile.matches[0].items, [1056, 3118]);
  assert.ok(!JSON.stringify(profile).includes('puuid')); assert.ok(!JSON.stringify(profile).includes('test-server-secret'));
});
test('routing covers America, Asia, Europe and SEA with the separate account cluster', async () => {
  for (const [platform, account, region] of [['na1','americas','americas'], ['kr','asia','asia'], ['me1','europe','europe'], ['oc1','asia','sea'], ['sg2','asia','sea']]) {
    const calls = []; await service(calls).getProfile({ ...input, platform });
    assert.ok(calls[0].url.startsWith(`https://${account}.`));
    assert.ok(calls.find(call => call.url.includes('/ids?')).url.startsWith(`https://${region}.`));
  }
});
test('match normalization never substitutes another player or exposes custom matches', () => {
  assert.equal(normalizeMatch(fixture, 'missing'), null);
  assert.equal(normalizeMatch({ ...fixture, info: { ...fixture.info, gameType: 'CUSTOM_GAME' } }, 'own-puuid'), null);
  assert.equal(normalizeMatch({ ...fixture, info: { ...fixture.info, queueId: 0 } }, 'own-puuid'), null);
  assert.equal(normalizeMatch({}, 'own-puuid'), null);
  const raw = structuredClone(fixture); delete raw.info.participants[1].visionScore;
  assert.equal(normalizeMatch(raw, 'own-puuid').vision, null);
});
test('profile cache deduplicates concurrent refreshes and reuses immutable match details', async () => {
  let time = 100000; const calls = [], api = service(calls, { now: () => time });
  const results = await Promise.all([api.getProfile(input), api.getProfile(input)]);
  assert.deepEqual(results[0], results[1]); assert.equal(calls.length, 5);
  await api.getProfile(input); assert.equal(calls.length, 5);
  time += 61000; await api.getProfile(input); assert.equal(calls.length, 9);
});
test('missing, rejected, and expired keys have actionable errors without leaking Riot responses', async () => {
  await assert.rejects(createRiotService().getProfile(input), error => error.code === 'KEY_MISSING');
  for (const status of [401, 403]) {
    await assert.rejects(service([], { fetcher: async () => reply({ message: 'private upstream detail' }, status) }).getProfile(input), error => error.code === 'KEY_REJECTED' && !error.message.includes('private'));
  }
  await assert.rejects(service([], { fetcher: async () => reply({}, 404) }).getProfile(input), error => error.code === 'NOT_FOUND');
  await assert.rejects(service([], { fetcher: async () => { throw new Error('private upstream detail'); } }).getProfile(input), error => error.code === 'RIOT_OFFLINE' && !error.message.includes('private'));
});
test('429 Retry-After blocks further upstream calls until the deadline', async () => {
  let time = 100000, calls = 0;
  const api = service([], { now: () => time, fetcher: async () => { calls++; return reply({}, 429, { 'Retry-After': '75' }); } });
  await assert.rejects(api.getProfile(input), error => error.retryAfter === 75);
  time += 20000; await assert.rejects(api.getProfile(input), error => error.retryAfter === 55);
  assert.equal(calls, 1);
  time += 55001; await assert.rejects(api.getProfile(input)); assert.equal(calls, 2);
});
test('rankless accounts and missing match data remain distinct from request failures', async () => {
  const api = service([], { fetcher: fakeRiot([], url => url.includes('/league/') ? reply([]) : url.endsWith('/EUW1_1234') ? reply({}, 503) : null) });
  const profile = await api.getProfile(input); assert.equal(profile.ranked, null); assert.equal(profile.matches.length, 0); assert.ok(profile.notice); assert.equal(profile.retryAfter, 60);
});
test('backend URL and account validation rejects insecure hosts, embedded keys, and invalid regions', () => {
  assert.deepEqual(validateAccount(DEFAULT_ACCOUNT, true), DEFAULT_ACCOUNT);
  assert.equal(validateAccount({ ...DEFAULT_ACCOUNT, riotId: ' Name # TAG ', serverUrl: 'https://stats.example.com/api/' }).riotId, 'Name#TAG');
  for (const serverUrl of ['http://example.com', 'file:///secret', 'https://key:secret@example.com', 'https://example.com?api_key=secret', 'https://example.com#secret']) assert.throws(() => validateAccount({ ...DEFAULT_ACCOUNT, ...input, serverUrl }));
  for (const riotId of ['', 'missing-tag', 'Name#tag#extra', 'Name\n#tag']) assert.throws(() => validateAccount({ ...DEFAULT_ACCOUNT, ...input, riotId }));
  assert.throws(() => validateAccount({ ...DEFAULT_ACCOUNT, ...input, platform: '__proto__' }));
});
test('HTTP backend and desktop adapter round-trip only normalized public data', async t => {
  const server = createServer({ service: service() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const serverUrl = `http://127.0.0.1:${server.address().port}`;
  const profile = await fetchProfile({ ...input, serverUrl }); assert.equal(profile.matches[0].kills, 5);
  const health = await (await fetch(`${serverUrl}/health`)).json(); assert.deepEqual(health, { service: 'DPM.lol Riot API', configured: true });
  assert.equal((await fetch(`${serverUrl}/v1/profile`, { headers: { Origin: 'https://foreign.example' } })).status, 403);
  const hostStatus = await new Promise((resolve, reject) => { require('node:http').get(`${serverUrl}/health`, { headers: { Host: 'foreign.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject); });
  assert.equal(hostStatus, 403);
  assert.equal((await fetch(`${serverUrl}/v1/profile`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${serverUrl}/not-a-proxy`)).status, 404);
  assert.equal((await fetch(`${serverUrl}/v1/profile?riotId=invalid&platform=euw1`)).status, 400);
});
test('desktop shows backend startup failures and preserves rate-limit retry instructions', async t => {
  const server = createServer({ service: service([], { fetcher: async () => reply({}, 429, { 'Retry-After': '70' }) }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const serverUrl = `http://127.0.0.1:${server.address().port}`;
  await assert.rejects(fetchProfile({ ...input, serverUrl }), error => error.retryAfter === 70);
  await new Promise(resolve => server.close(resolve));
  await assert.rejects(fetchProfile({ ...input, serverUrl }), /Start it or check the URL/);
});
test('changing accounts ignores an older cloud response without affecting live polling', async () => {
  const deferred = [], changes = [];
  const controller = createProfileController({ fetcher: () => new Promise(resolve => deferred.push(resolve)), onChange: value => changes.push(value) });
  const config = { ...DEFAULT_ACCOUNT, ...input };
  controller.configure(config); const first = controller.refresh();
  controller.configure({ ...config, riotId: 'New#TAG' }); const second = controller.refresh();
  await Promise.resolve();
  deferred[1]({ summoner: { name: 'New' }, matches: [], fetchedAt: new Date().toISOString() }); await second;
  deferred[0]({ summoner: { name: 'Old' }, matches: [], fetchedAt: new Date().toISOString() }); await first;
  assert.equal(changes.at(-1).summoner.name, 'New');
  assert.ok(changes.every(change => !Object.hasOwn(change, 'live')));
  controller.configure({ ...config, riotId: '' }); assert.equal(changes.at(-1).summoner, null); assert.equal(changes.at(-1).profile.status, 'unconfigured');
});
test('cloud refresh preserves cached stats on failure and honors backoff even on manual refresh', async () => {
  let time = 100000, calls = 0; const changes = [];
  const controller = createProfileController({ now: () => time, onChange: change => changes.push(change), fetcher: async () => { calls++; if (calls > 1) { const error = new Error('Rate limited'); error.retryAfter = 80; throw error; } return { summoner: { name: 'Saved' }, matches: [], fetchedAt: new Date(time).toISOString() }; } });
  controller.configure({ ...DEFAULT_ACCOUNT, ...input }); await controller.refresh();
  await controller.refresh(); assert.equal(calls, 1);
  time += 300001; await controller.refresh(); assert.equal(calls, 2); assert.equal(changes.at(-1).profile.status, 'error'); assert.ok(changes.at(-1).profile.lastUpdated);
  await controller.refresh(true); assert.equal(calls, 2);
  time += 80001; await controller.refresh(); assert.equal(calls, 3);
});
test('synchronous transport failures do not leave cloud refresh permanently busy', async () => {
  let time = 100000, calls = 0;
  const controller = createProfileController({ now: () => time, onChange: () => {}, fetcher: () => { calls++; throw new Error('Unavailable'); } });
  controller.configure({ ...DEFAULT_ACCOUNT, ...input }); await controller.refresh();
  time += 31000; await controller.refresh(); assert.equal(calls, 2);
});
test('desktop rejects malformed profiles and drops any unexpected backend fields', async () => {
  const profile = await service().getProfile(input);
  const clean = decodeProfile({ ...profile, apiKey: 'must-not-reach-renderer', summoner: { ...profile.summoner, secret: 'must-not-reach-renderer' } });
  assert.ok(!JSON.stringify(clean).includes('must-not-reach-renderer'));
  assert.throws(() => decodeProfile({ ...profile, ranked: { ...profile.ranked, tier: [] } }), /invalid profile/);
  assert.throws(() => decodeProfile({ ...profile, matches: [{ ...profile.matches[0], duration: 'bad' }] }), /invalid profile/);
  assert.throws(() => decodeProfile({ ...profile, matches: [null] }), /invalid profile/);
});
