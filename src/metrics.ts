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

export function chartPoints(values: number[], width = 600, height = 120, maximum?: number) {
  const max = Math.max(1, maximum || 0, ...values);
  return values.map((value, i) => `${values.length < 2 ? width / 2 : i / (values.length - 1) * width},${height - Math.max(0, value) / max * (height - 8)}`).join(' ');
}
