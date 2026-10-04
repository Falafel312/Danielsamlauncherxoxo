const { test } = require('node:test');
const assert = require('node:assert/strict');
const { goldForItem, chartPoints } = require('../src/metrics.ts');
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
  const defaults = { csDisplay: 'graph', targetItemId: 3089, widgets: { cs: true, vision: true, gold: true, goal: true } };
  const migrated = sanitizeSettings({ csDisplay: 'number', targetItemId: 3031, widgets: { kda: true, build: true, cs: false } }, defaults);
  assert.deepEqual(migrated.widgets, { cs: false, vision: true, gold: true, goal: true });
  assert.equal(migrated.csDisplay, 'number'); assert.equal(migrated.targetItemId, 3031);
  assert.equal(sanitizeSettings({ csDisplay: 'fake', targetItemId: -1 }, defaults).targetItemId, 3089);
  assert.equal(sanitizeSettings({ csDisplay: 'fake' }, defaults).csDisplay, 'graph');
});
test('renamed app reuses its existing Rift rune page without taking an extra slot', async () => {
  const calls = [];
  const request = async (_auth, url, method = 'GET', body) => { calls.push({ url, method, body }); return method === 'GET' ? [{ id: 5, name: 'Rift • Ahri', isEditable: true }, { id: 7, name: 'Personal page', isEditable: true }] : null; };
  await upsertRunePage({}, { champion: 'Ahri', primaryStyleId: 8100, subStyleId: 8200, selectedPerkIds: [8112,8139,8137,8106,8226,8210,5005,5008,5001] }, require('../public/data/runes.json'), request);
  assert.equal(calls[1].url, '/lol-perks/v1/pages/5');
  assert.equal(calls[1].method, 'PUT'); assert.equal(calls[1].body.name, 'DPM.lol • Ahri');
});
