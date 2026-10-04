const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseBuild, createBuildService, buildUrl } = require('../electron/builds.cjs');
const catalog = { champions: Object.values(require('../public/data/champions.json').data), items: require('../public/data/items.json').data, runes: require('../public/data/runes.json') };
// OP.GG's observed RSC structure, reduced to the fields used by the parser.
const rune = { primaryStyleId: 8100, subStyleId: 8200, selectedPerkIds: [8112,8139,8140,8106,8210,8226,5005,5008,5001] };
const row = (name, ids) => ['$', 'tr', name, { children: ids.map(id => ['$', '$L58', null, { metaType: 'item', metaId: id }]) }];
const data = { children: [row('starter_items_0', [1056,2003]), row('core_items_0', [3118,4645,3157]), row('core_items_1', [3118,4645,3089]), row('boots_0', [3020]), { data: { rune_pages: [{ importClientData: rune }] } }] };
const html = `<title>Ahri Build Patch 16.19</title><script>self.__next_f.push(${JSON.stringify([1, `4e:${JSON.stringify(data)}\n`])})</script>`;

test('OP.GG parser extracts real item groups and validated rune IDs from inert JSON', () => {
  const result = parseBuild(html, 'Ahri', 'mid', catalog, 1000);
  assert.deepEqual(result.core, [3118,4645,3157]); assert.deepEqual(result.start, [1056,2003]);
  assert.deepEqual(result.boots, [3020]); assert.deepEqual(result.alternatives, [3089]);
  assert.deepEqual(result.runes.selectedPerkIds, rune.selectedPerkIds);
  assert.equal(result.patch, '16.19'); assert.equal(result.source, 'OP.GG');
  assert.equal(result.fetchedAt, new Date(1000).toISOString());
});
test('provider layout changes fail clearly instead of returning invented recommendations', () => {
  assert.throws(() => parseBuild('<html>unavailable</html>', 'Ahri', 'mid', catalog), /no readable build/);
  assert.throws(() => parseBuild(html.replace('8112', '9999'), 'Ahri', 'mid', catalog), /primary runes/);
});
test('provider validates champions and roles before any network request', async () => {
  let requests = 0; const get = createBuildService({ catalog, fetcher: async () => { requests++; return new Response(html); } });
  await assert.rejects(() => get('../unknown', 'mid'), /valid champion/);
  await assert.rejects(() => get('Ahri', '../../'), /valid champion/);
  assert.equal(requests, 0);
  assert.match(buildUrl('MonkeyKing'), /\/wukong\/build\?/);
});
test('provider deduplicates concurrent loads and uses the six-hour cache', async () => {
  let requests = 0; const get = createBuildService({ catalog, fetcher: async () => { requests++; return new Response(html); } });
  const results = await Promise.all([get('Ahri'), get('Ahri')]);
  assert.deepEqual(results[0], results[1]); assert.equal(requests, 1);
  await get('Ahri'); assert.equal(requests, 1);
  await get('Ahri', 'auto', true); assert.equal(requests, 2);
});
test('offline fallback is labeled stale and expires after seven days', async () => {
  let timestamp = 1000000; let offline = false;
  const get = createBuildService({ catalog, now: () => timestamp, fetcher: async () => { if (offline) throw new Error('Offline'); return new Response(html); } });
  await get('Ahri'); offline = true; timestamp += 7 * 60 * 60 * 1000;
  assert.equal((await get('Ahri')).stale, true);
  timestamp += 8 * 24 * 60 * 60 * 1000;
  await assert.rejects(() => get('Ahri'), /Build unavailable/);
});
test('saved build cache survives app restarts', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dpm-build-test-'));
  const first = createBuildService({ catalog, cacheDirectory: directory, fetcher: async () => new Response(html) });
  const build = await first('Ahri');
  const second = createBuildService({ catalog, cacheDirectory: directory, fetcher: async () => { throw new Error('Should use disk'); } });
  assert.deepEqual(await second('Ahri'), build);
});
