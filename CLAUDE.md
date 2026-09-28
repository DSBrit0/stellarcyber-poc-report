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
node validate.mjs --url=https://<instance> --apikey=<scoped-api-key> --tenant=<id> [--host=...]
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

A new endpoint outside `/connect/api/v1` needs a change to `API_PATH_PREFIX`.

### Context layer (`src/context/`)

| Context | Purpose | Storage |
|---|---|---|
| `AuthContext` | JWT, proactive renewal 60s before expiry | `sessionStorage` (password / API key kept only in a ref) |
| `PocMetaContext` | POC form metadata + architecture image | `localStorage` (`poc_meta`, image in `poc_arch_image`) |
| `DataContext` | All fetched API data, 5-min polling | in-memory |

- **Two login methods** (`AUTH_METHODS` in `auth.js`), both `POST /access_token` → JWT (10 min, `{access_token, exp}`):
  - `apiKey` (default): scoped API key sent as `Authorization: Bearer <key>`. No username. The key cannot be used directly on data endpoints (401); it must be exchanged. A tenant outside the key's scope returns 403 `Tenant mismatch`.
  - In `apiKey` mode the login has no tenant field. Right after authentication `AuthContext` calls `fetchTenants()` (`GET /tenants?fields=cust_id,cust_name,tgrp_name`, scoped by the user's tenancy; without a tenant the data endpoints return the sum of every tenant in scope, so a tenant is always required) and exposes `tenants` + `setTenant()`. The Report page shows a `TenantSelector` (top right): ungrouped tenants first, then each tenant group as a non-selectable `<optgroup>` with its tenants (groups hold no data; `tgrp_name` matches `/tenant_groups`, which some keys cannot read); until a tenant is chosen everything below the header is a disabled `<fieldset>`. If `/tenants` fails or is empty, Sync stays blocked with a permissions hint. Changing tenant calls `DataContext.resetData()` and requires a new Sync.
  - `basic`: username + password / legacy token via Basic Auth.
  - Every data call then uses `Authorization: Bearer <jwt>`.
- `DataContext` is mounted inside `ProtectedLayout`, so it exists only while the user is authenticated.
- **Nothing is fetched until the user clicks Sync** on the Report page. `sync({pocStartDate, pocEndDate})` stores the dates in a ref, runs `fetchAll` and starts the interval.
- Sync progress (`DataContext.progress`, 0–100, shown as "Syncing… N%" next to the Sync button): 9 data fetches + every alert page of the cases (`caseAlertPages`); the total is known once the cases arrive, so it stays at 0% until then and never goes backwards. 100% is held for 500 ms before "Synced".
- Case alerts (MITRE/XDR, the heaviest step) are fetched only on Sync (`fetchAll({ withTactics: true })`); the 5-min polling keeps the previous `caseTactics`. `fetchAll` reads `auth` through a ref so the interval always uses the current (renewed) JWT.
- The POC period is capped at 30 days in the UI (`SyncBar`).
- The POC dates are never persisted. Logout wipes all POC metadata from `localStorage`.
- Token renewal needs the in-memory password or API key. After a page reload it is gone, so the session ends when the token expires.

### Data flow (`src/services/`)

- `endpoints.js` is the single source of truth for paths, HTTP constants and page sizes (`PAGING`). The API reference is the SaaS Swagger (`docs.stellarcyber.ai/prod-docs/7.0.xs/Resources/SwaggerUI/dist/spec-saas.js`). `apiClient.js` builds an Axios instance with the proxy base URL and headers, and retries on 429/502/503/504.
- `DataContext.fetchAll` runs every fetcher in `Promise.allSettled` and maps results by **array index** to the `keys` list. Adding a fetcher means updating both arrays in the same order.
- Any 401 calls `disconnect()`. Other failures keep the previous data and show up in `errors`.
- **Cases:**
  - Without a date filter `/cases` returns only the last ~24h. `fetchCases` always sends the POC period as `FROM~created_at` / `TO~created_at` (epoch ms, documented) with `sort=created_at`. `start_time`/`end_time` are not documented and are ignored.
  - One query per severity: all Critical and High (paged with `skip` up to `total`, cap `PAGING.CASES_MAX`), the 100 most recent Medium plus `mediumTotal`, and only `total` for Low (`lowCount` is an exact number).
- **MITRE / XDR:** `fetchCaseTactics` calls `/cases/{id}/alerts` for each kept case (batches of 15). The API caps `limit` at 50, so it pages with `skip` up to the case `size` (cap `PAGING.CASE_ALERTS_MAX`). Tactics starting with `TA` count as MITRE; `XTA`/`XT` count as Stellar XDR proprietary.
- **Ingestion vs volume (docs 7.0):** *ingestion* = data sent by sensors and connectors before enrichment/compression (`/ingestion-stats/sensor|connector`, range totals only; per-day totals add up exactly to the range total). *Licensing volume* = data stored after enrichment/compression (`/storage-usages?aggr_type=tenant&cust_id=`, GB per day, last 31 complete UTC days, current day never included, 0 on days without data). `fetchDailyVolume` reads the latter for PDF section **7.4 Data Ingestion**: daily min/avg/max (`utils/volumeStats.js`, 0 days included) and the same 7.0 compliance tables as 7.3 applied to GB/day (`volumeCompliance`, limit = exactly 110%, no rounding). 7.3 and 7.4 share `drawLicenseCompliance()` in `pdfReport.js`. The two do not match by design. The "Total Data Ingested" in 3.1 and 7.1 is the same sum of the daily volume over the whole selected period (`—` when the API has no data).
- PDF `fmtDate`: `YYYY-MM-DD` strings are calendar days and are formatted in UTC; `new Date('YYYY-MM-DD')` in local time would show the previous day west of UTC.
- **Sensors:** `/ingestion-stats/sensor` returns only UUIDs. They are joined with `/data_sensors` in `fetchAll` to get hostname, type and version.
- `entity_usages/daily_count` supports only `days` (1–31, 422 otherwise); the series ends on the previous day. For POCs that ended more than 31 days ago, asset data comes back empty.
- **Assets / license compliance:** `daily_count` is the official daily license count (checked equal, day by day, to the size of `/entity_usages/entity_list/tenant?date=`). `utils/assetCompliance.js` computes min / average / max over every day of the period (days with 0 included, as the docs count every day) and simulates the Stellar Cyber 7.0 rule day by day (`simulateLicense`): a day is exceeded when its count is above 110% of the license, and a level is reached when the longest run of exceeded days is ≥ 3 (Warning), 7 (Violation) or 21 (Out of Compliance = 7 + 14). The recommended license is the highest count present on each of 3 consecutive days — with it no level is reached in the period (by construction). The PDF shows min/avg/max in the Section 1 KPI table and 7.1, and section **7.3 License Compliance**: recommendation, a table of the three levels for the recommended license, and licensing scenarios (period average / recommended / period peak). Asset discovery is meant to cover 30 days; shorter periods get a notice.
- The POC date boundaries (`dayStart`/`dayEnd`) are 00:00:00.000–23:59:59.999 UTC.

### PDF export

`src/services/pdfReport.js` builds the PDF with jsPDF + jspdf-autotable; it does not render a page. Charts are Chart.js drawn to an offscreen canvas and embedded as PNGs. Layout moves top to bottom with a running `y` cursor, and `needsPage(doc, y, h)` handles page breaks. The document is a cover page plus sections 1–10. Report-level metrics (totals, MITRE coverage %, avg assets/day, scorecard) are derived at the top of `generatePDFReport`.

### i18n

- The implementation is custom. `useLocale()` returns `t(key, vars)`, which supports `{var}` interpolation. The default locale is `pt`.
- `src/i18n/locales/{pt,en,es}.js` share the same key tree. **Any string change has to be made in all three files.** PDF text lives under the `pdf` key and is fetched with `getPdfStrings(locale)`.
- Non-React modules translate with `translate(key, vars, locale?)` from `i18n/messages.js` (same locale files; default locale = the one stored by `useLocale`). `logger.js` user-facing messages live under `errors.*` — every HTTP message keeps the code in parentheses, because `DataContext` detects `(401)` in the message. Operational recommendations live under `recOps.*` and use the `locale` passed to `generateRecommendations`. MITRE mitigations come from `utils/mitreMapping.js`, in all three languages.
- The PoC verdict is stored as a code (`approved` / `conditional` / `rejected`, `utils/verdict.js`); labels saved by older versions in any language are mapped back to the code.
- The PDF formats numbers and dates with the report locale (`_locStr`: pt-BR / en-US / es-MX). Case severity/status, MITRE tactic names and API data (case, connector, technique names) are shown as the API returns them.

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
