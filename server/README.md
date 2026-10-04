# DPM.lol Riot backend

The desktop overlay works without this server or an API key. Account level, rank, and match history require this backend with your own Riot API key. There is no shared key or hosted backend included in the release.

## Local setup on Windows

1. Install Node.js 24 or newer. Download and extract **DPM.lol-Riot-Backend-0.4.0.zip** from [Releases](https://github.com/Falafel312/Danielsamlauncherxoxo/releases/latest), or use this repository.
2. From the extracted `DPM.lol-Riot-Backend` folder (or the repository root), run:

   ```powershell
   Copy-Item server/.env.example server/.env
   notepad server/.env
   ```

3. Put your key from the [Riot Developer Portal](https://developer.riotgames.com/) after `RIOT_API_KEY=` in that file. Save it. Keep the key on your own machine; do not paste it into chat, the desktop settings, GitHub, or screenshots.
4. Start the backend from the same folder:

   ```powershell
   npm run api
   ```

   No dependency installation is needed for the backend. Leave this terminal running. Stop it with Ctrl+C. Restart it after changing the key.
5. Open DPM.lol → **Settings**. Enter your **Riot ID** (`Name#TAG`) and choose your **League server**, then click **Connect account**. The default backend URL is `http://127.0.0.1:4317`.

Development keys expire after 24 hours. If the app reports a rejected key, replace it in `server/.env` and restart the server. See [Riot's key types](https://developer.riotgames.com/docs/portal#web-apis_api-keys) for personal and production access. A public service requires the appropriate Riot approval and production key.

## Hosted backend

Run `server/index.cjs` on a Node.js 24+ server with `RIOT_API_KEY` supplied through your hosting provider's secret environment. `HOST` defaults to `127.0.0.1` and `PORT` to `4317`. Behind a local HTTPS reverse proxy, keep the loopback binding. For containers, explicitly set `HOST=0.0.0.0` and restrict the exposed port to the proxy.

Set the desktop **Backend connection → Backend URL** to the HTTPS origin (or proxy path prefix). TLS verification remains enabled for remote backends. HTTP is accepted only for loopback addresses. Apply access controls and per-client request limits at your hosting boundary before exposing a production service; this small backend does not implement user authentication or Riot Sign On. RSO requires separate Riot approval.

The desktop sends the selected Riot ID and server to your backend. Browser-origin requests are rejected; there is no browser CORS endpoint. The backend provides only:

- `GET /health`: service name and whether a key is configured, never the key.
- `GET /v1/profile?riotId=Name%23TAG&platform=euw1`: normalized account, solo rank, and up to 20 recent public matches for that player.

## Data handling

The backend uses [ACCOUNT-V1, SUMMONER-V4, LEAGUE-V4 and MATCH-V5](https://developer.riotgames.com/apis). Lookups use PUUIDs and current platform/regional routing. SEA match data uses the SEA cluster; ACCOUNT-V1 uses ASIA for SEA accounts. Only the selected player's stats are returned. Custom games are excluded.

Keys travel only in the `X-Riot-Token` header to fixed official Riot HTTPS endpoints. Response bodies and upstream errors never expose the key. Profiles cache for one minute and match details for one day, in bounded server memory; simultaneous identical requests are deduplicated. Upstream requests are paced and capped at 100 per two minutes, and Riot `Retry-After` pauses further requests. This conservative budget suits personal use; a multi-instance production deployment needs a shared rate limiter and cache.

The desktop refreshes account data every five minutes and after a game ends. Manual refresh is available, with error backoff. When a refresh fails, the app keeps previously loaded stats and shows the last successful update time in Settings. Restarting the backend clears its cache. Restarting the desktop fetches fresh account data rather than saving match history to disk.

Live CS/min, vision, current gold, inventory, and waves to item come directly from the documented [Live Client Data API](https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api) on loopback HTTPS port 2999 every three seconds. This runs separately from backend requests, requires no API key, and accepts the game's self-signed certificate only on that fixed endpoint. Rune import, champion select, installation-folder discovery, and process inspection are absent.

## Troubleshooting

- **Could not reach your Riot backend:** start `npm run api`; confirm the URL and port. `http://127.0.0.1:4317/health` should return JSON.
- **KEY_MISSING / rejected key:** set or renew `RIOT_API_KEY`, then restart the backend.
- **Account not found:** verify the full Riot ID and the account's League server.
- **Riot requests are paused:** leave the app open; it retries after the reported rate-limit delay.
- **Some recent matches could not load:** Riot may be missing a match or temporarily unavailable. The app retains available matches and retries.
- **No live overlay stats:** start a match or Practice Tool. Use Borderless or Windowed display mode. Account setup is not required for live data.

Never commit `.env`. The backend release archive is generated from an explicit file allowlist and includes only an empty `.env.example`.
