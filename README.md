# DPM.lol

A Windows League companion with player stats, OP.GG builds and runes, and a minimal transparent overlay.

[Download DPM.lol for Windows](https://github.com/Falafel312/Danielsamlauncherxoxo/releases/latest)

## Version 0.4.0

- Shrink the HUD to 45% and show CS/min with its goal in one number, such as `5.4 / 10`.
- Hold Tab for an enemy inventory-value difference and separate CS difference against you.
- Configure drake, low-health, and low-mana popups: thresholds, lead time, duration, repeat cooldown, position, and size.
- Keep Riot's documented live API, automatic next-item tracking, vision score, and waves to item. No game-memory access, injection, or League Client API calls.

## Install

Download **DPM.lol-Setup-0.4.0.exe** from Releases. Open League and use Borderless or Windowed display mode for the overlay.

**Account stats need setup after upgrading:** start the included [Riot backend](server/README.md) with your own API key, then connect your Riot ID in Settings. The release includes a small backend ZIP with no npm dependencies. There is no key or hosted service bundled into the desktop app. The overlay continues to work without account setup.

The installed app downloads updates automatically. The portable **DPM.lol.exe** is also available, but does not update itself. Existing installations retain their update identity and saved preferences.

| Shortcut | Action |
| --- | --- |
| Ctrl + Shift + O | Show or hide overlay |
| Ctrl + Shift + L | Unlock or lock position |
| Hold Tab in game | Enemy item-value and CS comparison |
| Ctrl + K | Search champions |

**The next item is automatic.** The overlay loads OP.GG for your current champion and detected role, skips completed items (including upgrades), and favors items whose components you already own. It follows the core build, places boots after the first core item, then uses popular alternatives to fill out a six-item plan. A completed boot choice is respected. There is no item picker.

**Waves to item** subtracts current gold and owned recipe components, then rounds up the remaining cost to estimated full waves at the current game time. It displays `~N`, `0` when affordable, and a check when the recommended build is complete. Buying an item immediately advances the target on the next live refresh. Live gold and inventory refresh every three seconds, so kills, assists, purchases, and other income recalculate the estimate. The standard Rift model includes cannon gold growth (+1 every 90 seconds), averages cannon frequency, adjusts for mid/late-game wave composition, and assumes every last hit. It does not forecast future passive gold or bonus income, and does not model role modifiers or super minions; all gold already earned is included in your current balance. Non-Rift modes display a dash. Minion rewards/composition are based on [Riot's 26.1 changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/); this is a farming estimate, not a prediction of individual waves.

CS history records samples while DPM.lol is connected to a game; it does not invent earlier samples. Missing vision data displays a dash. Sample data is available only in explicit demo mode and the labeled settings preview.

## Reminders and scoreboard

Open **Overlay** and scroll to **Reminders** and **Scoreboard**. The HUD size can be 45–140%; popup and comparison sizes are independent. Use **Position & timing** or **Position & size** to place them, then the test/preview buttons to check their native placement. All previews are labeled and expire automatically. The main overlay must be enabled for live reminders and Tab comparisons.

Drake reminders default to 30 seconds before spawn. **Standard Rift** uses the first spawn at 5:00, five minutes after an observed elemental kill, and six minutes for Elder after soul or an Elder kill. Select **Swiftplay** for its two-elemental-drake limit and fixed first Elder at 15:00. The documented live API does not identify that queue reliably. Timers use observed public DragonKill events; they do not invent kills or repeat an already-spawned objective. Unsupported maps or unresolved soul ownership suppress the timer. Timing sources: [Riot's elemental/Elder rules](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-23-notes/) and [Swiftplay 26.1 changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).

Health defaults to 25%, mana to 20%, popup duration to five seconds, and cooldown to 45 seconds. Alerts use your own health and mana, are suppressed while dead, and ignore non-mana resources. They re-arm after recovery; repeated alerts while still low are opt-in. Live data refreshes every three seconds, so these are periodic reminders rather than frame-accurate alarms.

While League is focused, holding Tab displays five enemy portraits with **Item value Δ** and **CS Δ**. Positive means the enemy has more than you. Inventory value uses the full catalog value of currently held items and item stacks. It does not add CS income to purchased items, count consumed or sold items, estimate unseen current gold, or claim exact total gold earned. Missing item metadata shows a dash. Rows follow top/jungle/mid/bottom/support when roles are available; automatic tracking of manual scoreboard rearrangement is not supported. Use the position and row-spacing settings to align the comparison beside your scoreboard.

The Windows helper observes only Tab, the foreground window title, and window geometry through user32. It never intercepts keys, opens the game process, reads memory, or injects an overlay. The comparison and reminder windows are non-focusing and click-through, and hide when League loses focus. Live map coordinates and visibility are not exposed by Riot's documented API; there is no position, enemy last-seen, or overextension tracker.

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

The desktop test uses an isolated profile. It verifies navigation, live build fetching, saved rune edits, overlay settings and window behavior, responsive layouts, and IPC boundaries. It checks the 45% HUD, combined CS/goal, native reminder placement and expiry, and scoreboard preview. Unit tests cover the Windows helper, Tab/focus gating, dragon rules, alert cooldowns, enemy normalization, and item comparisons. It reads the documented Live Client Data API when a game is available and verifies account settings against an isolated HTTP backend fixture. No game was running during 0.4.0 validation, so new in-match triggers were checked with fixtures. Public Riot requests need a valid key for a live end-to-end check. Tests never modify League. Screenshots and reports are saved under ignored `.qa/`.

## Data and updates

Account, rank, and matches use [Riot public APIs](https://developer.riotgames.com/apis). Live game stats use the documented [Live Client Data API](https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api). Champion, item, and rune metadata come from [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). OP.GG remains the build/rune recommendation provider; Riot's public APIs do not supply recommended builds.

Riot API keys stay on your backend and are never included in the desktop binary or preferences, or sent to OP.GG or GitHub. The renderer uses a sandbox, context isolation, a restrictive content security policy, and an allowlisted IPC bridge. Backend failures do not block live polling. See the [setup and deployment guide](server/README.md) for key handling, rate limits, routing, and troubleshooting.

This repository retains its original URL so earlier installations keep receiving updates. Release assets are `DPM.lol-Setup-VERSION.exe`, its `.blockmap`, `DPM.lol.exe`, `latest.yml`, and `DPM.lol-Riot-Backend-VERSION.zip`. Upload the manifest last; it references the installer's SHA-512 checksum. Restarting to install an update is blocked during a game. The current Windows builds are unsigned.

DPM.lol is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
