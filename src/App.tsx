import { useEffect, useRef, useState } from 'react';

import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, CirclePlay, Clock3, Crosshair, Download, ExternalLink, Gamepad2, History, LayoutDashboard, Layers3, ListFilter, LoaderCircle, Maximize2, Minus, Monitor, RefreshCw, Search, Settings2, Shield, SlidersHorizontal, Sparkles, Star, Swords, Target, TrendingUp, Users, Wifi, WifiOff, X, Zap } from 'lucide-react';

import type { AppState, Catalog, Champion, Match, Page, Settings } from './types';

import { demoState, duration, featured, guideFor, portrait, resource, timeAgo } from './data';

import { useAppState, useCatalog, useFavorites } from './hooks';

import { Badge, ChampionCard, ChampionImage, EmptyState, ItemIcon, Logo, MatchDetails, MatchRow, Modal, OverlayPanel, RoleIcon, SectionHeading, Toggle } from './components';

import Builds from './Builds';

import Dashboard from './Dashboard';
import RiotAccount from './RiotAccount';

import OverlayStudio from './OverlayStudio';
import CompanionOverlay from './CompanionOverlay';

import { UpdatePreferences, UpdateBanner } from './Updates';

const nav=[{id:'overview',label:'Your stats',icon:LayoutDashboard},{id:'champions',label:'Champions',icon:Swords},{id:'builds',label:'Builds & runes',icon:BookOpen},{id:'history',label:'Match history',icon:History},{id:'live',label:'Live game',icon:Activity},{id:'overlay',label:'Overlay',icon:Layers3}] as const;

const titles:Record<Page,string>={overview:'Your stats',champions:'Champions',builds:'Builds & runes',history:'Match history',live:'Live game',overlay:'Overlay',settings:'Settings'};

