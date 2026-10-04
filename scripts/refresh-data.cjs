const fs = require('node:fs/promises');
const path = require('node:path');
const target = path.join(__dirname, '../public/data');
async function json(url) { const response = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!response.ok) throw new Error(`Data Dragon: ${response.status}`); return response.json(); }
async function main() {
  await fs.mkdir(target, { recursive: true });
  const versions = await json('https://ddragon.leagueoflegends.com/api/versions.json');
  const version = versions[0];
  const base = `https://ddragon.leagueoflegends.com/cdn/${version}`;
  const [champions, items, runes] = await Promise.all([json(`${base}/data/en_US/champion.json`), json(`${base}/data/en_US/item.json`), json(`${base}/data/en_US/runesReforged.json`)]);
  await Promise.all([fs.writeFile(path.join(target, 'champions.json'), JSON.stringify(champions)), fs.writeFile(path.join(target, 'items.json'), JSON.stringify(items)), fs.writeFile(path.join(target, 'runes.json'), JSON.stringify(runes)), fs.writeFile(path.join(target, 'meta.json'), JSON.stringify({ version, downloaded: new Date().toISOString(), source: 'Riot Data Dragon' }))]);
  const details = path.join(target, 'champions');
  await fs.mkdir(details, { recursive: true });
  for (const id of ['Ahri','Jinx','LeeSin','Aatrox','Yasuo','Thresh','Lux','Caitlyn','Ezreal','Akali','Viego','Leona']) {
    await fs.writeFile(path.join(details, `${id}.json`), JSON.stringify(await json(`${base}/data/en_US/champion/${id}.json`)));
  }
  const assets = path.join(__dirname, '../public/assets');
  await fs.mkdir(assets, { recursive: true });
  const downloads = [
    ...Object.keys(champions.data).map(id => ({ url: `${base}/img/champion/${id}.png`, file: path.join(assets, 'champions', `${id}.png`) })),
    ...Object.keys(items.data).map(id => ({ url: `${base}/img/item/${id}.png`, file: path.join(assets, 'items', `${id}.png`) })),
    ...[...new Set(runes.flatMap(p => [p.icon, ...p.slots.flatMap(s => s.runes.map(r => r.icon))]))].map(icon => ({ url: `https://ddragon.leagueoflegends.com/cdn/img/${icon}`, file: path.join(assets, 'runes', icon) })),
  ];
  let next = 0;
  const failures = [];
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next < downloads.length) {
      const { url, file } = downloads[next++];
      try { const response = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, Buffer.from(await response.arrayBuffer())); }
      catch (error) { failures.push({ file: path.relative(assets,file), message: error.message }); }
    }
  }));
  if (failures.length) throw new Error(`Could not bundle ${failures.length} images: ${JSON.stringify(failures.slice(0,3))}`);
  for (const id of ['Ahri','Akali','Jinx']) {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`, { signal: AbortSignal.timeout(30000) });
    if (response.ok) await fs.writeFile(path.join(assets, `${id}-splash.jpg`), Buffer.from(await response.arrayBuffer()));
  }
  console.log(`Bundled Riot patch ${version}: ${Object.keys(champions.data).length} champions, ${Object.keys(items.data).length} items, ${runes.length} rune paths, ${downloads.length} local images.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
