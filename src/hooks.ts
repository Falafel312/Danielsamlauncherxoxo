import { useEffect, useState } from 'react';
import { initialState, resource } from './data';
import type { AppState, Build, Catalog, Champion, Item, RunePath, Settings } from './types';
export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    if (window.rift) return initialState;
    try { const saved = JSON.parse(localStorage.getItem('rift.settings') || '{}'); return { ...initialState, settings: { ...initialState.settings, ...saved, widgets: { ...initialState.settings.widgets, ...saved.widgets } } }; } catch { return initialState; }
  });
  const [error, setError] = useState('');
  useEffect(() => { let active = true; const unsub = window.rift?.onState(next=> { if(active) setState(next); }); window.rift?.getState().then(next=> { if(active) setState(next); }).catch(()=>setError('The desktop bridge could not connect. Restart DPM.lol to try again.')); return ()=> { active=false; unsub?.(); }; },[]);
  const saveSettings = async (input: Partial<Settings>) => {
    try { if (window.rift) { const settings = await window.rift.saveSettings(input); setState(previous=>({...previous,settings})); }
    else setState(previous=> { const settings = { ...previous.settings, ...input }; localStorage.setItem('rift.settings',JSON.stringify(settings)); return {...previous,settings}; }); }
    catch { setError('Preferences could not be saved. Please try again.'); }
  };
  return { state, saveSettings, error };
}
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error,setError] = useState('');
  useEffect(()=> { let active = true;
    Promise.all(['champions','items','runes','meta'].map(file=>fetch(resource(`data/${file}.json`)).then(response=> { if(!response.ok) throw new Error('missing data'); return response.json(); }))).then(([champions,items,runes,meta])=> { if(active) setCatalog({ champions: Object.values(champions.data) as Champion[], items: items.data as Record<string,Item>, runes: runes as RunePath[], version: meta.version }); }).catch(()=> { if(active) setError('Champion data could not load. Rebuild or reinstall DPM.lol.'); });
    return ()=> { active=false; };
  },[]);
  return { catalog, error };
}
export function useBuild(champion: string, role = 'auto') {
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setBuild(null); setError('');
    if (!champion) { setLoading(false); return; }
    setLoading(true);
    const request = window.rift ? window.rift.getBuild(champion, role, revision > 0) : fetch(`/api/build?champion=${encodeURIComponent(champion)}&role=${encodeURIComponent(role)}&refresh=${revision > 0}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Build unavailable.'); return result; });
    request.then(result => { if (active) setBuild(result); }).catch(error => { if (active) { setError(error.message || 'Could not reach OP.GG.'); retry = setTimeout(() => setRevision(previous => previous + 1), 60000); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; clearTimeout(retry); };
  }, [champion, role, revision]);
  return { build, loading, error, refresh: () => setRevision(previous => previous + 1) };
}
export function useFavorites() {
  const [favorites,setFavorites] = useState<string[]>(()=> { try { const saved = JSON.parse(localStorage.getItem('rift.favorites') || '["Ahri","Jinx","LeeSin"]'); return Array.isArray(saved) ? saved.filter(x=>typeof x === 'string') : []; } catch { return []; } });
  const toggle = (id:string)=>setFavorites(previous=> { const next=previous.includes(id) ? previous.filter(v=>v!==id) : [...previous,id]; localStorage.setItem('rift.favorites',JSON.stringify(next)); return next; });
  return { favorites, toggle };
}
