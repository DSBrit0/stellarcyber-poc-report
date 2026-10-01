# Stellar Cyber POC Report

A web app that builds a branded PDF POC (Proof of Concept) report from a live Stellar Cyber instance. The SE logs in to the customer's instance, picks the tenant and the POC period, fills in the POC details, and downloads the PDF.

Everything runs in the browser. There is no database and nothing is stored on the server. The Express server only serves the build and forwards API calls to the instance, which avoids CORS.

The app is in [`stellar-dashboard/`](stellar-dashboard/). For deployment, see [`stellar-dashboard/DEPLOY.md`](stellar-dashboard/DEPLOY.md).

---

## How it works

1. **Login.** Enter the instance URL and pick a login method:
   - **Scoped API Key** (default): no username or tenant field. After login, choose the tenant at the top right of the Report page.
   - **Username + Token**: Basic Auth with username, password or legacy API token, and the Tenant ID.
2. **Sync.** Set the POC period (up to 30 days) and click **Sync**. Nothing is fetched before this. The bar shows "Syncing… N%". A busy tenant over 30 days can take a few minutes, because every alert page of every case is read for the MITRE / XDR coverage.
3. **POC details.** Customer, analysts, success criteria, SE and partner, platform version, verdict, comments, and the architecture image. They are saved in the browser's `localStorage` and cleared on logout. The POC dates are never saved.
4. **Download.** Pick the report model next to the button:
   - **Technical Report** (default): the full layout, sections 1–10.
   - **Executive Report**: a dark cover, an executive dashboard, charts with values and notes, and section 4.1 told as "the detection story" in five questions. Instead of the architecture upload, the form shows the effort premises (minutes per alert and per case) used to estimate the analyst hours saved.

The UI and the PDF are available in Portuguese (default), English and Spanish.

**Credentials.** The password or API key is kept only in memory, and the JWT in `sessionStorage`. The JWT is renewed 60 s before it expires. After a page reload the password or key is gone, so the session ends when the token expires (10 min).

### API permissions

- Use a **local** account. SSO users cannot access the API.
- A scoped API key gets the scope and RBAC privileges of its account. It must be able to read `/tenants`. Otherwise no tenant can be selected and Sync stays blocked.
- To create a key: **System → Organization Management → Users → Edit → API Keys → Create API Key**. The login page has a guide for each method.

---

## Running locally

Requires **Node.js 20.19+ or 22.12+** (Vite 8).

```bash
cd stellar-dashboard
cp .env.example .env
npm install
npm run build && npm start     # http://localhost:8080
```

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm start` | Express on `:8080`: `dist/` + `/proxy` + `/health` |
| `npm run dev` | Vite with HMR on `:5173`. **UI only**: it has no proxy, so it cannot reach the API |
| `npm run lint` | ESLint (`'process' is not defined` in `server.js`, `validate.mjs` and the scripts is expected) |

### End-to-end check

There are no unit tests. `validate.mjs` runs against a real instance, through a running server. It checks auth, the data endpoints and the PDF normalization:

```bash
node validate.mjs --url=https://<instance> --apikey=<scoped-api-key> --tenant=<id> [--host=http://localhost:8080]
node validate.mjs --url=https://<instance> --username=<u> --password=<p> --tenant=<id>
# add --start=YYYY-MM-DD --end=YYYY-MM-DD to also check the Executive 4.1 story against every case of the period
```

---

## Proxy security

Each customer has its own instance URL, so there is no domain allowlist. Instead, `server.js`:

- forwards only `https://` targets, with no credentials in the URL;
- forwards only paths under `/connect/api/v1/` (`..` is rejected);
- blocks internal addresses (loopback, RFC1918, CGNAT, link-local / metadata, multicast, IPv6 ULA / link-local, IPv4-mapped). Hostnames are checked when the connection opens, which also blocks DNS rebinding.

---

## Login troubleshooting

| Message | Cause | What to do |
|---|---|---|
| `Could not connect to <host>` | Wrong URL, instance offline, or a firewall / VPN in the way | Check the URL and open it in the browser |
| `Invalid URL` | The URL is malformed | Use `https://<instance>` with no path |
| `(400)` | The URL is `http://` or has credentials in it | Use `https://` |
| `(401)` | Wrong credentials, or the session expired | Log in again |
| `(403)` | The tenant is outside the key's scope (`Tenant mismatch`), the account lacks permission, or the URL points to an internal address | Choose a tenant in the key's scope, check the account's privileges, or use the instance's public address |
| Sync blocked, no tenants | The key cannot read `/tenants`, or the list is empty | Give the account permission to read tenants |
| `(502)` | The instance did not answer the proxy | Check that the instance is up |

**Settings → Diagnostic Logs** shows the full request log (**Copy log** copies it). The same log is in the browser console (`[ERROR] [auth]`).
