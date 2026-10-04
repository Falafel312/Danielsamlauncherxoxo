# DPM.lol

A Windows League companion with player stats, OP.GG builds and runes, and a minimal transparent overlay.

[Download DPM.lol for Windows](https://github.com/Falafel312/Danielsamlauncherxoxo/releases/latest)

## Version 0.2.0

- DPM.lol branding throughout the app, window titles, launcher, and installer.
- Player stats replace the champion spotlight: win rate, KDA, CS/min trend, vision, and rank.
- Compact graphite panels, subtle highlights and shadows, translucent surfaces, and large readable numbers.
- Four independent overlay widgets: **CS/min**, **vision score**, **waves to item**, and **CS/min goal**.
- CS/min supports **Number** and **Graph + number** modes. Opacity, size, target item, and CS goal are configurable.
- The overlay has no champion banner or logo. Its move controls appear only when unlocked.
- Builds and rune presets load from [OP.GG](https://op.gg/lol/champions), with champion and role selection, source links, patch, and fetch time.

## Install

Download **DPM.lol-Setup-0.2.0.exe** from Releases. Open League and use Borderless or Windowed display mode for the overlay.

The installed app downloads updates automatically. The portable **DPM.lol.exe** is also available, but does not update itself. Existing installations retain their update identity and saved preferences.

| Shortcut | Action |
| --- | --- |
| Ctrl + Shift + O | Show or hide overlay |
| Ctrl + Shift + L | Unlock or lock position |
| Ctrl + K | Search champions |

Choose an item in **Overlay**, or click **Track item** in a build. **Waves to item** subtracts current gold and owned recipe components, then rounds up the remaining cost to estimated full waves at the current game time. It displays `~N`, `0` when affordable, or a check when owned. Live gold and inventory refresh every three seconds, so kills, assists, purchases, and other income recalculate the estimate. The standard Rift model includes cannon gold growth (+1 every 90 seconds), averages cannon frequency, adjusts for mid/late-game wave composition, and assumes every last hit. It excludes passive gold, role bonuses/penalties, super minions, and other income. Non-Rift modes display a dash. Minion rewards/composition are based on [Riot's 26.1 changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/); this is a farming estimate, not a prediction of individual waves.

CS history records samples while DPM.lol is connected to a game; it does not invent earlier samples. Missing vision data displays a dash. Sample data is available only in explicit demo mode and the labeled settings preview.

## Builds and runes

OP.GG requests run in Electron's main process over HTTPS. The app parses server-rendered JSON without executing third-party scripts. Results use Global / Emerald+ data and are cached for six hours. If the provider is unavailable, saved results up to seven days old are labeled **Offline cache**. Provider markup or rune changes can make a build temporarily unavailable; the app shows an error and retry instead of substituting a made-up recommendation.

Rune pages are editable and can be saved locally. Import creates or updates **DPM.lol • Champion**, reusing the earlier **Rift • Champion** page when present. Other rune pages stay intact. A first import needs a free editable slot. Imports are blocked during active games.

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

`npm run dev:web` provides a browser preview with an OP.GG proxy. League access, rune import, and the native overlay require Electron. `npm run refresh:data` refreshes the bundled Riot Data Dragon catalog.

The desktop test uses an isolated profile. It verifies navigation, live build fetching, saved rune edits, overlay settings and window behavior, responsive layouts, and IPC boundaries. It reads the current League connection when one is available, but never imports a rune page or modifies League. Screenshots and reports are saved under ignored `.qa/`.

## Data and updates

Account, rank, matches, and current game stats come from the local League client. Champion, item, and rune metadata come from [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). Local League APIs and third-party build markup can change.

League credentials remain in Electron's main process, are never persisted, and are never sent to OP.GG or GitHub. The renderer uses a sandbox, context isolation, a restrictive content security policy, and an allowlisted IPC bridge.

This repository retains its original URL so earlier installations keep receiving updates. Release assets are `DPM.lol-Setup-VERSION.exe`, its `.blockmap`, `DPM.lol.exe`, and `latest.yml`. Upload the manifest last; it references the installer's SHA-512 checksum. Restarting to install an update is blocked during a game. The current Windows builds are unsigned.

DPM.lol is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
