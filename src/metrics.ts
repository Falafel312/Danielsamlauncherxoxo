import type { Catalog, Live } from './types.ts';

export function goldForItem(live: Live | null, target: number, items: Catalog['items']) {
  const item = items[String(target)];
  if (!live || !item || !target) return null;
  const inventory = new Map<number, number>();
  for (const owned of live.items) inventory.set(owned.id, (inventory.get(owned.id) || 0) + (owned.count || 1));
  if (inventory.has(target)) return { needed: 0, remaining: 0, owned: true };
  // Consume each owned component once, traversing the recipe from expensive components down.
  function credit(id: number, ancestry: number[] = []): number {
    if (ancestry.includes(id)) return 0;
    const part = items[String(id)];
    if (!part) return 0;
    if ((inventory.get(id) || 0) > 0) { inventory.set(id, inventory.get(id)! - 1); return part.gold.total; }
    return (part.from || []).reduce((sum, child) => sum + credit(Number(child), [...ancestry, id]), 0);
  }
  const remaining = Math.max(0, item.gold.total - credit(target));
  return { needed: Math.max(0, Math.ceil(remaining - live.gold)), remaining, owned: false };
}

// Standard Rift estimate, with cannons averaged across waves. The live API does
// not expose the minions left in lane, last-hit success, or role gold modifiers.
// Base rewards/composition: Riot's 26.1 minion changes and game character data.
// https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/
export function averageWaveGold(seconds: number) {
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const upgrades = Math.floor(time / 90);
  const cannonRate = time < 14 * 60 ? 1 / 3 : time < 25 * 60 ? 1 / 2 : 1;
  const meleeCount = 3 - (time >= 14 * 60 ? cannonRate : 0);
  const casterCount = time >= 30 * 60 ? 2 : 3;
  const cannonGold = 50 + upgrades; // Cannon rewards grow by 1 gold every 90 seconds.
  return meleeCount * (20 + upgrades * .125) + casterCount * 14 + cannonRate * cannonGold;
}

export function wavesForItem(live: Live | null, target: number, items: Catalog['items']) {
  const cost = goldForItem(live, target, items);
  if (!live || !cost || !Number.isFinite(live.time) || !Number.isFinite(live.gold)) return null;
  // Non-Rift modes use different minion rewards. Never present those as SR waves.
  if (live.gameMode !== 'CLASSIC' || (live.mapNumber != null && live.mapNumber !== 11)) return null;
  const goldPerWave = averageWaveGold(live.time);
  return { count: Math.ceil(cost.needed / goldPerWave), owned: cost.owned, goldPerWave };
}

export function chartPoints(values: number[], width = 600, height = 120, maximum?: number) {
  const max = Math.max(1, maximum || 0, ...values);
  return values.map((value, i) => `${values.length < 2 ? width / 2 : i / (values.length - 1) * width},${height - Math.max(0, value) / max * (height - 8)}`).join(' ');
}
