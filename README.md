# DPM.lol

A Windows League companion with player stats, OP.GG builds and runes, and a minimal transparent overlay.

[Download DPM.lol for Windows](https://github.com/Falafel312/Danielsamlauncherxoxo/releases/latest)

## Version 0.3.0

- Account, rank, and match history now use Riot's official public APIs through a separate backend.
- The live overlay uses Riot's documented Live Client Data API; no API key is needed for the overlay.
- Removed League Client API calls, lockfile access, process discovery, rune import, and champion-select integration. The app does not read game memory.
- Added Riot ID, server, and backend settings with retry handling and cached stats during temporary outages.
- Kept the compact graphite design, OP.GG builds and editable rune presets, automatic next item, CS/min number or graph, vision, CS goal, and waves to item.

## Install

Download **DPM.lol-Setup-0.3.0.exe** from Releases. Open League and use Borderless or Windowed display mode for the overlay.

**Account stats need setup after upgrading:** start the included [Riot backend](server/README.md) with your own API key, then connect your Riot ID in Settings. The release includes a small backend ZIP with no npm dependencies. There is no key or hosted service bundled into the desktop app. The overlay continues to work without account setup.

The installed app downloads updates automatically. The portable **DPM.lol.exe** is also available, but does not update itself. Existing installations retain their update identity and saved preferences.

| Shortcut | Action |
| --- | --- |
| Ctrl + Shift + O | Show or hide overlay |
| Ctrl + Shift + L | Unlock or lock position |
| Ctrl + K | Search champions |

**The next item is automatic.** The overlay loads OP.GG for your current champion and detected role, skips completed items (including upgrades), and favors items whose components you already own. It follows the core build, places boots after the first core item, then uses popular alternatives to fill out a six-item plan. A completed boot choice is respected. There is no item picker.

**Waves to item** subtracts current gold and owned recipe components, then rounds up the remaining cost to estimated full waves at the current game time. It displays `~N`, `0` when affordable, and a check when the recommended build is complete. Buying an item immediately advances the target on the next live refresh. Live gold and inventory refresh every three seconds, so kills, assists, purchases, and other income recalculate the estimate. The standard Rift model includes cannon gold growth (+1 every 90 seconds), averages cannon frequency, adjusts for mid/late-game wave composition, and assumes every last hit. It does not forecast future passive gold or bonus income, and does not model role modifiers or super minions; all gold already earned is included in your current balance. Non-Rift modes display a dash. Minion rewards/composition are based on [Riot's 26.1 changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/); this is a farming estimate, not a prediction of individual waves.

CS history records samples while DPM.lol is connected to a game; it does not invent earlier samples. Missing vision data displays a dash. Sample data is available only in explicit demo mode and the labeled settings preview.

## Builds and runes

OP.GG requests run in Electron's main process over HTTPS. The app parses server-rendered JSON without executing third-party scripts. Results use Global / Emerald+ data and are cached for six hours. If the provider is unavailable, saved results up to seven days old are labeled **Offline cache**. Provider markup or rune changes can make a build temporarily unavailable; the app shows an error and retry instead of substituting a made-up recommendation.

Rune pages are editable and can be saved locally. Select those runes in League before your game. Riot's public APIs do not support rune import or champion select, so these controls have been removed.

## Development

Node.js 24+ on Windows:

```powershell
npm ci
npm run dev
```

```powershell
npm test
npm run build
npm run test:desktop
npm run dist
```

`npm run dev:web` provides a browser preview with an OP.GG proxy. Account connection and the native overlay require Electron. `npm run refresh:data` refreshes the bundled Riot Data Dragon catalog.

The desktop test uses an isolated profile. It verifies navigation, live build fetching, saved rune edits, overlay settings and window behavior, responsive layouts, and IPC boundaries. It reads the documented Live Client Data API when a game is available and verifies account settings against an isolated HTTP backend fixture. Public Riot requests need a valid key for a live end-to-end check. It never modifies League. Screenshots and reports are saved under ignored `.qa/`.

## Data and updates

Account, rank, and matches use [Riot public APIs](https://developer.riotgames.com/apis). Live game stats use the documented [Live Client Data API](https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api). Champion, item, and rune metadata come from [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). OP.GG remains the build/rune recommendation provider; Riot's public APIs do not supply recommended builds.

Riot API keys stay on your backend and are never included in the desktop binary or preferences, or sent to OP.GG or GitHub. The renderer uses a sandbox, context isolation, a restrictive content security policy, and an allowlisted IPC bridge. Backend failures do not block live polling. See the [setup and deployment guide](server/README.md) for key handling, rate limits, routing, and troubleshooting.

This repository retains its original URL so earlier installations keep receiving updates. Release assets are `DPM.lol-Setup-VERSION.exe`, its `.blockmap`, `DPM.lol.exe`, `latest.yml`, and `DPM.lol-Riot-Backend-VERSION.zip`. Upload the manifest last; it references the installer's SHA-512 checksum. Restarting to install an update is blocked during a game. The current Windows builds are unsigned.

DPM.lol is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