export default function App() {

  const {state,saveSettings,error:stateError}=useAppState();

  const {catalog,error:catalogError}=useCatalog();

  const {favorites,toggle}=useFavorites();

  const [page,setPage]=useState<Page>('overview');

  const [selected,setSelected]=useState('Ahri');

  const [search,setSearch]=useState('');

  const [demo,setDemo]=useState(!window.rift);

  const [toast,setToast]=useState('');

  const [match,setMatch]=useState<Match|null>(null);

  const [help,setHelp]=useState(false);

  const [refreshing,setRefreshing]=useState(false);

  const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const searchRef=useRef<HTMLInputElement>(null);

  const overlayRoute=location.hash.startsWith('#/overlay');
  const companionRoute=location.hash.startsWith('#/companion');

  useEffect(()=> { document.body.classList.toggle('overlay-window',overlayRoute || companionRoute); return ()=>document.body.classList.remove('overlay-window'); },[overlayRoute,companionRoute]);

  useEffect(()=> { const handler=(e:KeyboardEvent)=> { if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus();} if(e.key==='Escape')setSearch(''); }; window.addEventListener('keydown',handler); return ()=>window.removeEventListener('keydown',handler); },[]);

  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);},[]);

  const detectedKey=state.live?.championId || '';

  useEffect(()=>{ const found=catalog?.champions.find(champion=>champion.id===detectedKey || champion.key===detectedKey); if(found)setSelected(found.id); },[detectedKey,catalog]);

  const notify=(message:string)=> {setToast(message);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),5500);};

  const navigate=(next:Page)=>{setPage(next);setSearch('');document.querySelector('.workspace')?.scrollTo({top:0});};

  const selectChampion=(id:string)=>{setSelected(id);navigate('builds');};

  const refresh=async()=> { if(!window.rift){notify('Connect using the Windows desktop app.');return;}setRefreshing(true);try{const next=await window.rift.refresh();notify(next.profile.message || (next.summoner ? 'Riot account stats refreshed.' : next.live ? 'Live game refreshed.' : 'Start a game for the overlay. Connect your Riot account in Settings for match stats.'));}catch{notify('Could not refresh League data. Try again.');}finally{setRefreshing(false);}};

  const overlayAction=async(action:'show'|'hide'|'toggle'|'edit'|'reset')=> {if(!window.rift){notify('The real overlay is available in the Windows desktop app.');return;}try{await window.rift.overlay(action);if(action==='show')notify('Overlay opened.');}catch{notify('The overlay could not open. Try restarting DPM.lol.');}};

  if((overlayRoute || companionRoute) && !catalog)return null;

  if(catalogError)return <div className="boot-state"><Logo/><h2>Champion data could not load</h2><p>{catalogError}</p><button className="primary-button" onClick={()=>location.reload()}>Retry</button></div>;

  if(!catalog)return <div className="boot-state"><Logo/><LoaderCircle className="spin"/><span>Loading champion data…</span></div>;

  if(overlayRoute)return <div className="native-overlay" style={{zoom:state.settings.scale}}><OverlayPanel live={state.live} settings={state.settings} catalog={catalog} editing={state.overlay.editing} preview={false} onClose={()=>overlayAction('hide')} onLock={()=>overlayAction('edit')}/></div>;

  if(companionRoute)return <CompanionOverlay state={state} catalog={catalog}/>;

  const view=demo?{...demoState,settings:state.settings}:state;

  const champion=catalog.champions.find(c=>c.id===selected)||catalog.champions[0];

  const searchResults=search.trim()?catalog.champions.filter(c=>c.name.toLowerCase().includes(search.toLowerCase().trim())).slice(0,7):[];

  const player=view.summoner;

  const connected=!!state.live || ['connected','partial'].includes(state.profile.status);

  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-logo"><Logo/></div><nav aria-label="Main navigation">{nav.map(({id,label,icon:Icon})=><button key={id} aria-label={label} title={label} className={`nav-item ${page===id?'active':''}`} onClick={()=>navigate(id)}><Icon size={18}/><span>{label}</span>{id==='live'&&state.live&&<span className="nav-live-dot"/>}</button>)}</nav><div className="sidebar-bottom"><button aria-label="Settings" title="Settings" className={`nav-item ${page==='settings'?'active':''}`} onClick={()=>navigate('settings')}><Settings2 size={18}/><span>Settings</span></button><button className="nav-item" aria-label="Help and shortcuts" title="Help" onClick={()=>setHelp(true)}><CircleHelp size={18}/><span>Help</span><ArrowUpRight size={14}/></button><div className="sidebar-profile"><img src={`https://ddragon.leagueoflegends.com/cdn/${catalog.version}/img/profileicon/${player?.icon??29}.png`} alt="Player icon"/><div><strong>{player?.name||'Summoner'}{demo&&<span className="sample-profile">DEMO</span>}</strong><small>{player?`Level ${player.level}`:'Connect in Settings'}</small></div><div className={`profile-dot ${connected?'connected':''}`}/></div></div><div className="sidebar-version"><span>v{state.updates.version}</span></div></aside>

    <main className="main-area"><header className="topbar"><div className="topbar-breadcrumb"><strong>{titles[page]}</strong></div><div className="topbar-right"><div className="global-search"><Search size={15}/><input ref={searchRef} aria-label="Search champions" placeholder="Search champions…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&searchResults[0])selectChampion(searchResults[0].id);}}/><kbd>Ctrl K</kbd>{search&&<div className="search-results">{searchResults.length?searchResults.map(c=><button key={c.id} onClick={()=>selectChampion(c.id)}><ChampionImage champion={c} catalog={catalog}/><span>{c.name}<small>{c.title}</small></span><ArrowUpRight size={15}/></button>):<p>No champions found.</p>}</div>}</div><button className={`connection-pill ${connected?'connected':''}`} onClick={()=>state.account.riotId?refresh():navigate('settings')} title="Riot account connection">{refreshing?<RefreshCw size={13} className="spin"/>:<span className="status-dot"/>}<span>{state.live?'Live game':state.profile.status==='loading'?'Loading stats…':connected?'Riot connected':'Connect account'}</span></button><div className="window-controls"><button aria-label="Minimize window" onClick={()=>window.rift?.window('minimize')}><Minus size={14}/></button><button aria-label="Maximize window" onClick={()=>window.rift?.window('maximize')}><Maximize2 size={12}/></button><button aria-label="Close app" className="window-close" onClick={()=>window.rift?.window('close')}><X size={16}/></button></div></div></header>

      <div className="workspace"><div className="workspace-inner"><div className="workspace-meta"><span/><button className={`demo-switch ${demo?'active':''}`} onClick={()=>setDemo(!demo)}><CirclePlay size={14}/>{demo?'Demo mode on':'Try demo mode'}<span className="mini-switch"/></button></div>{demo&&<div className="demo-banner"><InfoIcon/><span>Sample data</span><button onClick={()=>setDemo(false)}>Use my stats <ArrowRight size={13}/></button></div>}{stateError&&<div className="demo-banner error-banner">{stateError}</div>}

      {page==='overview'&&<Dashboard view={view} catalog={catalog} navigate={navigate} onMatch={setMatch} onOverlay={()=>overlayAction('show')} demo={demo}/>}

      {page==='champions'&&<Champions catalog={catalog} favorites={favorites} toggleFavorite={toggle} selectChampion={selectChampion}/>}

      {page==='builds'&&<Builds key={champion.id} champion={champion} catalog={catalog} onChoose={selectChampion} onToast={notify} favorite={favorites.includes(champion.id)} onFavorite={()=>toggle(champion.id)}/>}

      {page==='history'&&<MatchHistory matches={view.matches} catalog={catalog} onMatch={setMatch} refresh={refresh} refreshing={refreshing} demo={demo}/>}

      {page==='live'&&<LiveGame view={view} catalog={catalog} selectChampion={selectChampion} onOverlay={()=>overlayAction('show')} demo={demo}/>}

      {page==='overlay'&&<OverlayStudio state={state} catalog={catalog} saveSettings={saveSettings} action={overlayAction}/>}

      {page==='settings'&&<Preferences state={state} saveSettings={saveSettings} onToast={notify} catalog={catalog}/>}

      {page==='settings'&&<UpdatePreferences state={state} saveSettings={saveSettings} onToast={notify}/>}

      <UpdateBanner state={state} onToast={notify}/>

      </div></div>

    </main>{toast&&<div className="toast" role="status"><span className="toast-icon"><Check size={17}/></span><p>{toast}</p><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={16}/></button></div>}{match&&<Modal title="Match details" onClose={()=>setMatch(null)}><MatchDetails match={match} catalog={catalog}/>{demo&&<div className="modal-demo-note">Sample match · demo mode</div>}</Modal>}{help&&<Modal title="Help & shortcuts" onClose={()=>setHelp(false)}><div className="help-content"><p>Connect your Riot ID in Settings to load account stats through your Riot API backend. The overlay connects automatically when a game starts. Use <strong>Borderless</strong> or <strong>Windowed</strong> display mode to use the overlay.</p><div className="shortcut-row"><span>Show / hide overlay</span><kbd>Ctrl + Shift + O</kbd></div><div className="shortcut-row"><span>Unlock / lock overlay position</span><kbd>Ctrl + Shift + L</kbd></div><div className="shortcut-row"><span>Search for a champion</span><kbd>Ctrl + K</kbd></div><h3>Overlay controls</h3><p>Use Overlay to choose widgets, size, transparency, and your CS goal. Unlock the overlay to drag its header, then lock it to pass mouse clicks to your game.</p><h3>Builds & runes</h3><p>Builds and rune presets load from OP.GG. View or edit a preset, then select those runes in League. Riot’s public API does not provide rune import or champion-select access.</p><h3>About DPM.lol</h3><p>Builds and runes come from OP.GG. Item data comes from Riot Data Dragon. Account stats use Riot’s public APIs. Live stats use Riot’s documented Live Client Data API.</p><p className="legal-text">DPM.lol is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p><a href="https://developer.riotgames.com/docs/lol" target="_blank" rel="noreferrer">Riot API documentation <ExternalLink size={13}/></a></div></Modal>}</div>;

}

