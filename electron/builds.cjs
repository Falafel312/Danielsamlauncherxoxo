const fs = require('node:fs/promises');
const path = require('node:path');
const { validateRunePage } = require('./league.cjs');
const ROLES = new Set(['auto', 'top', 'jungle', 'mid', 'adc', 'support']);
const TTL = 6 * 60 * 60 * 1000;

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

// Read OP.GG's server-rendered data as JSON. Never execute third-party scripts.
function parseBuild(html, champion, role, catalog, now = Date.now()) {
  let flight = '';
  for (const match of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)) {
    try { const chunk = JSON.parse(match[1]); if (chunk[0] === 1 && typeof chunk[1] === 'string') flight += chunk[1]; } catch {}
  }
  const rows = new Map(); let runeData;
  for (const line of flight.split('\n')) {
    let value;
    try { value = JSON.parse(line.slice(line.indexOf(':') + 1)); } catch { continue; }
    walk(value, node => {
      if (node.data?.rune_pages?.[0]?.importClientData) runeData = node.data.rune_pages;
      if (Array.isArray(node) && node[0] === '$' && /^(starter_items|core_items|boots)_\d+$/.test(node[2])) rows.set(node[2], node);
    });
  }
  function items(key) {
    const ids = [];
    walk(rows.get(key), node => { if (node.metaType === 'item' && Number.isInteger(node.metaId)) ids.push(node.metaId); });
    return ids.filter(id => catalog.items[String(id)]);
  }
  const core = items('core_items_0');
  const start = items('starter_items_0');
  const boots = items('boots_0');
  const sourceRunes = runeData?.[0]?.importClientData;
  if (!core.length || !start.length || !sourceRunes) throw new Error('OP.GG has no readable build for this selection. Try another role.');
  const runes = { champion, primaryStyleId: sourceRunes.primaryStyleId, subStyleId: sourceRunes.subStyleId, selectedPerkIds: sourceRunes.selectedPerkIds };
  validateRunePage(runes, catalog.runes);
  const alternatives = [...new Set([...rows.keys()].filter(key => key.startsWith('core_items_') && key !== 'core_items_0').flatMap(items))].filter(id => !core.includes(id)).slice(0, 6);
  return {
    champion, role, source: 'OP.GG', sourceUrl: buildUrl(champion, role),
    patch: html.match(/Build Patch ([\d.]+)/)?.[1] || html.match(/in patch ([\d.]+)/)?.[1] || null,
    fetchedAt: new Date(now).toISOString(), stale: false, start, core, boots, alternatives, runes,
  };
}

function buildUrl(champion, role = 'auto') {
  const slug = champion === 'MonkeyKing' ? 'wukong' : champion.toLowerCase();
  return `https://op.gg/lol/champions/${slug}/build${role === 'auto' ? '' : `/${role}`}?region=global&tier=emerald_plus`;
}

function createBuildService({ catalog, cacheDirectory, fetcher = fetch, now = Date.now }) {
  const cache = new Map(); const pending = new Map();
  return async function getBuild(champion, role = 'auto', refresh = false) {
    if (!catalog.champions.some(c => c.id === champion) || !ROLES.has(role)) throw new Error('Choose a valid champion and role.');
    const key = `${champion}-${role}`;
    if (pending.has(key)) return pending.get(key);
    const operation = (async () => {
      let saved = cache.get(key);
      const file = cacheDirectory && path.join(cacheDirectory, `${key}.json`);
      if (!saved && file) {
        try { saved = JSON.parse(await fs.readFile(file, 'utf8')); if (saved.champion !== champion || saved.source !== 'OP.GG' || !Array.isArray(saved.core)) saved = null; } catch {}
      }
      const age = saved ? now() - Date.parse(saved.fetchedAt) : Infinity;
      if (saved && age < TTL && !refresh) return { ...saved, stale: false };
      try {
        const response = await fetcher(buildUrl(champion, role), { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Accept: 'text/html' } });
        if (!response.ok) throw new Error(`OP.GG returned ${response.status}.`);
        if (Number(response.headers.get('content-length')) > 5_000_000) throw new Error('Build response too large.');
        const reader = response.body.getReader(); const chunks = []; let size = 0;
        while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 5_000_000) { await reader.cancel(); throw new Error('Build response too large.'); } chunks.push(Buffer.from(value)); }
        const result = parseBuild(Buffer.concat(chunks).toString('utf8'), champion, role, catalog, now());
        cache.set(key, result);
        if (file) { await fs.mkdir(cacheDirectory, { recursive: true }); await fs.writeFile(file, JSON.stringify(result)).catch(() => {}); }
        return result;
      } catch (error) {
        if (saved && age < 7 * 24 * 60 * 60 * 1000) return { ...saved, stale: true };
        throw new Error(`Build unavailable. ${error.message}`);
      }
    })();
    pending.set(key, operation);
    try { return await operation; } finally { pending.delete(key); }
  };
}
module.exports = { parseBuild, buildUrl, createBuildService };
