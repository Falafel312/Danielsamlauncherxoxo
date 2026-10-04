const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLockfile, normalizeLive, normalizeMatches, validateRunePage, sanitizeSettings, upsertRunePage } = require('../electron/league.cjs');
const paths = require('../public/data/runes.json');
test('lockfile parser rejects malformed ports, missing tokens, and remote protocols', () => {
  assert.deepEqual(parseLockfile('LeagueClient:123:45678:local-test-token:https\n'), { port: 45678, password: 'local-test-token' });
  for (const text of ['LeagueClient:1:0:x:https','LeagueClient:1:70000:x:https','LeagueClient:1:123::https','LeagueClient:1:123:x:http','bad']) assert.throws(() => parseLockfile(text));
});
const live = { gameData: { gameTime: 600, gameMode: 'CLASSIC' }, activePlayer: { riotId: 'Self#TEST', level: 9, currentGold: 1100, championStats: { currentHealth: 500, maxHealth: 1000, attackDamage: 70, abilityPower: 100 } }, allPlayers: [{ riotId: 'Other#TEST', championName: 'Jinx', scores: { kills: 99 } }, { riotId: 'Self#TEST', championName: 'Ahri', rawChampionName: 'game_character_displayname_Ahri', scores: { kills: 3, deaths: 1, assists: 5, creepScore: 80 }, items: [{ itemID: 1056, displayName: "Doran's Ring", count: 1 }] }] };
test('live stats are derived only from the active player, including CS per minute', () => {
  const result = normalizeLive(live); assert.equal(result.kills,3); assert.equal(result.csPerMin,8); assert.equal(result.championId,'Ahri'); assert.equal(result.gold,1100); assert.equal(result.items[0].id,1056);
});
test('live data handles the first frame without division by zero and rejects missing self', () => {
  assert.equal(normalizeLive({ ...live, gameData: { gameTime: 0 } }).csPerMin,0);
  assert.throws(() => normalizeLive({ ...live, allPlayers: [live.allPlayers[0]] }));
  assert.throws(() => normalizeLive(null));
});
test('match history selects the current summoner and never substitutes another player', () => {
  const raw = { games: { games: [{ gameId: 1, gameDuration: 1800, participantIdentities: [{ participantId: 2, player: { summonerId: 42 } }], participants: [{ participantId: 1, championId: 222, stats: { kills: 99 } }, { participantId: 2, championId: 103, stats: { kills: 4, deaths: 2, assists: 5, win: true, totalMinionsKilled: 170, neutralMinionsKilled: 12, item0: 1056 } }] }] } };
  const result = normalizeMatches(raw,42); assert.equal(result[0].kills,4); assert.equal(result[0].cs,182); assert.equal(result[0].championKey,'103'); assert.deepEqual(result[0].items,[1056]); assert.equal(normalizeMatches(raw,999).length,0);
});
test('the client single-participant match format and unavailable history are handled', () => {
  assert.equal(normalizeMatches({ games: { games: [{ gameId: 1, participants: [{ championId: 103, stats: { win: true } }] }] } },42).length,1);
  assert.deepEqual(normalizeMatches({}),[]); assert.deepEqual(normalizeMatches(null),[]);
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
test('rune import replaces only the matching app-owned page and never deletes unrelated pages',async()=>{
  const calls=[];const request=async(_credentials,url,method='GET',body)=>{calls.push({url,method,body});return method==='GET'?[{id:1,name:'My personal page',isEditable:true},{id:2,name:'DPM.lol • Ahri',isEditable:true}]:null;};
  assert.equal(await upsertRunePage({},runeInput,paths,request),'DPM.lol • Ahri');assert.equal(calls.length,2);assert.equal(calls[1].method,'PUT');assert.equal(calls[1].url,'/lol-perks/v1/pages/2');assert.ok(calls.every(call=>call.method!=='DELETE'));
});
test('rune import creates an app page when missing and rejects invalid runes before any request',async()=>{
  const calls=[];const request=async(_credentials,url,method='GET')=>{calls.push({url,method});return method==='GET'?[{id:1,name:'My page'}]:null;};
  await upsertRunePage({},runeInput,paths,request);assert.equal(calls[1].method,'POST');assert.equal(calls[1].url,'/lol-perks/v1/pages');
  calls.length=0;await assert.rejects(()=>upsertRunePage({},{...runeInput,selectedPerkIds:[]},paths,request));assert.equal(calls.length,0);
});
