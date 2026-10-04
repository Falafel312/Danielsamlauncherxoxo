const { test } = require('node:test');
const assert = require('node:assert/strict');
const { goldForItem, nextBuildItem, wavesForItem, averageWaveGold, chartPoints } = require('../src/metrics.ts');
const { normalizeLive, sanitizeSettings, upsertRunePage } = require('../electron/league.cjs');
const items = { 1: { gold: { total: 300 } }, 2: { gold: { total: 800 }, from: ['1', '1'] }, 3: { gold: { total: 2000 }, from: ['2', '1'] } };
const live = (gold, inventory) => ({ gold, items: inventory.map(([id, count = 1]) => ({ id, count })) });
const buildItems = { ...items, 1001: { gold: { total: 300 }, tags: ['Boots'] }, 3006: { gold: { total: 1100 }, from: ['1001'], tags: ['Boots'] }, 3047: { gold: { total: 1200 }, from: ['1001'], tags: ['Boots'] }, 101: { gold: { total: 2700 }, from: ['201'] }, 102: { gold: { total: 3000 }, from: ['202'] }, 103: { gold: { total: 3200 } }, 104: { gold: { total: 2800 } }, 105: { gold: { total: 3100 } }, 106: { gold: { total: 3400 } }, 201: { gold: { total: 900 } }, 202: { gold: { total: 1200 } }, 501: { gold: { total: 2700, purchasable: false }, from: ['101'] } };
const recommended = { champion: 'Ahri', core: [101, 102, 103], boots: [3006], alternatives: [104, 105, 106] };
const inventoryGame = ids => ({ ...live(0, ids.map(id => [id])), championId: 'Ahri' });

test('automatic target progresses through core items and boots as purchases appear', () => {
  assert.equal(nextBuildItem(inventoryGame([]), recommended, buildItems).id, 101);
  assert.equal(nextBuildItem(inventoryGame([101]), recommended, buildItems).id, 3006);
  assert.equal(nextBuildItem(inventoryGame([101, 3006]), recommended, buildItems).id, 102);
  assert.equal(nextBuildItem(inventoryGame([101, 3006, 102]), recommended, buildItems).id, 103);
});

test('automatic target follows owned components and accepts a different completed boot', () => {
  assert.equal(nextBuildItem(inventoryGame([202]), recommended, buildItems).id, 102);
  assert.equal(nextBuildItem(inventoryGame([101, 3047]), recommended, buildItems).id, 102);
  assert.equal(nextBuildItem(inventoryGame([1001]), recommended, buildItems).id, 3006);
  assert.equal(nextBuildItem(inventoryGame([2422]), recommended, buildItems).id, 3006);
  assert.equal(goldForItem(inventoryGame([2422]), 3006, buildItems).needed, 800);
});

test('automatic target recognizes upgrades and maps unpurchasable transformations to their base', () => {
  assert.equal(nextBuildItem(inventoryGame([501, 3006]), recommended, buildItems).id, 102);
  assert.equal(nextBuildItem(inventoryGame([]), { ...recommended, core: [501, 102] }, buildItems).id, 101);
});

test('automatic target finishes a six-item plan and waits for the matching champion build', () => {
  assert.deepEqual(nextBuildItem(inventoryGame([101, 102, 103, 104, 105, 3006]), recommended, buildItems), { id: 0, complete: true });
  assert.equal(nextBuildItem(null, recommended, buildItems), null);
  assert.equal(nextBuildItem(inventoryGame([]), null, buildItems), null);
  assert.equal(nextBuildItem({ ...inventoryGame([]), championId: 'Jinx' }, recommended, buildItems), null);
  assert.equal(nextBuildItem(inventoryGame([]), { ...recommended, core: [], boots: [], alternatives: [] }, buildItems), null);
});

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
  raw.allPlayers[1].position = 'MIDDLE';
  assert.equal(normalizeLive(raw).vision, 12.8);
  assert.equal(normalizeLive(raw).role, 'mid');
  delete raw.allPlayers[1].scores.wardScore;
  assert.equal(normalizeLive(raw).vision, null);
});
test('new overlay settings survive migration and reject invalid values', () => {
  const defaults = { csDisplay: 'graph', widgets: { cs: true, vision: true, waves: true, goal: true } };
  const migrated = sanitizeSettings({ csDisplay: 'number', targetItemId: 3031, widgets: { kda: true, build: true, cs: false } }, defaults);
  assert.deepEqual(migrated.widgets, { cs: false, vision: true, waves: true, goal: true });
  assert.equal(migrated.csDisplay, 'number'); assert.equal(migrated.targetItemId, undefined);
  assert.equal(sanitizeSettings({ csDisplay: 'fake', targetItemId: -1 }, defaults).targetItemId, undefined);
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
