# tds-admin-panel

**Deploy target for the admin panel** (`management.tracht-digital.de`).

The admin panel is a **build of `tds-core-panel-frontend`** with the default
(admin) product target — the base host + the internal-tool extension set
(time-tracker, support-tickets, website-cms, …). There is no separate app
codebase: "two products from one core" is a build-time selection, not a fork.

## Build

```bash
# in tds-core-panel-frontend:
npm install
npm run build            # PANEL_TARGET defaults to admin
# → dist/ deploys to management.tracht-digital.de
```

- Enabled extensions: `tds-core-panel-frontend/astro.config.mjs` (admin branch).
- Auth hint key: `tds_admin_*`; brand suffix: "Panel" (`src/config/target.ts`).
- Env: `PUBLIC_AUTH_API_URL`, `PUBLIC_API_BASE` → `api.tracht-digital.de/*`.

## This repo

Holds the admin panel's **deploy config + secrets** (this is why the repo exists
separately from the core). The static `dist/` artifact is produced from
`tds-core-panel-frontend`; a deploy workflow here (or a host Git pull) publishes
it to the admin domain. The sibling `tds-customer-panel` is the same core built
with `PANEL_TARGET=customer`.
