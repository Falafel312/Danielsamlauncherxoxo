import { useState } from 'react';
import { Bell, Table2 } from 'lucide-react';
import type { AppState, Catalog, Reminder, ReminderSettings, ScoreboardSettings, Settings } from './types';
import { demoState } from './data';
import { Toggle } from './components';
import { ReminderCard, sampleReminder, ScoreboardComparison } from './CompanionOverlay';

function Slider({ id, label, value, min, max, step = 1, unit = '', onChange }: { id: string; label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange(value: number): void }) {
  return <div className="slider-setting"><label htmlFor={id}>{label}<strong>{value}{unit}</strong></label><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/></div>;
}
export default function OverlayExtrasSettings({ state, catalog, saveSettings }: { state: AppState; catalog: Catalog; saveSettings(input: Partial<Settings>): Promise<void> }) {
  const r = state.settings.reminders, s = state.settings.scoreboard;
  const [example, setExample] = useState<Reminder['kind']>('dragon');
  const [error, setError] = useState('');
  const reminders = (input: Partial<ReminderSettings>) => saveSettings({ reminders: { ...r, ...input } });
  const scoreboard = (input: Partial<ScoreboardSettings>) => saveSettings({ scoreboard: { ...s, ...input } });
  async function preview(kind: Reminder['kind'] | 'scoreboard') {
    setError('');
    if (kind !== 'scoreboard') setExample(kind);
    if (!window.rift) { setError('Open the Windows app to preview over your game.'); return; }
    try { await window.rift.previewReminder(kind); } catch { setError('The preview could not open. Try restarting the app.'); }
  }
  return <>
    <div className="overlay-extras-grid">
      <section className="panel extras-settings"><div className="section-heading"><h2><Bell size={17} aria-hidden="true"/>Reminders</h2><Toggle label="Enable reminders" checked={r.enabled} onChange={enabled => reminders({ enabled })}/></div>
        <div className="reminder-example"><ReminderCard alert={sampleReminder(example, state)} preview/></div>
        <div className="reminder-rule"><div className="setting-row"><span>Drake spawn</span><Toggle label="Drake reminder" checked={r.dragonEnabled} onChange={dragonEnabled => reminders({ dragonEnabled })}/></div><Slider id="dragon-lead" label="Before spawn" value={r.dragonLead} min={5} max={120} step={5} unit="s" onChange={dragonLead => reminders({ dragonLead })}/><label className="mode-field" htmlFor="dragon-mode">Game mode<select id="dragon-mode" value={r.dragonMode} onChange={event => reminders({ dragonMode: event.target.value as ReminderSettings['dragonMode'] })}><option value="standard">Standard Rift</option><option value="swiftplay">Swiftplay</option></select></label></div>
        <div className="reminder-rule"><div className="setting-row"><span>Low health</span><Toggle label="Low health reminder" checked={r.healthEnabled} onChange={healthEnabled => reminders({ healthEnabled })}/></div><Slider id="health-threshold" label="At or below" value={r.healthThreshold} min={5} max={80} unit="%" onChange={healthThreshold => reminders({ healthThreshold })}/></div>
        <div className="reminder-rule"><div className="setting-row"><span>Low mana</span><Toggle label="Low mana reminder" checked={r.manaEnabled} onChange={manaEnabled => reminders({ manaEnabled })}/></div><Slider id="mana-threshold" label="At or below" value={r.manaThreshold} min={5} max={80} unit="%" onChange={manaThreshold => reminders({ manaThreshold })}/></div>
        <details className="extras-details"><summary>Position & timing</summary><div className="extras-controls"><Slider id="reminder-x" label="Horizontal position" value={r.x} min={5} max={95} unit="%" onChange={x => reminders({ x })}/><Slider id="reminder-y" label="Vertical position" value={r.y} min={5} max={90} unit="%" onChange={y => reminders({ y })}/><Slider id="reminder-scale" label="Popup size" value={Math.round(r.scale * 100)} min={60} max={140} step={5} unit="%" onChange={scale => reminders({ scale: scale / 100 })}/><Slider id="reminder-duration" label="Show for" value={r.duration} min={2} max={15} unit="s" onChange={duration => reminders({ duration })}/><Slider id="reminder-cooldown" label="Minimum time between health / mana alerts" value={r.cooldown} min={10} max={300} step={5} unit="s" onChange={cooldown => reminders({ cooldown })}/><div className="setting-row"><span>Repeat while still low</span><Toggle label="Repeat low health and mana alerts" checked={r.repeatLow} onChange={repeatLow => reminders({ repeatLow })}/></div></div></details>
        <div className="extras-test-buttons" aria-label="Test reminders">{(['dragon', 'health', 'mana'] as const).map(kind => <button className="secondary-button" key={kind} onClick={() => preview(kind)}>Test {kind === 'dragon' ? 'drake' : kind}</button>)}</div>
      </section>
      <section className="panel extras-settings"><div className="section-heading"><h2><Table2 size={17} aria-hidden="true"/>Scoreboard</h2><Toggle label="Enable Tab comparison" checked={s.enabled} onChange={enabled => scoreboard({ enabled })}/></div>
        <p className="extras-note">Hold <kbd>Tab</kbd> in game. Positive values mean the enemy is ahead of you.</p>
        <div className="comparison-example"><ScoreboardComparison live={demoState.live!} catalog={catalog} settings={s} preview/></div>
        <p className="extras-note">Item value and CS are compared separately. This is current inventory value, not total gold earned.</p>
        <details className="extras-details"><summary>Position & size</summary><div className="extras-controls"><Slider id="scoreboard-x" label="Horizontal position" value={s.x} min={5} max={95} unit="%" onChange={x => scoreboard({ x })}/><Slider id="scoreboard-y" label="Vertical position" value={s.y} min={5} max={80} unit="%" onChange={y => scoreboard({ y })}/><Slider id="scoreboard-scale" label="Comparison size" value={Math.round(s.scale * 100)} min={60} max={140} step={5} unit="%" onChange={scale => scoreboard({ scale: scale / 100 })}/><Slider id="scoreboard-row-height" label="Row spacing" value={s.rowHeight} min={30} max={80} unit="px" onChange={rowHeight => scoreboard({ rowHeight })}/></div></details>
        <p className="extras-note">Rows follow top, jungle, mid, bottom, support. Place beside the enemy side of your scoreboard.</p>
        <button className="secondary-button" onClick={() => preview('scoreboard')}>Preview placement</button>
      </section>
    </div>
    {(error || state.companion.error) && <p className="extras-error" role="status">{error || state.companion.error}</p>}
  </>;
}
