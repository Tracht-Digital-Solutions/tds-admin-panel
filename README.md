# tds-admin-frontend

The **admin frontend** product (`management.tracht-digital.de`). A standalone Astro
app that composes the shared **core frontend host**
(`@tracht-digital-solutions/tds-core-frontend`) with the **admin extension
set**. Deployed from this repo's own `dev` / `release` branches.

## How it works

The whole frontend is assembled at build time from published packages — this repo
owns only the composition + deploy pipeline:

- `astro.config.mjs`:
  - `coreFrontendBase()` (from the host package) injects the shared base routes —
    Dashboard, Login, Nutzer, Einstellungen, API-Wiki + the shell/auth gate.
  - `frontendHost({ extensions })` (from `tds-frontend-contract-pkg`) injects each
    extension's route + the widget/settings virtual modules.
  - `FRONTEND_TARGET = admin` selects the shell's auth-hint key + brand ("Frontend").
- The extension set (this repo's only real decision): time-tracker,
  support-tickets, contact-tickets, website-cms, blog-cms, lexware, (customers).

To add/remove a feature: change the `extensions` array + the matching dep, bump,
release. To change the shell/base pages: edit the **host** package and release it,
then repin here.

> **Full provisioning:** `INSTALL.md` is the step-by-step runbook that stands up the
> whole system (database → identity → frontend-API → gateway → build/deploy → config →
> tools platform → adding extensions).

## Develop

```bash
npm install --no-package-lock   # host + extensions from GitHub Packages (needs NPM_TOKEN)
npm run dev                     # astro dev
npm run build                   # → dist/  (the deployed artifact)
```

## Deploy

Continuous: **every push to `main` builds + deploys** to the orphan `release` branch
(`release.yml`) and pings `DEPLOY_WEBHOOK_URL`; the production host pulls `release`.
The same deploy is dispatched automatically when `tds-ext-tools-pkg` publishes a new
`@latest` (a cross-repo `workflow_dispatch`), so an extension update rebuilds the
frontend with no manual step. The manual Actions button remains for on-demand redeploys.

Secrets: `PACKAGE_TOKEN` (install from Packages + push the branch),
`DEPLOY_WEBHOOK_URL` (optional; unset ⇒ the branch still publishes, no host ping).
