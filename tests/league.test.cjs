const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLive, validateRunePage, sanitizeSettings } = require('../electron/league.cjs');
const paths = require('../public/data/runes.json');
const live = { gameData: { gameTime: 600, gameMode: 'CLASSIC' }, activePlayer: { riotId: 'Self#TEST', level: 9, currentGold: 1100, championStats: { currentHealth: 500, maxHealth: 1000, attackDamage: 70, abilityPower: 100 } }, allPlayers: [{ riotId: 'Other#TEST', championName: 'Jinx', scores: { kills: 99 } }, { riotId: 'Self#TEST', championName: 'Ahri', rawChampionName: 'game_character_displayname_Ahri', scores: { kills: 3, deaths: 1, assists: 5, creepScore: 80 }, items: [{ itemID: 1056, displayName: "Doran's Ring", count: 1 }] }] };
test('live stats are derived only from the active player, including CS per minute', () => {
  const result = normalizeLive(live); assert.equal(result.kills,3); assert.equal(result.csPerMin,8); assert.equal(result.championId,'Ahri'); assert.equal(result.gold,1100); assert.equal(result.items[0].id,1056);
});
test('live data handles the first frame without division by zero and rejects missing self', () => {
  assert.equal(normalizeLive({ ...live, gameData: { gameTime: 0 } }).csPerMin,0);
  assert.throws(() => normalizeLive({ ...live, allPlayers: [live.allPlayers[0]] }));
  assert.throws(() => normalizeLive(null));
});
const runeInput = { champion: 'Ahri', primaryStyleId: 8100, subStyleId: 8200, selectedPerkIds: [8112,8139,8137,8106,8226,8210,5005,5008,5001] };
test('valid rune pages get a controlled app-owned name', () => { const result=validateRunePage(runeInput,paths); assert.equal(result.name,'DPM.lol • Ahri'); assert.equal(result.current,true); assert.equal(result.selectedPerkIds.length,9); });
test('rune validation rejects same paths, wrong slots, duplicate secondary slots, and invalid shards', () => {
  const examples = [{...runeInput,subStyleId:8100},{...runeInput,champion:'../../foreign-page'},{...runeInput,selectedPerkIds:[]},{...runeInput,selectedPerkIds:[8112,8112,8137,8106,8226,8210,5005,5008,5001]},{...runeInput,selectedPerkIds:[8112,8139,8137,8106,8226,8275,5005,5008,5001]},{...runeInput,selectedPerkIds:[8112,8139,8137,8106,8226,8210,9999,5008,5001]}];
  for (const example of examples) assert.throws(()=>validateRunePage(example,paths));
});
const defaults = { autoOverlay:true,clickThrough:true,opacity:.94,scale:1,csTarget:7,widgets:{kda:true,cs:true,gold:true,build:true} };
test('preferences clamp overlay dimensions and reject unknown or invalid fields', () => {
  const settings = sanitizeSettings({ opacity:99,scale:-1,csTarget:50,autoOverlay:false,clickThrough:'yes',widgets:{cs:false,secret:true},password:'not-persisted' },defaults);
  assert.equal(settings.opacity,1); assert.equal(settings.scale,.8); assert.equal(settings.csTarget,12); assert.equal(settings.autoOverlay,false); assert.equal(settings.clickThrough,true); assert.equal(settings.widgets.cs,false); assert.equal(settings.widgets.secret,undefined); assert.equal(settings.password,undefined);
  assert.equal(sanitizeSettings({opacity:NaN,scale:Infinity},defaults).opacity,.94); assert.equal(defaults.widgets.cs,true);
});
test('live identity requires the full Riot ID, including the tag', () => {
  const raw = { ...live, activePlayer: { riotIdGameName: 'Same', riotIdTagLine: 'SELF' }, allPlayers: [{ riotIdGameName: 'Same', riotIdTagLine: 'OTHER', scores: { kills: 99 } }, { riotIdGameName: 'Same', riotIdTagLine: 'SELF', scores: { kills: 3 } }] };
  assert.equal(normalizeLive(raw).kills, 3);
  assert.throws(() => normalizeLive({ ...raw, activePlayer: {} }));
});
