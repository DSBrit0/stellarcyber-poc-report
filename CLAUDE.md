# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React SPA dashboard for Stellar Cyber POC (Proof of Concept) reports. SE/analysts connect the dashboard to a live Stellar Cyber instance, explore security data, and export a branded PDF report. The entire app lives in `stellar-dashboard/`.

---

## Commands

All commands run from `stellar-dashboard/`:

```bash
npm run dev       # Vite dev server with HMR (localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # ESLint
npm start         # Start production Express server (port 8080, serves dist/)
```

**Deploy/update on server:**
```bash
bash update.sh    # git pull + npm install + build + pm2 restart
```

---

## Architecture

### Runtime Stack

```
Browser (React SPA)
    │ fetch /proxy/*  +  X-Proxy-Target: <stellar-cyber-url>
    ▼
Express server.js  (port 8080, PM2)
    │ reverse-proxy — strips X-Proxy-Target header, forwards request server-side
    ▼
Stellar Cyber API  (avoids browser CORS)
```

In dev (`npm run dev`) Vite serves the frontend. In production, Express serves the built `dist/` and also handles `/proxy` and `/health`.

### Context Layer (`src/context/`)

Three React contexts wrap the entire app (see provider order in `App.jsx`):

| Context | Purpose | Storage |
|---|---|---|
| `AuthContext` | JWT token, auto-renewal 60s before expiry | `sessionStorage` |
| `PocMetaContext` | POC metadata (client name, SE, dates, verdict) | `localStorage` |
| `DataContext` | All fetched API data + 5-min polling interval | in-memory |

`DataContext` is mounted **inside** `ProtectedLayout`, so it only polls while the user is authenticated.

### API / Proxy Flow

- All API calls go through `src/services/apiClient.js` → `createApiClient(auth)` returns an Axios instance with `baseURL: '/proxy'` and `X-Proxy-Target` header set.
- `src/services/endpoints.js` is the single source of truth for endpoint paths and HTTP constants (`TIMEOUT`, `MAX_RETRIES`, `RETRY_DELAY`).
- `src/services/api.js` contains all domain fetch functions consumed by `DataContext`.
- Authentication via `src/services/auth.js` hits `ENDPOINTS.ACCESS_TOKEN`.
- 401 responses in `DataContext.fetchAll` trigger `disconnect()`, returning user to login.

### i18n

Custom, no external library. `src/i18n/index.jsx` exports `LocaleProvider` and `useLocale()`. Locale strings are in `src/i18n/locales/{pt,en,es}.js`. The `t(key, vars)` function supports `{variable}` interpolation. Default locale is `pt` (Portuguese). `getPdfStrings(localeCode)` is used separately in PDF generation.

### PDF Export

`src/services/pdfReport.js` uses `jsPDF` + `jspdf-autotable` to generate the report. It pulls data from the current React state and POC metadata — it is not a page render but a programmatic document builder.

### Routing

React Router v7. The root `/` renders `LoginRoute` (redirects to `/report` if authenticated). All other routes are under `ProtectedLayout`, which redirects to `/` if not authenticated. Default authenticated route is `/report`.

### Build Chunks (Vite 8 / Rolldown)

`vite.config.js` uses `manualChunks` as a function (Rolldown requirement — object form is not supported). Chunks: `vendor` (React), `charts` (recharts), `pdf` (jsPDF), `icons` (lucide-react).

---

## Environment

Copy `.env.example` to `.env` before first run. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Express listen port |
| `HOST` | `0.0.0.0` | Bind address (`127.0.0.1` when behind Nginx) |
| `DOMAIN` | `stellarcyber.sekuritylab.com` | Used by Nginx setup |
| `LETSENCRYPT_EMAIL` | — | Required for HTTPS cert |

`HOST` is switched to `127.0.0.1` automatically by `setup-nginx.sh` once Nginx is in front.

---

## Production Server

- PM2 manages the Node.js process (`pm2 start server.js --name stellar-dashboard`).
- Nginx terminates SSL and reverse-proxies to `127.0.0.1:8080`.
- `nginx.conf.template` is the source for the generated Nginx config.
- `setup-nginx.sh` handles first-time Nginx + Let's Encrypt setup (idempotent).
- `server.js` handles `SIGTERM` gracefully: `closeAllConnections()` is called before `server.close()` to prevent EADDRINUSE races during PM2 restarts with Nginx keep-alive connections.
