export interface Champion { id: string; key: string; name: string; title: string; tags: string[]; blurb: string; info: { attack: number; defense: number; magic: number; difficulty: number }; stats: { hp: number; attackdamage: number; armor: number; movespeed: number }; }
export interface Item { name: string; description: string; plaintext: string; gold: { total: number; purchasable?: boolean }; tags?: string[]; from?: string[]; into?: string[]; maps: Record<string, boolean>; }
export interface Rune { id: number; key: string; name: string; icon: string; shortDesc: string; longDesc: string; }
export interface RunePath { id: number; key: string; name: string; icon: string; slots: { runes: Rune[] }[]; }
export interface RunePage { champion: string; primaryStyleId: number; subStyleId: number; selectedPerkIds: number[]; }
export interface Match { id: string; championKey: string; win: boolean; kills: number; deaths: number; assists: number; cs: number; duration: number; timestamp: number; queueId: number; damage: number; gold: number; vision: number | null; items: number[]; }
export interface Enemy { championId: string; championName: string; cs: number | null; items: { id: number; count: number }[] | null; role: string; }
export interface ReminderSettings { enabled: boolean; healthEnabled: boolean; healthThreshold: number; manaEnabled: boolean; manaThreshold: number; dragonEnabled: boolean; dragonLead: number; dragonMode: 'standard' | 'swiftplay'; duration: number; cooldown: number; repeatLow: boolean; x: number; y: number; scale: number; }
export interface ScoreboardSettings { enabled: boolean; x: number; y: number; scale: number; rowHeight: number; }
export interface Reminder { id: string; kind: 'health' | 'mana' | 'dragon'; title: string; detail: string; at?: number; expiresAt: number; }
export interface Live { isDead?: boolean; mana?: number | null; maxMana?: number | null; resourceType?: string; enemies?: Enemy[]; eventsAvailable?: boolean; dragonKills?: { time: number; type: string; team: string }[]; time: number; championName: string; championId: string; name: string; level: number; kills: number; deaths: number; assists: number; cs: number; csPerMin: number; vision: number | null; csHistory: { time: number; value: number }[]; gold: number; items: { id: number; name: string; count: number }[]; health: number; maxHealth: number; attackDamage: number; abilityPower: number; gameMode: string; mapNumber?: number | null; role?: string; }
export interface Settings { autoOverlay: boolean; clickThrough: boolean; opacity: number; scale: number; csTarget: number; csDisplay: 'number' | 'graph'; autoDownloadUpdates: boolean; updateUrl: string; reminders: ReminderSettings; scoreboard: ScoreboardSettings; widgets: { cs: boolean; vision: boolean; waves: boolean }; }
export interface Build { champion: string; role: string; source: string; sourceUrl: string; patch: string | null; fetchedAt: string; stale: boolean; start: number[]; core: number[]; boots: number[]; alternatives: number[]; runes: RunePage; }
export interface RiotAccount { serverUrl: string; riotId: string; platform: string; }
export interface AppState {
  connection: string; phase: string;
  summoner: { name: string; tag: string; level: number; icon: number;  } | null;
  ranked: { tier: string; division: string; leaguePoints: number; wins: number; losses: number } | null;
  matches: Match[]; account: RiotAccount;
  profile: { status: 'unconfigured' | 'idle' | 'loading' | 'connected' | 'partial' | 'error'; message: string; lastUpdated: string | null };
  companion: { focused: boolean; tab: boolean; error: string; alerts: Reminder[]; previewUntil: number; previewKind: Reminder['kind'] | 'scoreboard' | null };
  live: Live | null; settings: Settings; overlay: { visible: boolean; editing: boolean };
  shortcuts: { toggle: boolean; edit: boolean }; lastUpdated: string | null;
  updates: { version: string; status: string; availableVersion: string | null; progress: number; lastCheck: string | null; message: string };
}
export interface Catalog { champions: Champion[]; items: Record<string, Item>; runes: RunePath[]; version: string; }
export type Page = 'overview' | 'champions' | 'builds' | 'history' | 'live' | 'overlay' | 'settings';
declare global {
  interface Window {
    rift?: {
      getState(): Promise<AppState>; refresh(): Promise<AppState>;
      saveSettings(input: Partial<Settings>): Promise<Settings>;
      configureAccount(input: RiotAccount): Promise<{ ok: boolean; message: string }>;
      getBuild(champion: string, role?: string, refresh?: boolean): Promise<Build>;
      updates(action: 'configure' | 'check' | 'install', url?: string): Promise<{ ok: boolean; message: string }>;
      previewReminder(kind: 'health' | 'mana' | 'dragon' | 'scoreboard'): Promise<void>;
      overlay(action: 'show' | 'hide' | 'toggle' | 'edit' | 'reset'): Promise<AppState['overlay']>;
      window(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
      onState(callback: (state: AppState) => void): () => void;
    };
  }
}
