const { test } = require('node:test');
const assert = require('node:assert/strict');
const { goldForItem, wavesForItem, averageWaveGold, chartPoints } = require('../src/metrics.ts');
const { normalizeLive, sanitizeSettings, upsertRunePage } = require('../electron/league.cjs');
const items = { 1: { gold: { total: 300 } }, 2: { gold: { total: 800 }, from: ['1', '1'] }, 3: { gold: { total: 2000 }, from: ['2', '1'] } };
const live = (gold, inventory) => ({ gold, items: inventory.map(([id, count = 1]) => ({ id, count })) });

test('gold tracker subtracts only recipe components and available gold', () => {
  assert.deepEqual(goldForItem(live(500, [[1], [99]]), 3, items), { needed: 1200, remaining: 1700, owned: false });
  assert.equal(goldForItem(live(250, [[2], [1]]), 3, items).needed, 650);
  assert.equal(goldForItem(live(0, [[1]]), 3, items).needed, 1700);
  assert.equal(goldForItem(live(0, [[1, 2]]), 3, items).needed, 1400);
});
test('gold tracker handles affordable, already owned, and missing targets', () => {
  assert.equal(goldForItem(live(2500, []), 3, items).needed, 0);
  assert.deepEqual(goldForItem(live(0, [[3]]), 3, items), { needed: 0, remaining: 0, owned: true });
  assert.equal(goldForItem(null, 3, items), null);
  assert.equal(goldForItem(live(0, []), 0, items), null);
  assert.equal(goldForItem(live(0, []), 999, items), null);
});
test('gold tracker never double counts shared recipe parts or loops over malformed recipes', () => {
  assert.equal(goldForItem(live(0, [[1, 4]]), 3, items).needed, 1100);
  assert.equal(goldForItem(live(0, []), 4, { 4: { gold: { total: 500 }, from: ['4'] } }).needed, 500);
});

test('waves account for inventory and current gold and round up full waves', () => {
  const game = { ...live(500, [[1], [99]]), time: 600, gameMode: 'CLASSIC', mapNumber: 11 };
  assert.equal(wavesForItem(game, 3, items).count, 10);
  assert.equal(wavesForItem({ ...game, gold: 1699 }, 3, items).count, 1);
  assert.equal(wavesForItem({ ...game, gold: 1700 }, 3, items).count, 0);
  assert.equal(wavesForItem({ ...game, gold: 1900 }, 3, items).count, 0);
  assert.equal(wavesForItem({ ...game, items: [{ id: 3, count: 1 }], gold: 0 }, 3, items).owned, true);
});

test('average waves change with cannons and reduced mid/late wave composition', () => {
  assert.ok(Math.abs(averageWaveGold(0) - 118.6666667) < .001);
  assert.equal(averageWaveGold(14 * 60), 124.3125);
  assert.equal(averageWaveGold(25 * 60), 152);
  assert.equal(averageWaveGold(30 * 60), 143);
  assert.ok(averageWaveGold(10 * 60) > averageWaveGold(0));
  assert.equal(averageWaveGold(-1), averageWaveGold(0));
  // One mid-game upgrade: half a cannon (+1g) and 2.5 melee (+0.125g).
  assert.equal(averageWaveGold(990) - averageWaveGold(900), .8125);
});

test('fresh kill or assist gold reduces waves without requiring any additional CS', () => {
  const game = { ...live(0, []), time: 900, gameMode: 'CLASSIC', cs: 100 };
  const before = wavesForItem(game, 3, items).count;
  const afterKill = wavesForItem({ ...game, gold: 300 }, 3, items).count;
  const afterAssist = wavesForItem({ ...game, gold: 450 }, 3, items).count;
  assert.ok(afterKill < before);
  assert.ok(afterAssist < afterKill);
  assert.ok(wavesForItem({ ...game, gold: 450, time: 1800 }, 3, items).count < afterAssist);
});

test('waves with missing data, invalid telemetry, or non-Rift modes stay unavailable', () => {
  const game = { ...live(0, []), time: 600, gameMode: 'CLASSIC', mapNumber: 11 };
  assert.equal(wavesForItem(null, 3, items), null);
  assert.equal(wavesForItem(game, 0, items), null);
  assert.equal(wavesForItem({ ...game, gameMode: 'ARAM' }, 3, items), null);
  assert.equal(wavesForItem({ ...game, mapNumber: 12 }, 3, items), null);
  assert.equal(wavesForItem({ ...game, time: NaN }, 3, items), null);
  assert.equal(wavesForItem({ ...game, gold: Infinity }, 3, items), null);
});
test('CS chart handles empty and one-sample games without invalid points', () => {
  assert.equal(chartPoints([]), '');
  assert.equal(chartPoints([0]), '300,120');
  assert.ok(!chartPoints([0, 0]).includes('NaN'));
});
test('vision reads own ward score; unavailable is different from zero', () => {
  const raw = { gameData: { gameTime: 600 }, activePlayer: { riotId: 'Self#TEST' }, allPlayers: [{ riotId: 'Other#TEST', scores: { wardScore: 99 } }, { riotId: 'Self#TEST', scores: { wardScore: 0 } }] };
  assert.equal(normalizeLive(raw).vision, 0);
  raw.allPlayers[1].scores.wardScore = 12.8;
  assert.equal(normalizeLive(raw).vision, 12.8);
  delete raw.allPlayers[1].scores.wardScore;
  assert.equal(normalizeLive(raw).vision, null);
});
test('new overlay settings survive migration and reject invalid values', () => {
  const defaults = { csDisplay: 'graph', targetItemId: 3089, widgets: { cs: true, vision: true, waves: true, goal: true } };
  const migrated = sanitizeSettings({ csDisplay: 'number', targetItemId: 3031, widgets: { kda: true, build: true, cs: false } }, defaults);
  assert.deepEqual(migrated.widgets, { cs: false, vision: true, waves: true, goal: true });
  assert.equal(migrated.csDisplay, 'number'); assert.equal(migrated.targetItemId, 3031);
  assert.equal(sanitizeSettings({ csDisplay: 'fake', targetItemId: -1 }, defaults).targetItemId, 3089);
  assert.equal(sanitizeSettings({ csDisplay: 'fake' }, defaults).csDisplay, 'graph');
  assert.equal(sanitizeSettings({ widgets: { gold: false } }, defaults).widgets.waves, false);
  assert.equal(sanitizeSettings({ widgets: { waves: true, gold: false } }, defaults).widgets.waves, true);
  assert.equal(sanitizeSettings({ widgets: { gold: false } }, defaults).widgets.gold, undefined);
});
test('renamed app reuses its existing Rift rune page without taking an extra slot', async () => {
  const calls = [];
  const request = async (_auth, url, method = 'GET', body) => { calls.push({ url, method, body }); return method === 'GET' ? [{ id: 5, name: 'Rift • Ahri', isEditable: true }, { id: 7, name: 'Personal page', isEditable: true }] : null; };
  await upsertRunePage({}, { champion: 'Ahri', primaryStyleId: 8100, subStyleId: 8200, selectedPerkIds: [8112,8139,8137,8106,8226,8210,5005,5008,5001] }, require('../public/data/runes.json'), request);
  assert.equal(calls[1].url, '/lol-perks/v1/pages/5');
  assert.equal(calls[1].method, 'PUT'); assert.equal(calls[1].body.name, 'DPM.lol • Ahri');
});
