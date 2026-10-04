import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { AppState } from './types';
import { SectionHeading } from './components';

const regions = [['euw1', 'Europe West'], ['eun1', 'Europe Nordic & East'], ['na1', 'North America'], ['br1', 'Brazil'], ['la1', 'Latin America North'], ['la2', 'Latin America South'], ['kr', 'Korea'], ['jp1', 'Japan'], ['oc1', 'Oceania'], ['tr1', 'Türkiye'], ['ru', 'Russia'], ['me1', 'Middle East'], ['sg2', 'Southeast Asia'], ['tw2', 'Taiwan'], ['vn2', 'Vietnam']];

export default function RiotAccount({ state, onToast }: { state: AppState; onToast(message: string): void }) {
  const [account, setAccount] = useState(state.account);
  const [saving, setSaving] = useState(false);
  useEffect(() => setAccount(state.account), [state.account.serverUrl, state.account.riotId, state.account.platform]);
  const loading = saving || state.profile.status === 'loading';
  const connect = async (disconnect = false) => {
    if (!window.rift) { onToast('Connect your Riot account in the Windows desktop app.'); return; }
    setSaving(true);
    try { const result = await window.rift.configureAccount({ ...account, riotId: disconnect ? '' : account.riotId }); onToast(result.message); }
    catch { onToast('The account connection could not be saved.'); }
    finally { setSaving(false); }
  };
  const label = { unconfigured: 'Connect your account', idle: 'Ready to connect', loading: 'Loading Riot stats…', connected: 'Connected to Riot', partial: 'Some matches are unavailable', error: 'Connection needs attention' }[state.profile.status];
  return <section className="riot-account">
    <SectionHeading title="Riot account"/>
    <form onSubmit={event => { event.preventDefault(); connect(); }}>
      <div className="account-fields"><label><span className="field-label">Riot ID</span><input aria-label="Riot ID" autoComplete="off" placeholder="Name#TAG" maxLength={100} required value={account.riotId} onChange={event => setAccount({ ...account, riotId: event.target.value })}/></label><label><span className="field-label">Server</span><select aria-label="League server" value={account.platform} onChange={event => setAccount({ ...account, platform: event.target.value })}>{regions.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></div>
      <details className="account-backend"><summary>Backend connection</summary><label><span className="field-label">Backend URL</span><input aria-label="Riot backend URL" type="url" required value={account.serverUrl} onChange={event => setAccount({ ...account, serverUrl: event.target.value })}/></label><p>Your Riot API key stays on the backend. <a href="https://github.com/Falafel312/Danielsamlauncherxoxo/blob/main/server/README.md" target="_blank" rel="noreferrer">Setup guide <ExternalLink size={11}/></a></p></details>
      <div className={`account-status ${state.profile.status}`} role="status"><strong>{label}</strong>{state.profile.message && <p>{state.profile.message}</p>}{state.profile.lastUpdated && <small>Stats updated {new Date(state.profile.lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>}</div>
      <div className="settings-buttons"><button className="primary-button" disabled={loading} type="submit">{loading && <RefreshCw size={14} className="spin"/>}{loading ? 'Connecting…' : 'Connect account'}</button>{state.account.riotId && <button className="secondary-button" type="button" onClick={() => connect(true)} disabled={saving}>Disconnect</button>}</div>
    </form>
    <p className="setting-description">The live overlay works automatically during a game, with or without an account connection.</p>
  </section>;
}
