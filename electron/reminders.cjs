const { REMINDERS } = require('../shared/overlay-settings.cjs');

function nextDragon(live, mode = 'standard') {
  if (!live || !Number.isFinite(live.time) || live.gameMode !== 'CLASSIC' || live.mapNumber !== 11 || !live.eventsAvailable) return null;
  const kills = (live.dragonKills || []).filter(event => event.time <= live.time).sort((a, b) => a.time - b.time);
  const last = kills.at(-1);
  if (last?.type === 'elder') return { at: last.time + 360, name: 'Elder dragon' };
  // Swiftplay has two elemental drakes and a fixed first Elder at 15:00 (26.1).
  if (mode === 'swiftplay') {
    const at = last ? last.time + 300 : 300;
    return kills.length >= 2 || at >= 900 || live.time >= 900 ? { at: 900, name: 'Elder dragon' } : { at, name: 'Drake' };
  }
  const counts = { ORDER: 0, CHAOS: 0 };
  for (const kill of kills) if (Object.hasOwn(counts, kill.team)) counts[kill.team]++;
  if (counts.ORDER >= 4 || counts.CHAOS >= 4) return last ? { at: last.time + 360, name: 'Elder dragon' } : null;
  // After a possible soul, an unresolved killer team means the next type is unknown.
  if (kills.length >= 4 && kills.some(kill => !Object.hasOwn(counts, kill.team))) return null;
  return { at: last ? last.time + 300 : 300, name: 'Drake' };
}

function createReminderEngine() {
  let identity = '', time = 0, active = [], fired = new Set(), low = {}, lastFired = {}, serial = 0;
  const reset = () => { identity = ''; time = 0; active = []; fired.clear(); low = {}; lastFired = {}; };
  function update(live, input, now = Date.now()) {
    const settings = { ...REMINDERS, ...input };
    if (!live) { reset(); return []; }
    const key = `${live.name}:${live.championId}`;
    if (key !== identity || live.time < time) reset();
    identity = key; time = live.time;
    if (!settings.enabled) { active = []; low = {}; return []; }
    active = active.filter(alert => alert.expiresAt > now);
    const add = (kind, title, detail, at) => {
      active = active.filter(alert => alert.kind !== kind);
      active.push({ id: `${kind}-${++serial}`, kind, title, detail, ...(at ? { at } : {}), expiresAt: now + settings.duration * 1000 });
    };
    for (const [kind, value, max, enabled, threshold] of [
      ['health', live.health, live.maxHealth, settings.healthEnabled, settings.healthThreshold],
      ['mana', live.mana, live.maxMana, settings.manaEnabled && live.resourceType === 'MANA', settings.manaThreshold],
    ]) {
      const valid = enabled && !live.isDead && live.health > 0 && Number.isFinite(value) && Number.isFinite(max) && max > 0;
      if (!valid || value / max * 100 > threshold + 5) { low[kind] = false; active = active.filter(alert => alert.kind !== kind); }
      if (!valid) continue;
      const percent = Math.ceil(value / max * 100);
      if (percent <= threshold && (!low[kind] || settings.repeatLow) && now - (lastFired[kind] ?? -Infinity) >= settings.cooldown * 1000) {
        add(kind, `Low ${kind}`, `${percent}% remaining`); low[kind] = true; lastFired[kind] = now;
      }
    }
    const dragon = settings.dragonEnabled ? nextDragon(live, settings.dragonMode) : null;
    const seconds = dragon ? dragon.at - live.time : Infinity;
    const spawnKey = dragon ? `${dragon.name}:${dragon.at}` : '';
    if (seconds > 0 && seconds <= settings.dragonLead && !fired.has(spawnKey)) {
      fired.add(spawnKey); add('dragon', `${dragon.name} soon`, `${Math.ceil(seconds)}s to spawn`, dragon.at);
    }
    active = active.filter(alert => alert.kind !== 'dragon' || (dragon && alert.at === dragon.at && seconds > 0));
    return active.slice(-3);
  }
  return { update, reset };
}
module.exports = { nextDragon, createReminderEngine };
