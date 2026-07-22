# Agent notes — tds-admin-frontend

The **admin frontend product** (`management.tracht-digital.de`). A standalone Astro app that
composes the shared core frontend **host** (`@tracht-digital-solutions/tds-core-frontend`)
with the **admin extension set**, at build time, into one static `dist/`. This repo owns
only the composition + deploy pipeline — the shell, base pages, and every feature live in
published packages.

> Read the root `C:\Projects\TDS-LP\CLAUDE.md` for the big picture and the shared gotchas,
> and `MIGRATION-STATUS.md` for how this product replaces the legacy `tds-admin`.

## Mental model

- **Everything is assembled at build time from GitHub Packages.** There is no app source
  here beyond `astro.config.mjs` + config:
  - `coreFrontendBase()` (host package `./astro`) `injectRoutes` the base pages — Dashboard,
    Login, Nutzer, Einstellungen, API-Wiki — plus the shell + pre-paint auth gate.
  - `frontendHost({ extensions })` (from `tds-frontend-contract-pkg`) injects each extension's route
    and folds its nav / widget / settings virtual modules into the composition.
  - `FRONTEND_TARGET=admin` selects the auth-hint key prefix (`tds_admin_*`) + brand ("Frontend").
- **The extension set is this repo's only real decision:** time-tracker, support-tickets,
  contact-tickets, website-cms, blog-cms, lexware, customers, billing.
  Adding/removing a feature = change the `extensions` array + its dep, bump, release.
- **To change the shell or a base page, edit the *host* package and release it, then repin
  the dep here.** Never fork base UI into this repo.

## Gotchas

- **`npm install --no-package-lock`** — the Windows-generated lockfile is win32-only and
  breaks the Linux CI build (`npm ci` fails). CI uses `--no-package-lock`; match it locally.
- **Host pins each extension `^0.1.x`** (0.x caret = `>=0.1.1 <0.2.0`) — an extension bump
  the product should pick up must stay in the `0.1.x` line. To jump an ext to `0.2.x`, bump
  the dep range here first.
- **`@source` in the host's `global.css` makes Tailwind scan the extension packages** for
  utility classes (node_modules is ignored by default). It's in the host, not here — don't
  add a competing `@source`, but know that ext-only utilities depend on it.
- **`PACKAGE_TOKEN`** (classic PAT, `read:packages` + repo, SSO'd) is required to install the
  host + extensions from Packages and to push the deploy branch. `DEPLOY_WEBHOOK_URL` is
  optional (unset ⇒ the `release` branch still publishes, the host just isn't pinged).

## Build & deploy

```bash
npm install --no-package-lock   # host + extensions from GitHub Packages (needs NPM_TOKEN)
npm run dev                     # astro dev
npm run build                   # → dist/  (FRONTEND_TARGET=admin)
```

- **`dev` branch** — auto-built on every push to `main` (`dev.yml`); staging artifact, not
  deployed.
- **`release` branch** — the manual Actions button (`release.yml`): builds, force-pushes
  `dist/` to `release`, pings `DEPLOY_WEBHOOK_URL`. The production host pulls `release`.

## Version

Bump `package.json` `version` on any composition/config/doc change, and commit the docs +
version with the code (see the root `CLAUDE.md` "After every task").
