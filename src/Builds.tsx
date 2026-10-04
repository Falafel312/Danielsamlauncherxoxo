import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download, ExternalLink, RefreshCw, Star } from 'lucide-react';
import type { Catalog, Champion, Rune, RunePage, RunePath } from './types';
import { defaultRunePage, runeImage, strip } from './data';
import { ItemIcon, SectionHeading } from './components';
import { useBuild } from './hooks';

function RuneOption({ rune, selected, onClick }: { rune: Rune; selected: boolean; onClick(): void }) {
  return <button className={`rune-option ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected} title={strip(rune.longDesc)}><img src={runeImage(rune.icon)} alt=""/><span>{rune.name}</span>{selected && <Check size={14}/>}</button>;
}
function savedPage(champion: Champion, catalog: Catalog) {
  try { const page = JSON.parse(localStorage.getItem(`rift.runes.${champion.id}`) || 'null') as RunePage | null; if (page && catalog.runes.some(p => p.id === page.primaryStyleId) && catalog.runes.some(p => p.id === page.subStyleId) && page.selectedPerkIds?.length === 9 && page.primaryStyleId !== page.subStyleId) return page; } catch {}
  return null;
}
export default function Builds({ champion, catalog, onChoose, onToast, favorite, onFavorite }: { champion: Champion; catalog: Catalog; onChoose(id: string): void; onToast(message: string): void; favorite: boolean; onFavorite(): void; }) {
  const [tab, setTab] = useState<'build' | 'runes'>('build');
  const [role, setRole] = useState('auto');
  const { build, loading, error, refresh } = useBuild(champion.id, role);
  const [page, setPage] = useState<RunePage>(() => savedPage(champion, catalog) || defaultRunePage(champion, catalog.runes));
  const [origin, setOrigin] = useState(() => savedPage(champion, catalog) ? 'Saved page' : 'Custom page');
  const [importing, setImporting] = useState(false);
  const dirty = useRef(!!savedPage(champion, catalog));
  useEffect(() => { if (build && !dirty.current) { setPage(build.runes); setOrigin('OP.GG preset'); } }, [build]);
  const primary = catalog.runes.find(path => path.id === page.primaryStyleId)!;
  const secondary = catalog.runes.find(path => path.id === page.subStyleId)!;
  const edit = (next: RunePage) => { dirty.current = true; setOrigin('Custom page'); setPage(next); };
  const updatePerk = (index: number, id: number) => edit({ ...page, selectedPerkIds: page.selectedPerkIds.map((value, i) => i === index ? id : value) });
  const changePath = (type: 'primary' | 'secondary', id: number) => {
    const path = catalog.runes.find(p => p.id === id)!;
    const other = catalog.runes.find(p => p.id !== id && p.id === (type === 'primary' ? page.subStyleId : page.primaryStyleId)) || catalog.runes.find(p => p.id !== id)!;
    const p = type === 'primary' ? path : other, s = type === 'secondary' ? path : other;
    edit({ ...page, primaryStyleId: p.id, subStyleId: s.id, selectedPerkIds: [...p.slots.map(slot => slot.runes[0].id), s.slots[1].runes[0].id, s.slots[2].runes[0].id, ...page.selectedPerkIds.slice(6)] });
  };
  const selectSecondary = (rune: Rune, slot: number) => {
    const first = secondary.slots.findIndex(s => s.runes.some(r => r.id === page.selectedPerkIds[4]));
    updatePerk(first === slot ? 4 : 5, rune.id);
  };
  const save = () => { try { localStorage.setItem(`rift.runes.${champion.id}`, JSON.stringify(page)); setOrigin('Saved page'); onToast('Rune page saved.'); } catch { onToast('Could not save the rune page.'); } };
  const importPage = async () => {
    if (!window.rift) { onToast('Open the desktop app to import runes.'); return; }
    setImporting(true);
    try { const result = await window.rift.importRunes(page); onToast(result.message); if (result.ok) localStorage.setItem(`rift.runes.${champion.id}`, JSON.stringify(page)); }
    catch { onToast('Rune import failed. Check your League connection.'); } finally { setImporting(false); }
  };
  const itemGroup = (title: string, ids: number[], numbered = false) => <section className="build-stage"><h3>{title}</h3><div className="item-line">{ids.map((id, i) => <div className="build-item" key={`${id}-${i}`}>{numbered && <span className="item-order">{String(i + 1).padStart(2, '0')}</span>}<ItemIcon id={id} catalog={catalog} large/><strong>{catalog.items[String(id)]?.name}</strong><span>{catalog.items[String(id)]?.gold.total.toLocaleString()} gold</span></div>)}</div></section>;
  return <div className="build-page">
    <div className="page-heading"><div><h1>Builds & runes</h1><p>Global · Emerald+</p></div><div className="build-selects"><label><span className="field-label">Champion</span><select aria-label="Select champion for build" value={champion.id} onChange={event => onChoose(event.target.value)}>{catalog.champions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span className="field-label">Role</span><select aria-label="Build role" value={role} onChange={event => setRole(event.target.value)}>{[['auto', 'Main role'], ['top', 'Top'], ['jungle', 'Jungle'], ['mid', 'Mid'], ['adc', 'Bottom'], ['support', 'Support']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className={`icon-button ${favorite ? 'favorited' : ''}`} aria-label={favorite ? 'Unfavorite champion' : 'Favorite champion'} aria-pressed={favorite} onClick={onFavorite}><Star size={19} fill={favorite ? 'currentColor' : 'none'}/></button></div></div>
    <div className="build-source-bar"><span>{build ? <><a href={build.sourceUrl} target="_blank" rel="noreferrer">OP.GG<ExternalLink size={13}/></a><span>Patch {build.patch || '—'}</span><span>{build.stale ? 'Offline cache' : 'Updated'} {new Date(build.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></> : loading ? 'Loading OP.GG…' : 'OP.GG'}</span><button className="icon-button" aria-label="Refresh build" disabled={loading} onClick={refresh}><RefreshCw size={17} className={loading ? 'spin' : ''}/></button></div>
    <div className="tabs" role="tablist" aria-label="Build and runes"><button role="tab" aria-selected={tab === 'build'} className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>Item build</button><button role="tab" aria-selected={tab === 'runes'} className={tab === 'runes' ? 'active' : ''} onClick={() => setTab('runes')}>Rune editor</button></div>
    {error && <div className="source-error" role="alert"><span>{error}</span><button className="secondary-button" onClick={refresh}>Try again</button></div>}
    {tab === 'build' && (loading ? <div className="panel build-loading" role="status"><RefreshCw className="spin" size={24}/><span>Getting the latest build…</span></div> : build ? <div className="build-grid"><div className="panel build-main">{itemGroup('Core build', build.core, true)}<div className="build-split">{itemGroup('Start', build.start)}{itemGroup('Boots', build.boots)}</div>{build.alternatives.length > 0 && itemGroup('Other builds use', build.alternatives)}</div><aside className="panel rune-summary"><div className="panel-eyebrow"><span>Runes</span><span>{origin}</span></div><div className="rune-summary-path"><img src={runeImage(primary.icon)} alt=""/><div><h2>{primary.slots[0].runes.find(rune => rune.id === page.selectedPerkIds[0])?.name}</h2><span>{primary.name} / {secondary.name}</span></div></div><div className="rune-summary-icons">{page.selectedPerkIds.slice(0, 6).map(id => { const rune = catalog.runes.flatMap(path => path.slots.flatMap(slot => slot.runes)).find(rune => rune.id === id); return rune && <img key={id} src={runeImage(rune.icon)} alt={rune.name} title={rune.name}/>; })}</div><button className="primary-button full-width" onClick={importPage} disabled={importing}><Download size={17}/>{importing ? 'Importing…' : 'Import to League'}</button><button className="secondary-button full-width" onClick={() => setTab('runes')}>Edit runes<ArrowRight size={16}/></button></aside></div> : <div className="panel empty-build">Select a champion and role to load its build.</div>)}
    {tab === 'runes' && <><div className="rune-editor-heading"><span>{origin}</span><button className="secondary-button" disabled={!build} onClick={() => { if (build) { dirty.current = false; setPage(build.runes); setOrigin('OP.GG preset'); } }}><RefreshCw size={16}/>Use OP.GG preset</button></div><div className="rune-editor-grid">{([{ path: primary, type: 'primary' }, { path: secondary, type: 'secondary' }] as { path: RunePath; type: 'primary' | 'secondary' }[]).map(({ path, type }) => <div className="panel rune-path-panel" key={type}><div className="rune-path-heading"><img src={runeImage(path.icon)} alt=""/><label><span className="field-label">{type === 'primary' ? 'Primary' : 'Secondary'}</span><select aria-label={`${type} rune path`} value={path.id} onChange={event => changePath(type, Number(event.target.value))}>{catalog.runes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>{path.slots.map((slot, slotIndex) => type === 'secondary' && slotIndex === 0 ? null : <div className="rune-row" key={slotIndex}>{slot.runes.map(rune => <RuneOption key={rune.id} rune={rune} selected={type === 'primary' ? page.selectedPerkIds[slotIndex] === rune.id : page.selectedPerkIds.slice(4, 6).includes(rune.id)} onClick={() => type === 'primary' ? updatePerk(slotIndex, rune.id) : selectSecondary(rune, slotIndex)}/>)}</div>)}</div>)}</div><div className="panel shard-panel"><strong>Stat shards</strong>{[[[5008, 'Adaptive force'], [5005, 'Attack speed'], [5007, 'Ability haste']], [[5008, 'Adaptive force'], [5010, 'Move speed'], [5001, 'Scaling health']], [[5011, 'Health'], [5013, 'Tenacity'], [5001, 'Scaling health']]].map((row, i) => <div className="shard-row" key={i}>{row.map(([id, label]) => <button key={id} aria-pressed={page.selectedPerkIds[i + 6] === id} className={page.selectedPerkIds[i + 6] === id ? 'selected' : ''} onClick={() => updatePerk(i + 6, Number(id))}>{label}</button>)}</div>)}</div><div className="rune-actions"><span>DPM.lol page</span><button className="secondary-button" onClick={save}><Check size={17}/>Save locally</button><button className="primary-button" onClick={importPage} disabled={importing}><Download size={17}/>{importing ? 'Importing…' : 'Import to League'}</button></div></>}
  </div>;
}
