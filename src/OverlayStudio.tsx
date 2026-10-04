import { Monitor, RotateCcw, Move, Minus, Plus } from 'lucide-react';
import type { AppState, Catalog, Settings } from './types';
import { demoState } from './data';
import { Toggle } from './components';
import OverlayPanel from './Overlay';
import OverlayExtrasSettings from './OverlayExtrasSettings';

export default function OverlayStudio({ state, catalog, saveSettings, action }: { state: AppState; catalog: Catalog; saveSettings(input: Partial<Settings>): Promise<void>; action(action: 'show' | 'hide' | 'toggle' | 'edit' | 'reset'): void }) {
  const settings = state.settings;
  return <>
    <div className="page-heading"><div><h1>Overlay</h1></div><button className="primary-button" onClick={() => action('toggle')}><Monitor size={18}/>{state.overlay.visible ? 'Hide overlay' : 'Launch overlay'}</button></div>
    <div className="overlay-studio-grid"><div className="overlay-preview-stage"><div className="preview-stage-label"><span>Live preview</span><span>Sample game</span></div><div className="preview-map" aria-hidden="true"><div/><div/><div/></div><div className="preview-overlay-wrapper" style={{ transform: `scale(${settings.scale})` }}><OverlayPanel live={demoState.live} settings={settings} catalog={catalog}/></div><div className="preview-legend">Drag when unlocked · Borderless or windowed</div></div>
      <section className="panel overlay-options"><div className="section-heading"><h2>Widgets</h2><span className="muted">Autosaved</span></div>
        <div className="widget-setting"><div className="setting-row"><span>CS / min</span><Toggle label="Show CS per minute" checked={settings.widgets.cs} onChange={cs => saveSettings({ widgets: { ...settings.widgets, cs } })}/></div><div className="segmented-control" aria-label="CS display mode"><button className={settings.csDisplay === 'number' ? 'active' : ''} aria-pressed={settings.csDisplay === 'number'} onClick={() => saveSettings({ csDisplay: 'number' })}>Number</button><button className={settings.csDisplay === 'graph' ? 'active' : ''} aria-pressed={settings.csDisplay === 'graph'} onClick={() => saveSettings({ csDisplay: 'graph' })}>Graph + number</button></div></div>
        {([{ id: 'vision', label: 'Vision score' }, { id: 'waves', label: 'Waves to item' }] as const).map(({ id, label }) => <div className="setting-row" key={id}><span>{label}</span><Toggle label={`Show ${label}`} checked={settings.widgets[id]} onChange={value => saveSettings({ widgets: { ...settings.widgets, [id]: value } })}/></div>)}
        <p className="wave-estimate-note">Next item is automatic from your build and inventory. Full CS with cannon growth; updates every 3s.</p>
        <div className="goal-setting"><span className="field-label">CS / min goal</span><div className="stepper"><button aria-label="Decrease CS goal" disabled={settings.csTarget <= 1} onClick={() => saveSettings({ csTarget: Math.max(1, settings.csTarget - .5) })}><Minus size={19}/></button><output aria-label="CS goal">{settings.csTarget.toFixed(1)}</output><button aria-label="Increase CS goal" disabled={settings.csTarget >= 12} onClick={() => saveSettings({ csTarget: Math.min(12, settings.csTarget + .5) })}><Plus size={19}/></button></div></div>
        <div className="slider-setting"><label htmlFor="overlay-opacity">Opacity<strong>{Math.round(settings.opacity * 100)}%</strong></label><input id="overlay-opacity" type="range" min="35" max="100" value={Math.round(settings.opacity * 100)} onChange={event => saveSettings({ opacity: Number(event.target.value) / 100 })}/></div>
        <div className="slider-setting"><label htmlFor="overlay-scale">Size<strong>{Math.round(settings.scale * 100)}%</strong></label><input id="overlay-scale" type="range" min="45" max="140" step="5" value={Math.round(settings.scale * 100)} onChange={event => saveSettings({ scale: Number(event.target.value) / 100 })}/></div>
        <div className="overlay-option-actions"><button className="secondary-button" onClick={() => action('edit')}><Move size={17}/>{state.overlay.editing ? 'Lock position' : 'Move overlay'}</button><button className="icon-button" aria-label="Reset overlay position" onClick={() => action('reset')}><RotateCcw size={18}/></button></div>
      </section></div>
    <div className="overlay-footer-settings"><div className="panel"><div className="setting-row"><span>Open with game</span><Toggle label="Automatically show overlay" checked={settings.autoOverlay} onChange={autoOverlay => saveSettings({ autoOverlay })}/></div><div className="setting-row"><span>Click through</span><Toggle label="Click through overlay" checked={settings.clickThrough} onChange={clickThrough => saveSettings({ clickThrough })}/></div></div><div className="panel shortcut-panel"><div><span>Show / hide</span><kbd>Ctrl + Shift + O</kbd></div><div><span>Move / lock</span><kbd>Ctrl + Shift + L</kbd></div></div></div>
    <OverlayExtrasSettings state={state} catalog={catalog} saveSettings={saveSettings}/>
  </>;
}