function InfoIcon(){return <CircleHelp size={15}/>;}

function StatCard({ label,value,detail,icon,color }: {label:string;value:string;detail:string;icon:React.ReactNode;color:string}) { return <div className={`stat-card ${color}`}><div className="stat-card-label"><span>{label}</span>{icon}</div><strong>{value}<small>{label==='AVERAGE KDA'?'KDA':label==='CREEP SCORE / MIN'?'CS':''}</small></strong><div className="stat-card-bottom"><span>{detail}</span></div></div>; }

function Champions({catalog,favorites,toggleFavorite,selectChampion}:{catalog:Catalog;favorites:string[];toggleFavorite(id:string):void;selectChampion(id:string):void}) {

  const [query,setQuery]=useState('');const [role,setRole]=useState('All');const [onlyFav,setOnlyFav]=useState(false);

  const champions=catalog.champions.filter(c=>c.name.toLowerCase().includes(query.toLowerCase())&&(role==='All'||c.tags.includes(role))&&(!onlyFav||favorites.includes(c.id)));

  return <><div className="page-heading"><div><h1>Champions</h1></div><Badge color="green">RIOT DATA DRAGON</Badge></div><div className="champion-filters"><div className="filter-search"><Search size={17}/><input aria-label="Filter champion library" placeholder="Find a champion…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="role-filters">{['All','Fighter','Assassin','Mage','Marksman','Tank','Support'].map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}>{r==='All'?<Swords size={14}/>:<RoleIcon role={r} size={14}/>}<span>{r}</span></button>)}</div><button className={`secondary-button favorite-filter ${onlyFav?'favorited':''}`} onClick={()=>setOnlyFav(!onlyFav)} aria-label="Show favorite champions" aria-pressed={onlyFav}><Star size={15} fill={onlyFav?'currentColor':'none'}/></button></div><div className="result-count">{champions.length} champions<span>{onlyFav?'Favorites':role==='All'?'All classes':role}</span></div>{champions.length?<div className="champion-library-grid">{champions.map(c=><ChampionCard key={c.id} champion={c} catalog={catalog} favorite={favorites.includes(c.id)} onFavorite={()=>toggleFavorite(c.id)} onSelect={()=>selectChampion(c.id)}/>)}</div>:<EmptyState icon={<Search size={27}/>} title="No champions found" body="Try another name or change your filters." action={<button className="secondary-button" onClick={()=>{setQuery('');setRole('All');setOnlyFav(false);}}>Clear filters</button>}/>}</>;

}

