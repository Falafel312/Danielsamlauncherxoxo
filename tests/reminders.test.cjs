const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReminderEngine, nextDragon } = require('../electron/reminders.cjs');
const { sanitizeSettings, normalizeLive } = require('../electron/league.cjs');
const { REMINDERS, SCOREBOARD } = require('../shared/overlay-settings.cjs');
const { inventoryValue, enemyComparisons } = require('../src/metrics.ts');
const game = { name: 'Self#T', championId: 'Ahri', time: 270, health: 900, maxHealth: 1000, mana: 500, maxMana: 1000, resourceType: 'MANA', gameMode: 'CLASSIC', mapNumber: 11, eventsAvailable: true, dragonKills: [] };
const kill = (time, team = 'ORDER', type = 'earth') => ({ time, team, type });
test('drake timing covers first spawn, respawn, soul, and Elder', () => {
  assert.deepEqual(nextDragon(game), { at: 300, name: 'Drake' });
  assert.deepEqual(nextDragon({ ...game, time: 600, dragonKills: [kill(400)] }), { at: 700, name: 'Drake' });
  const soul = { ...game, time: 1800, dragonKills: [kill(400), kill(750), kill(1100), kill(1500)] };
  assert.deepEqual(nextDragon(soul), { at: 1860, name: 'Elder dragon' });
  assert.deepEqual(nextDragon({ ...soul, time: 2300, dragonKills: [...soul.dragonKills, kill(1900, 'CHAOS', 'elder')] }), { at: 2260, name: 'Elder dragon' });
  assert.equal(nextDragon({ ...soul, dragonKills: [kill(400), kill(750), kill(1100), kill(1500, '')] }), null);
  assert.equal(nextDragon({ ...game, eventsAvailable: false }), null);
  assert.equal(nextDragon({ ...game, mapNumber: 12 }), null);
  assert.equal(nextDragon({ ...game, gameMode: 'ARAM' }), null);
});
test('Swiftplay uses two elemental drakes and fixed first Elder at 15:00', () => {
  assert.deepEqual(nextDragon(game, 'swiftplay'), { at: 300, name: 'Drake' });
  assert.deepEqual(nextDragon({ ...game, time: 800, dragonKills: [kill(350), kill(700)] }, 'swiftplay'), { at: 900, name: 'Elder dragon' });
  assert.deepEqual(nextDragon({ ...game, time: 901 }, 'swiftplay'), { at: 900, name: 'Elder dragon' });
  assert.deepEqual(nextDragon({ ...game, time: 1100, dragonKills: [kill(1000, 'ORDER', 'elder')] }, 'swiftplay'), { at: 1360, name: 'Elder dragon' });
});
test('dragon reminders cross the configured lead once and never invent an unobserved kill', () => {
  const engine = createReminderEngine();
  assert.equal(engine.update({ ...game, time: 269 }, REMINDERS, 1000).length, 0);
  assert.equal(engine.update(game, REMINDERS, 2000)[0].at, 300);
  assert.equal(engine.update({ ...game, time: 273 }, REMINDERS, 5000)[0].id, 'dragon-1');
  assert.equal(engine.update({ ...game, time: 278 }, REMINDERS, 10000).length, 0);
  assert.equal(engine.update({ ...game, time: 600 }, REMINDERS, 400000).length, 0);
  const next = engine.update({ ...game, time: 671, dragonKills: [kill(400)] }, REMINDERS, 471000);
  assert.equal(next[0].at, 700);
  assert.equal(engine.update({ ...game, time: 700, dragonKills: [kill(400)] }, REMINDERS, 472000).length, 0);
});
test('health and mana alerts respect thresholds, lifetime, hysteresis, and cooldown', () => {
  const engine = createReminderEngine(), settings = { ...REMINDERS, dragonEnabled: false };
  const low = { ...game, health: 250, mana: 200 };
  assert.deepEqual(engine.update(low, settings, 1000).map(x => x.kind), ['health', 'mana']);
  assert.equal(engine.update(low, settings, 7000).length, 0);
  assert.equal(engine.update(low, settings, 61000).length, 0, 'Do not spam while remaining low');
  engine.update(game, settings, 62000);
  assert.equal(engine.update(low, settings, 64000).length, 2);
  engine.update(game, settings, 65000);
  assert.equal(engine.update(low, settings, 67000).length, 0, 'Recovery does not bypass cooldown');
  assert.equal(engine.update(low, settings, 110000).length, 2);
});
test('repeat is opt-in and absent mana, energy, death, and disabled rules cannot alert', () => {
  const settings = { ...REMINDERS, dragonEnabled: false, repeatLow: true };
  const low = { ...game, health: 200, mana: 0 };
  const engine = createReminderEngine();
  assert.equal(engine.update(low, settings, 1000).length, 2);
  assert.equal(engine.update(low, settings, 7000).length, 0);
  assert.equal(engine.update(low, settings, 47000).length, 2);
  for (const patch of [{ isDead: true }, { health: 0 }]) {
    assert.equal(createReminderEngine().update({ ...low, ...patch }, settings, 1000).length, 0);
  }
  for (const patch of [{ resourceType: 'ENERGY' }, { mana: null }, { mana: NaN }, { maxMana: 0 }]) {
    assert.equal(createReminderEngine().update({ ...game, mana: 0, ...patch }, settings, 1000).length, 0);
  }
  assert.equal(engine.update(low, { ...settings, enabled: false }, 48000).length, 0);
  assert.equal(createReminderEngine().update(low, { ...settings, healthEnabled: false, manaEnabled: false }, 1000).length, 0);
});
test('new games, reconnects, and backwards game time clear reminder history', () => {
  const engine = createReminderEngine();
  assert.equal(engine.update(game, REMINDERS, 1000).length, 1);
  engine.update({ ...game, time: 300 }, REMINDERS, 40000);
  assert.equal(engine.update(game, REMINDERS, 80000).length, 1);
  assert.equal(engine.update(null, REMINDERS, 81000).length, 0);
  assert.equal(engine.update(game, REMINDERS, 82000).length, 1);
});
test('preferences retain nested defaults, clamp inputs and migrate the combined CS widget', () => {
  const previous = { widgets: { cs: false, vision: true, waves: true, goal: true }, reminders: REMINDERS, scoreboard: SCOREBOARD };
  const result = sanitizeSettings({ widgets: { cs: false, goal: true }, reminders: { healthThreshold: 0, x: Infinity, duration: 500, repeatLow: true, dragonMode: 'fake', unknown: 1 }, scoreboard: { scale: .1, rowHeight: 500, enabled: false } }, previous);
  assert.deepEqual(result.widgets, { cs: true, vision: true, waves: true });
  assert.equal(result.reminders.healthThreshold, 5); assert.equal(result.reminders.duration, 15);
  assert.equal(result.reminders.x, 50); assert.equal(result.reminders.dragonMode, 'standard');
  assert.equal(result.reminders.repeatLow, true); assert.equal(result.reminders.unknown, undefined);
  assert.equal(result.scoreboard.scale, .6); assert.equal(result.scoreboard.rowHeight, 80);
  assert.equal(result.scoreboard.enabled, false);
  assert.equal(sanitizeSettings({}, previous).widgets.goal, undefined);
});
test('live normalization includes only opponents and own health/mana, with unambiguous dragon teams', () => {
  const raw = { activePlayer: { riotId: 'Self#T', championStats: { currentHealth: 200, maxHealth: 1000, resourceValue: 30, resourceMax: 500, resourceType: 'MANA' } }, gameData: { gameTime: 700, mapNumber: 11, gameMode: 'CLASSIC' }, allPlayers: [
    { riotId: 'Self#T', team: 'ORDER', scores: { creepScore: 10 }, items: [] },
    { riotId: 'Same#A', riotIdGameName: 'Same', team: 'ORDER' },
    { riotId: 'Same#B', riotIdGameName: 'Same', team: 'CHAOS', rawChampionName: 'game_character_displayname_Jinx', scores: { creepScore: 90 }, items: [{ itemID: 1001, count: 1 }] },
    { riotId: 'Unknown#T' },
  ], events: { Events: [{ EventID: 1, EventName: 'DragonKill', EventTime: 400, KillerName: 'Same#B', DragonType: 'Earth' }, { EventID: 2, EventName: 'DragonKill', EventTime: 650, KillerName: 'Same', DragonType: 'Fire' }] } };
  raw.events.Events.push(raw.events.Events[0]);
  const result = normalizeLive(raw);
  assert.equal(result.enemies.length, 1); assert.equal(result.enemies[0].championId, 'Jinx');
  assert.equal(result.health, 200); assert.equal(result.mana, 30); assert.equal(result.maxMana, 500);
  assert.deepEqual(result.dragonKills.map(x => x.team), ['CHAOS', '']);
  assert.equal(normalizeLive({ ...raw, events: { Events: {} } }).eventsAvailable, false);
  assert.equal(normalizeLive({ ...raw, allPlayers: [{ riotId: 'Self#T' }, raw.allPlayers[2]] }).enemies.length, 0);
});
test('inventory comparison counts stacks once, distinguishes unknown values, and keeps CS separate', () => {
  const items = { 1: { gold: { total: 300 } }, 2: { gold: { total: 1000 }, from: ['1'] }, 3: { gold: { total: 0 } } };
  assert.equal(inventoryValue([{ id: 2, count: 1 }, { id: 1, count: 2 }], items), 1600);
  assert.equal(inventoryValue([{ id: 3, count: 1 }], items), 0);
  assert.equal(inventoryValue(null, items), null);
  assert.equal(inventoryValue([{ id: 99, count: 1 }], items), null);
  const result = enemyComparisons({ cs: 100, items: [{ id: 1, count: 1 }], enemies: [
    { role: 'MIDDLE', items: [{ id: 2, count: 1 }], cs: 125 }, { role: 'TOP', items: [{ id: 99, count: 1 }], cs: null },
  ] }, items);
  assert.equal(result[0].role, 'TOP'); assert.equal(result[0].itemDelta, null);
  assert.equal(result[1].itemDelta, 700); assert.equal(result[1].csDelta, 25);
});
