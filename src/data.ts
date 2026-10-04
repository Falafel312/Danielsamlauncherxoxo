import type { AppState, Champion, Match, RunePage, RunePath } from './types';
export const defaultSettings: AppState['settings'] = { autoOverlay: true, clickThrough: true, opacity: 0.68, scale: 1, csTarget: 8, csDisplay: 'graph', autoDownloadUpdates: true, updateUrl: '', widgets: { cs: true, vision: true, waves: true, goal: true } };
export const initialState: AppState = { connection: 'offline', phase: 'None', summoner: null, ranked: null, matches: [], account: { serverUrl: 'http://127.0.0.1:4317', riotId: '', platform: 'euw1' }, profile: { status: 'unconfigured', message: '', lastUpdated: null }, live: null, settings: defaultSettings, overlay: { visible: false, editing: false }, shortcuts: { toggle: false, edit: false }, lastUpdated: null, updates: { version: '0.3.0', status: 'unconfigured', availableVersion: null, progress: 0, lastCheck: null, message: 'Add your release server in Settings to enable automatic updates.' } };
const sampleGames = [
  ['103',true,9,2,11,212,1760,24800,14600], ['222',true,14,4,8,264,2040,32100,17800], ['103',false,5,6,9,186,1880,19700,11200], ['64',true,7,3,16,147,1510,16400,10800], ['103',true,11,1,7,226,1830,29700,15900], ['157',false,6,8,5,241,2210,21500,14300], ['222',true,17,3,9,298,2310,38600,20700], ['103',true,8,2,13,208,1680,23100,13200], ['64',false,4,7,10,172,1990,14600,10900], ['103',true,10,3,12,234,1950,28500,15100],
] as const;
export const demoMatches: Match[] = sampleGames.map((g,i) => ({ id: `demo-${i}`, championKey: g[0], win: g[1], kills: g[2], deaths: g[3], assists: g[4], cs: g[5], duration: g[6], timestamp: Date.now() - (i * 8 + 1) * 3600000, queueId: 420, damage: g[7], gold: g[8], vision: 18 + i * 2, items: g[0] === '222' ? [3006,3031,3085,3036,3094] : g[0] === '64' ? [3047,3071,3053,3074] : [3020,3118,4645,3089,3157] }));
export const demoState: AppState = { ...initialState,
  summoner: { name: 'Riftwalker', tag: 'EUW', level: 247, icon: 29 },
  ranked: { tier: 'EMERALD', division: 'II', leaguePoints: 68, wins: 78, losses: 62 },
  matches: demoMatches,
  live: { time: 1163, championName: 'Ahri', championId: 'Ahri', name: 'Riftwalker#EUW', level: 12, kills: 7, deaths: 2, assists: 8, cs: 154, csPerMin: 7.94, vision: 24, csHistory: [5.2,5.8,5.5,6.3,6.8,6.4,7.1,7.6,7.3,7.9,8.1,7.94].map((value,i)=>({time: 60 + i * 100,value})), gold: 1240, health: 1384, maxHealth: 1780, attackDamage: 78, abilityPower: 246, gameMode: 'CLASSIC', items: [{ id: 3020, name: "Sorcerer's Shoes", count: 1 }, { id: 3118, name: 'Malignance', count: 1 }, { id: 4645, name: 'Shadowflame', count: 1 }] },
};
export const featured = ['Ahri','Jinx','LeeSin','Aatrox'];
const localImages = new Set(['Ahri','Jinx','LeeSin','Aatrox','Yasuo','Thresh','Lux','Caitlyn','Ezreal','Akali','Viego','Leona']);
export const resource = (path: string) => new URL(path, document.baseURI).href;
export const portrait = (champion: string, _version: string) => resource(`assets/champions/${champion}.png`);
export const itemImage = (id: number | string, _version: string) => resource(`assets/items/${id}.png`);
export const runeImage = (icon: string) => resource(`assets/runes/${icon}`);
export const strip = (text: string) => text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
export const duration = (seconds: number) => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export const queueName = (id: number) => ({ 420: 'Ranked Solo', 440: 'Ranked Flex', 450: 'ARAM', 400: 'Normal Draft', 430: 'Normal Blind', 480: 'Swiftplay', 1700: 'Arena', 900: 'URF' }[id] || 'League match');
export const timeAgo = (timestamp: number) => { const hours = Math.max(1, Math.floor((Date.now() - timestamp)/3600000)); return hours < 24 ? `${hours}h ago` : `${Math.floor(hours/24)}d ago`; };
export function guideFor(champion: Champion) {
  const id = champion.id;
  const marksman = champion.tags.includes('Marksman');
  const tank = champion.tags[0] === 'Tank' || ['Leona','Thresh','Nautilus'].includes(id);
  const fighter = champion.tags[0] === 'Fighter';
  const assassin = ['Akali','Katarina','Ekko','Diana'].includes(id);
  if (marksman) return { role: 'Bottom', start: [1055,2003], core: [3006,3031,3085], options: [3036,3094,3072], priority: id === 'Jinx' ? ['Q','W','E'] : ['Q','E','W'], primary: 8000, secondary: 8300, runes: [8008,8009,9104,8017,8304,8345,5005,5008,5001], note: 'A starting point for a critical-strike build. Adapt your purchases to the game and your champion.' };
  if (tank) return { role: champion.tags.includes('Support') ? 'Support' : 'Top', start: champion.tags.includes('Support') ? [3865,2003] : [1054,2003], core: [3047,3190,2502], options: [3083,3068,3075], priority: ['Q','W','E'], primary: 8400, secondary: 8300, runes: [8439,8463,8473,8451,8345,8347,5007,5010,5001], note: 'A durability-focused starting guide. Choose armor, magic resistance, or team utility for your matchup.' };
  if (champion.tags[0] === 'Support') return { role: 'Support', start: [3865,2003], core: [3158,6617,3504], options: [3107,6620,3222], priority: ['W','E','Q'], primary: 8200, secondary: 8400, runes: [8214,8226,8210,8237,8463,8453,5007,5010,5001], note: 'An enchanter starting guide focused on team utility. Adapt your skill order, healing, shielding, and defensive purchases to your champion.' };
  if (fighter && !['Ahri','Lux'].includes(id)) return { role: ['LeeSin','Viego','JarvanIV','XinZhao'].includes(id) ? 'Jungle' : 'Top', start: ['LeeSin','Viego','JarvanIV','XinZhao'].includes(id) ? [1102,2003] : [1054,2003], core: [3047,3071,3053], options: [6333,3074,3078], priority: id === 'LeeSin' ? ['Q','W','E'] : ['Q','E','W'], primary: 8000, secondary: 8400, runes: [8010,9111,9105,8299,8473,8451,5005,5008,5001], note: 'A bruiser starting guide focused on extended fights. Item and skill choices vary by champion and opponent.' };
  return { role: 'Mid', start: [1056,2003], core: [3020,id === 'Ahri' ? 3118 : 6655,4645], options: [3089,3157,3135], priority: ['Q','W','E'], primary: 8100, secondary: 8200, runes: [8112,assassin ? 8143 : 8139,8137,8106,8226,8210,5005,5008,5001], note: 'A burst-mage starting guide. Consider survivability, penetration, and mana needs before each purchase.' };
}
export function defaultRunePage(champion: Champion, paths: RunePath[]): RunePage {
  const guide = guideFor(champion);
  const primary = paths.find(p=>p.id === guide.primary) || paths[0];
  const secondary = paths.find(p=>p.id === guide.secondary) || paths.find(p=>p.id !== primary.id)!;
  const selectedPerkIds = guide.runes.map((id,i) => i < 4 && !primary.slots[i].runes.some(r=>r.id === id) ? primary.slots[i].runes[0].id : id);
  const used = new Set<number>();
  for (let i=4;i<6;i++) { let slot = secondary.slots.findIndex(s=>s.runes.some(r=>r.id === selectedPerkIds[i])); if (slot < 1 || used.has(slot)) { slot = [1,2,3].find(s=>!used.has(s))!; selectedPerkIds[i] = secondary.slots[slot].runes[0].id; } used.add(slot); }
  return { champion: champion.id, primaryStyleId: primary.id, subStyleId: secondary.id, selectedPerkIds };
}
