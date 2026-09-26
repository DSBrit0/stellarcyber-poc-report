# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React SPA that generates a branded PDF POC (Proof of Concept) report from a live Stellar Cyber instance. An SE logs in to the customer's instance, sets the POC period, fills in POC metadata, and downloads the PDF. The whole app lives in `stellar-dashboard/`. There is no database and no server-side state: all logic runs in the browser, and the Express server only serves the build and proxies API calls.

The only screens in the sidebar are **Report** (`/report`) and **Settings** (`/settings`). `Dashboard`, `Cases`, `Assets`, `Sensors` and `Recommendations` still have routes but are legacy and hidden. The ingestion chart on `Dashboard` uses synthetic data (`deriveIngestionStats` in `api.js`).

---

## Commands

All commands run from `stellar-dashboard/`:

```bash
npm run build     # Production build → dist/
npm start         # Express on :8080, serves dist/ + /proxy + /health
npm run dev       # Vite HMR on :5173 — UI only, see note below
npm run lint      # ESLint
node validate.mjs --url=https://<instance> --username=<u> --password=<p> --tenant=<id> [--host=http://localhost:8080]
                  # End-to-end check: auth → data endpoints → PDF normalization, via a running server
```

- **`npm run dev` cannot reach the API.** `vite.config.js` has no proxy, so `/proxy/*` falls through to the SPA. To test against a real instance, run `npm run build && npm start` and open `localhost:8080`.
- There are no unit tests. `validate.mjs` is the only automated check, and it needs real credentials.
- `npm run lint` reports `'process' is not defined` in `server.js`, `validate.mjs` and the scripts. This is expected: the ESLint config only declares browser globals.

---

## Architecture

### Runtime stack

```
Browser (React SPA)
    │ /proxy/connect/api/v1/*  +  X-Proxy-Target: https://<instance>
    ▼
Express server.js (PM2, 127.0.0.1:8080 behind Nginx)
    │ validates target, strips X-Proxy-Target, forwards server-side (avoids CORS)
    ▼
Stellar Cyber API
```

### Proxy guard (`server.js`)

Each customer has its own instance URL (custom domain or public IP), so there is no domain allowlist. Instead, the proxy enforces:
- `https://` only. HTTP is never valid, and URLs with credentials in them are rejected.
- Only paths under `/connect/api/v1/` are forwarded; any `..` is rejected.
- Internal addresses are blocked: loopback, RFC1918, CGNAT, link-local/metadata, multicast, IPv6 ULA/link-local and IPv4-mapped forms. IP literals are checked in the middleware. Hostnames are checked at connect time by a custom `https.Agent` `lookup`, which also blocks DNS rebinding.

A new endpoint outside `/connect/api/v1` needs a change to `API_PATH_PREFIX`. `auth.testConnectivity()` is the one call that goes straight from the browser, without the proxy.

### Context layer (`src/context/`)

| Context | Purpose | Storage |
|---|---|---|
| `AuthContext` | JWT, proactive renewal 60s before expiry | `sessionStorage` (password kept only in a ref) |
| `PocMetaContext` | POC form metadata + architecture image | `localStorage` (`poc_meta`, image in `poc_arch_image`) |
| `DataContext` | All fetched API data, 5-min polling | in-memory |

- `DataContext` is mounted inside `ProtectedLayout`, so it exists only while the user is authenticated.
- **Nothing is fetched until the user clicks Sync** on the Report page. `sync({pocStartDate, pocEndDate})` stores the dates in a ref, runs `fetchAll` and starts the interval.
- The POC period is capped at 30 days in the UI (`SyncBar`).
- The POC dates are never persisted. Logout wipes all POC metadata from `localStorage`.
- Token renewal needs the in-memory password. After a page reload it is gone, so the session ends when the token expires.

### Data flow (`src/services/`)

