import { Check, GripHorizontal, X } from 'lucide-react';
import type { Catalog, Live, Settings } from './types';
import { chartPoints, wavesForItem } from './metrics';
import { itemImage } from './data';

export default function OverlayPanel({ live, settings, catalog, editing = false, preview = false, onClose, onLock }: { live: Live | null; settings: Settings; catalog: Catalog; editing?: boolean; preview?: boolean; onClose?(): void; onLock?(): void }) {
  const waves = wavesForItem(live, settings.targetItemId, catalog.items);
  const target = catalog.items[String(settings.targetItemId)];
  const history = live?.csHistory || [];
  const maximum = Math.max(settings.csTarget + 2, ...history.map(point => point.value));
  const goalY = 80 - settings.csTarget / maximum * 72;
  const deficit = live ? Math.round(live.cs - settings.csTarget * live.time / 60) : 0;
  const hasWidgets = Object.values(settings.widgets).some(Boolean);
  return <div className={`overlay-panel ${editing ? 'editing' : ''}`} style={{ '--overlay-opacity': settings.opacity } as React.CSSProperties}>
    {editing && <div className="overlay-drag"><GripHorizontal size={18} aria-hidden="true"/><span>Move overlay</span><button aria-label="Lock overlay" onClick={onLock}><Check size={18}/></button><button aria-label="Hide overlay" onClick={onClose}><X size={18}/></button></div>}
    {preview && <span className="overlay-preview-tag">Preview</span>}
    {settings.widgets.cs && <div className="hud-cs"><div className="hud-value-row"><div><span className="hud-label">CS / min</span><strong>{live ? live.csPerMin.toFixed(1) : '—'}</strong></div><span className="hud-total">{live ? `${live.cs} CS` : 'Waiting for game'}</span></div>
      {settings.csDisplay === 'graph' && <div className="hud-chart"><svg viewBox="0 0 320 80" role="img" aria-label={`CS per minute over time. Goal ${settings.csTarget}.`}><line x1="0" x2="320" y1={goalY} y2={goalY} className="chart-goal"/>{history.length > 1 && <polyline points={chartPoints(history.map(point => point.value), 320, 80, maximum)} className="chart-line"/>}{history.length === 1 && <circle cx="160" cy={80 - history[0].value / maximum * 72} r="3" className="chart-point"/>}</svg><div className="hud-chart-axis"><span>{history.length ? `${Math.floor(history[0].time / 60)}m` : '0m'}</span><span>{live ? `${Math.floor(live.time / 60)}m` : '—'}</span></div></div>}
    </div>}
    <div className="hud-secondary">
      {settings.widgets.vision && <div className="hud-metric" title={live?.vision == null ? 'Vision score is unavailable from the game client.' : undefined}><span className="hud-label">Vision</span><strong>{live?.vision == null ? '—' : Math.floor(live.vision)}</strong></div>}
      {settings.widgets.waves && <div className="hud-metric hud-waves" title={waves?.owned ? 'Item owned' : waves?.count === 0 ? 'Ready to buy' : 'Estimated full waves on standard Rift. Cannons averaged; future passive and bonus gold excluded.'}><span className="hud-label">Waves to item</span><div><strong>{waves ? waves.owned ? '✓' : waves.count === 0 ? '0' : `~${waves.count}` : '—'}</strong>{target && <img src={itemImage(settings.targetItemId, catalog.version)} alt={target.name} title={`${target.name}${waves?.owned ? ' · Owned' : ''}`}/>}</div></div>}
    </div>
    {settings.widgets.goal && <div className="hud-goal"><div><span className="hud-label">CS goal</span><strong>{settings.csTarget.toFixed(1)}<small> / min</small></strong></div><span className={`hud-goal-delta ${deficit >= 0 ? 'positive' : ''}`}>{live ? `${deficit > 0 ? '+' : ''}${deficit} CS` : '—'}</span><div className="hud-progress"><i style={{ width: `${Math.min(100, (live?.csPerMin || 0) / settings.csTarget * 100)}%` }}/></div></div>}
    {!hasWidgets && <div className="hud-empty">All widgets hidden</div>}
  </div>;
}
