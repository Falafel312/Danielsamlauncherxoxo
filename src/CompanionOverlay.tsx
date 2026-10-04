import { Droplet, Flame, Heart } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { AppState, Catalog, Live, Reminder, ScoreboardSettings } from './types';
import { demoState, portrait } from './data';
import { enemyComparisons } from './metrics';

export function sampleReminder(kind: Reminder['kind'], state: AppState): Reminder {
  const settings = state.settings.reminders;
  return { id: `preview-${kind}`, kind, title: kind === 'dragon' ? 'Drake soon' : `Low ${kind}`,
    detail: kind === 'dragon' ? `${settings.dragonLead}s to spawn` : `${kind === 'health' ? settings.healthThreshold : settings.manaThreshold}% remaining`, expiresAt: Date.now() + 15000 };
}
export function ReminderCard({ alert, preview = false, time }: { alert: Reminder; preview?: boolean; time?: number }) {
  const Icon = { health: Heart, mana: Droplet, dragon: Flame }[alert.kind];
  const detail = alert.at != null && time != null ? `${Math.max(0, Math.ceil(alert.at - time))}s to spawn` : alert.detail;
  return <div className={`reminder-card ${alert.kind}`} role="status"><Icon size={23} aria-hidden="true"/><div><strong>{alert.title}</strong><span>{detail}</span></div>{preview && <small>Preview</small>}</div>;
}
const signed = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString()}`;
export function ScoreboardComparison({ live, catalog, settings, preview = false }: { live: Live; catalog: Catalog; settings: ScoreboardSettings; preview?: boolean }) {
  const rows = enemyComparisons(live, catalog.items);
  return <div className="scoreboard-comparison" style={{ '--score-row-height': `${settings.rowHeight}px` } as CSSProperties}>
    <div className="scoreboard-labels"><span>{preview ? 'Preview' : 'vs you'}</span><span>Item value Δ</span><span>CS Δ</span></div>
    {rows.map((enemy, index) => <div className="scoreboard-row" key={`${enemy.championId}-${index}`}>
      <img src={portrait(enemy.championId, catalog.version)} alt={enemy.championName} title={enemy.championName}/>
      <strong className={enemy.itemDelta == null ? '' : enemy.itemDelta > 0 ? 'enemy-ahead' : 'enemy-behind'}>{signed(enemy.itemDelta)}<small>g</small></strong><span>{signed(enemy.csDelta)}</span>
    </div>)}
    {!rows.length && <p className="comparison-empty">Waiting for enemy stats</p>}
  </div>;
}
function placement(x: number, y: number, scale: number, width: number, height: number): CSSProperties {
  const half = width * scale / 2 + 12;
  return { left: `clamp(${half}px, ${x}%, calc(100% - ${half}px))`, top: `clamp(12px, ${y}%, calc(100% - ${height * scale + 12}px))`, transform: `translateX(-50%) scale(${scale})` };
}
export default function CompanionOverlay({ state, catalog }: { state: AppState; catalog: Catalog }) {
  const preview = state.companion.previewUntil > Date.now() ? state.companion.previewKind : null;
  const active = state.overlay.visible && state.companion.focused && !!state.live;
  const r = state.settings.reminders, s = state.settings.scoreboard;
  const alerts = preview && preview !== 'scoreboard' ? [sampleReminder(preview, state)] : active ? state.companion.alerts : [];
  const showScoreboard = preview === 'scoreboard' || (active && state.companion.tab && s.enabled);
  return <div className="companion-layer" style={{ '--overlay-opacity': state.settings.opacity } as CSSProperties}>
    {alerts.length > 0 && <div className="reminder-stack" style={placement(r.x, r.y, r.scale, 292, alerts.length * 82)}>{alerts.map(alert => <ReminderCard key={alert.id} alert={alert} time={preview ? undefined : state.live?.time} preview={!!preview}/>)}</div>}
    {showScoreboard && (state.live || preview) && <div className="scoreboard-anchor" style={placement(s.x, s.y, s.scale, 250, 30 + (preview ? 5 : state.live?.enemies?.length || 0) * s.rowHeight)}><ScoreboardComparison live={preview === 'scoreboard' ? demoState.live! : state.live!} catalog={catalog} settings={s} preview={preview === 'scoreboard'}/></div>}
  </div>;
}