- `endpoints.js` is the single source of truth for paths and HTTP constants. `apiClient.js` builds an Axios instance with the proxy base URL and headers, and retries on 429/502/503/504.
- `DataContext.fetchAll` runs every fetcher in `Promise.allSettled` and maps results by **array index** to the `keys` list. Adding a fetcher means updating both arrays in the same order.
- Any 401 calls `disconnect()`. Other failures keep the previous data and show up in `errors`.
- **Cases:**
  - The API ignores the case time filters, so `fetchCases` makes 4 requests (one per severity, `limit: 500`) and filters by date on the client (`start_timestamp`, falling back to `created_at`).
  - It keeps all Critical and High cases, the top 100 Medium cases (plus `mediumTotal`), and only a count for Low (`lowCount` is `'500+'` when capped, and the totals then treat it as 500).
- **MITRE / XDR:** `fetchCaseTactics` calls `/cases/{id}/alerts` for each kept case (batches of 15). Tactics starting with `TA` count as MITRE; `XTA`/`XT` count as Stellar XDR proprietary.
- **Sensors:** `/ingestion-stats/sensor` returns only UUIDs. They are joined with `/data_sensors` in `fetchAll` to get hostname, type and version.
- `entity_usages/daily_count` supports only `days` (max 30 back from *today*). For POCs that ended more than 30 days ago, asset data comes back empty.
- The POC date boundaries (`dayStart`/`dayEnd`) are computed in UTC.

### PDF export

`src/services/pdfReport.js` builds the PDF with jsPDF + jspdf-autotable; it does not render a page. Charts are Chart.js drawn to an offscreen canvas and embedded as PNGs. Layout moves top to bottom with a running `y` cursor, and `needsPage(doc, y, h)` handles page breaks. The document is a cover page plus sections 1–10. Report-level metrics (totals, MITRE coverage %, avg assets/day, scorecard) are derived at the top of `generatePDFReport`.

### i18n

- The implementation is custom. `useLocale()` returns `t(key, vars)`, which supports `{var}` interpolation. The default locale is `pt`.
- `src/i18n/locales/{pt,en,es}.js` share the same key tree. **Any string change has to be made in all three files.** PDF text lives under the `pdf` key and is fetched with `getPdfStrings(locale)`.
- Operational recommendations in `utils/recommendations.js` are hardcoded (mixed PT/EN) and not localized. MITRE mitigations come from `utils/mitreMapping.js`, in all three languages.

### Build

Vite 8 / Rolldown: `manualChunks` must be a function (the object form is unsupported). The chunks are `vendor`, `charts`, `pdf` and `icons`. `package.json` `version` is injected as `__APP_VERSION__` and shown in the sidebar.

---

## Environment

Copy `.env.example` to `.env`. It sets `PORT` (8080), `HOST` (`0.0.0.0`; `setup-nginx.sh` switches it to `127.0.0.1` once Nginx is in front), `DOMAIN` (`stellarcyber.sekuritylab.com`) and `LETSENCRYPT_EMAIL`.

---

## Production / Deploy

See `stellar-dashboard/DEPLOY.md` for the full guide.

- `bash update.sh` does git pull, `npm install`, build and `pm2 restart --update-env`, then a health check. The app is down for only a few seconds during the restart.
- `bash deploy.sh` is the interactive wrapper: option 1 sets up Nginx + SSL, option 2 runs the update.
- `setup-nginx.sh` does the first-time Nginx + Let's Encrypt setup and is idempotent. The Nginx config is generated from `nginx.conf.template`.
- On the server, Node comes from **nvm**. Non-interactive SSH commands need `bash -lic "…"`, or `node`/`pm2` won't be found.
- `npm install` on the server rewrites `package-lock.json`. Stash it before `git pull` if the upstream lockfile changed.
- `server.js` calls `closeAllConnections()` before `server.close()` on SIGTERM. This avoids EADDRINUSE races during PM2 restarts while Nginx keep-alive sockets are open.
- Only the report dashboard is in scope on the production host. Do not touch the host firewall (ufw) or other services running there.