function MatchHistory({matches,catalog,onMatch,refresh,refreshing,demo}:{matches:Match[];catalog:Catalog;onMatch(match:Match):void;refresh():void;refreshing:boolean;demo:boolean}) {

  const [filter,setFilter]=useState('all');const [champion,setChampion]=useState('all');

  const list=matches.filter(m=>(filter==='all'||(filter==='wins'?m.win:!m.win))&&(champion==='all'||m.championKey===champion));

  const keys=[...new Set(matches.map(m=>m.championKey))];const wins=matches.filter(m=>m.win).length;

  return <><div className="page-heading"><div><h1>Match history</h1><p>{demo?'Explore sample matches, builds, and performance.':'Your latest matches from Riot.'}</p></div><button className="secondary-button" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing?'spin':''}/>Refresh matches</button></div><div className="history-summary panel"><div><strong>{matches.length}</strong><span>Recent games</span></div><div><strong className="green-text">{wins}</strong><span>Victories</span></div><div><strong className="red-text">{matches.length-wins}</strong><span>Defeats</span></div><div><strong>{matches.length?Math.round(wins/matches.length*100):0}%</strong><span>Win rate</span></div><div className="match-result-dots">{matches.slice(0,15).map(m=><span key={m.id} className={m.win?'win':'loss'} title={m.win?'Win':'Loss'}>{m.win?'W':'L'}</span>)}</div></div><div className="history-filters"><div className="segmented-control">{[['all','All games'],['wins','Victories'],['losses','Defeats']].map(([value,label])=><button className={filter===value?'active':''} key={value} onClick={()=>setFilter(value)}>{label}</button>)}</div><select aria-label="Filter matches by champion" value={champion} onChange={e=>setChampion(e.target.value)}><option value="all">All champions</option>{keys.map(key=><option key={key} value={key}>{catalog.champions.find(c=>c.key===key)?.name||key}</option>)}</select></div><div className="match-list history-list">{list.length?list.map(m=><MatchRow key={m.id} match={m} catalog={catalog} onClick={()=>onMatch(m)}/>):<EmptyState icon={<History size={27}/>} title={matches.length?'No games match this filter':'Waiting for your match history'} body={matches.length?'Choose another result or champion.':'Connect your Riot ID in Settings to load your recent public matches.'}/>}</div></>;

}

function LiveGame({view,catalog,selectChampion,onOverlay,demo}:{view:AppState;catalog:Catalog;selectChampion(id:string):void;onOverlay():void;demo:boolean}) {

  const live=view.live;

  const champion=catalog.champions.find(c=>c.id===live?.championId||c.name===live?.championName);

  return <><div className="page-heading"><div><h1>Live game</h1></div><button className="primary-button" onClick={onOverlay}><Monitor size={15}/>Open overlay</button></div>{live?<><div className="panel live-player-heading"><div><Badge color={demo?'purple':'green'}>{demo?'SAMPLE GAME':'LIVE GAME'}</Badge><h2>Your game</h2></div><div className="live-clock"><Clock3 size={22}/>{duration(live.time)}</div></div><div className="stats-grid"><StatCard label="K / D / A" value={`${live.kills} / ${live.deaths} / ${live.assists}`} detail={`${((live.kills+live.assists)/Math.max(live.deaths,1)).toFixed(2)} KDA ratio`} icon={<Swords size={18}/>} color="purple"/><StatCard label="CREEP SCORE / MIN" value={live.csPerMin.toFixed(1)} detail={`${live.cs} total creep score`} icon={<Crosshair size={18}/>} color="orange"/><StatCard label="GOLD TO SPEND" value={live.gold.toLocaleString()} detail="Your current available gold" icon={<Zap size={18}/>} color="gold"/><StatCard label="VISION SCORE" value={live.vision == null ? '—' : String(Math.floor(live.vision))} detail="Your vision score" icon={<Shield size={18}/>} color="green"/></div><div className="live-details-grid"><div className="panel live-items"><SectionHeading title="Your inventory" detail="Items currently on your champion"/><div className="item-line">{live.items.length?live.items.map((item,i)=><div className="labeled-item" key={`${item.id}-${i}`}><ItemIcon id={item.id} catalog={catalog} large/><span>{item.name}</span></div>):<p className="muted">Your items will appear here when purchased.</p>}</div></div><div className="panel live-goal"><Target size={25}/><h3>Your personal CS goal</h3><p>{view.settings.csTarget.toFixed(1)} CS / min</p><div className="goal-progress"><div style={{width:`${Math.min(100,live.csPerMin/view.settings.csTarget*100)}%`}}/></div><span>{live.csPerMin>=view.settings.csTarget?'Goal met':`${(view.settings.csTarget-live.csPerMin).toFixed(1)} CS / min below goal`}</span></div></div>{champion&&<button className="secondary-button" onClick={()=>selectChampion(champion.id)}>Builds & runes <ArrowUpRight size={14}/></button>}</>:<div className="panel waiting-game"><EmptyState icon={<Gamepad2 size={36}/>} title="Waiting for a game" body="Start a match or Practice Tool. Your own KDA, creep score, available gold, and inventory will appear automatically."/></div>}</>;

}

function Preferences({state,saveSettings,onToast,catalog}:{state:AppState;saveSettings(input:Partial<Settings>):Promise<void>;onToast(message:string):void;catalog:Catalog}) {

  return <><div className="page-heading"><div><h1>Settings</h1></div></div><div className="settings-page-grid"><section className="panel settings-panel"><RiotAccount state={state} onToast={onToast}/><div className="settings-divider"/><SectionHeading title="Overlay behavior"/><div className="setting-row"><div><strong>Start with your game</strong><small>Open the overlay automatically when a match begins.</small></div><Toggle checked={state.settings.autoOverlay} onChange={value=>saveSettings({autoOverlay:value})} label="Auto-open overlay in settings"/></div><div className="setting-row"><div><strong>Click through</strong><small>Keep mouse input focused on League while locked.</small></div><Toggle checked={state.settings.clickThrough} onChange={value=>saveSettings({clickThrough:value})} label="Click through in settings"/></div></section><section className="panel settings-panel"><SectionHeading title="About DPM.lol"/><div className="about-brand"><Logo/><Badge>VERSION {state.updates.version}</Badge></div><p>Player stats, builds, runes, and an in-game overlay.</p><div className="about-info"><div><span>Champion data</span><strong>Riot Data Dragon {catalog.version}</strong></div><div><span>Account data</span><strong>Riot public APIs</strong></div><div><span>Live overlay</span><strong>Riot Live Client Data API</strong></div><div><span>Toggle shortcut</span><strong>{state.shortcuts.toggle?'Registered':'Unavailable / browser preview'}</strong></div><div><span>Move shortcut</span><strong>{state.shortcuts.edit?'Registered':'Unavailable / browser preview'}</strong></div></div><div className="guide-note"><InfoIcon/><span>Builds and runes from OP.GG. Cached builds show their fetch time.</span></div><p className="legal-text">DPM.lol is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p></section></div></>;

}
