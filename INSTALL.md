# Installation & Bereitstellung — Admin-Panel (Schritt für Schritt)

Diese Anleitung stellt das **Admin-Panel** (`management.tracht-digital.de`) und
alles, was es dafür braucht, von Grund auf bereit — Datenbank, Identität,
Panel-API, Gateway, der Panel-Build/Deploy, die Erstkonfiguration und optional die
öffentliche Tools-Plattform.

> Das Admin-Panel ist eine **statische Astro-App**, die zur Build-Zeit aus
> veröffentlichten Paketen (Host + Extensions) zusammengesetzt wird. Es hat
> **kein eigenes Backend** — die Daten liefern `tds-auth-api` (Login/JWT) und
> `tds-core-panel-api` (der Panel-API-Kernel mit allen Extension-Routen). Erst das
> Zusammenspiel dieser Teile ergibt ein lauffähiges Panel.

**Reihenfolge:** Datenbank → Identität → Panel-API → Gateway → Panel bauen/ausrollen
→ konfigurieren. Backend-spezifische Details stehen jeweils im `README.md` /
`INSTALL.md` des genannten Repos; hier steht die **Gesamt-Reihenfolge** plus die
Panel-eigenen Schritte im Detail.

---

## Komponenten im Überblick

| Komponente | Repo | Rolle | Läuft auf |
|---|---|---|---|
| Identität | `tds-auth-api` | Login, RS256-JWT-Ausgabe + JWKS, `app_user`, Mitgliedschaften | `api.tracht-digital.de/auth` |
| Panel-API-Kernel | `tds-core-panel-api` | komponiert die Extension-Module in-process (PDO, Mailer, JWT-Verify, SettingsStore) | `api.tracht-digital.de/*` |
| API-Gateway | `tds-api-gateway` | einziger öffentlicher Eingang, routet nach Pfad-Präfix | `api.tracht-digital.de` |
| Panel-Host | `tds-core-panel-frontend` | Shell + Basisseiten (als npm-Paket) | (Build-Zeit) |
| Extensions | `tds-ext-*` | Features (Tickets, CMS, Lexware, Tools …) | (Build-Zeit + Module in der API) |
| **Admin-Panel** | **`tds-admin-panel`** | dieses Produkt: komponiert Host + Extensions → `dist/` | `management.tracht-digital.de` |

---

## 0. Voraussetzungen

- **Prod-Host** (netcup/Plesk): PHP 8.3, **MySQL 8**, Apache/nginx, integrierter
  Composer. Kein Node-Runtime auf dem Prod-Host nötig (das Panel ist statisch).
- **CI/Build** läuft auf GitHub Actions (Node 22). Lokal nur nötig, wenn du
  Backends selbst testest: PHP 8.3 + Composer, Node 22.
- **Domains/Subdomains** eingerichtet und per HTTPS erreichbar:
  `management.tracht-digital.de` (Panel), `api.tracht-digital.de` (Gateway),
  `app.tracht-digital.de` (Kundenportal, für Login/SSO).
- **GitHub PAT (classic)** mit `read:packages`, `write:packages`,
  `delete:packages`, `repo`, `workflow`, **SSO-autorisiert** für die Org
  `Tracht-Digital-Solutions`. In den Repos als Secret **`PACKAGE_TOKEN`**.
- **Alle Plattform-Pakete sind veröffentlicht** (Host + Extensions auf GitHub
  Packages). Falls nicht: erst die Extensions/den Host releasen (deren Release-
  Button), siehe Abschnitt „Extensions".

---

## 1. Datenbank anlegen

Auf dem Prod-Host (MySQL 8) eine Datenbank + einen Benutzer anlegen; die Zugangsdaten
kommen gleich in die `.env` der Backends.

```sql
CREATE DATABASE tds CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tds'@'localhost' IDENTIFIED BY 'STARKES_PASSWORT';
GRANT ALL PRIVILEGES ON tds.* TO 'tds'@'localhost';
FLUSH PRIVILEGES;
```

> Migrationen sind **MySQL-8-sicher** geschrieben. Die Tabellen legen die jeweiligen
> Migrationen bzw. das Self-Bootstrapping der Backends an (kein manuelles Schema).

---

## 2. Identität bereitstellen — `tds-auth-api`

Der zentrale Login + JWT-Aussteller. Jedes andere Backend **verifiziert** die Tokens
nur (über JWKS) und sieht den privaten Schlüssel nie.

1. Repo auf den Host bringen, `composer install --no-dev`.
2. `.env` aus `.env.example` befüllen: DB-Zugang, Cookie-Domain
   `.tracht-digital.de` (damit die Session über `management.`/`app.` gilt), SMTP.
3. **Einmalig** das RS256-Schlüsselpaar erzeugen:
   ```bash
   composer keygen        # legt keys/private.pem (gitignored!) + public an
   ```
   > `keys/private.pem` **nie committen** — nur im Passwort-Manager + in der
   > Host-`.env`.
4. Migrationen ausführen: `composer migrate`.
5. **Ersten Admin anlegen** (Benutzer mit `admin=true`) — siehe `tds-auth-api`s
   `INSTALL.md` für den genauen Befehl.
6. Prüfen: `…/auth/.well-known/jwks.json` liefert den öffentlichen Schlüssel
   (der `php -S` braucht dafür `public/router.php` — im Prod via `.htaccess`
   automatisch).

Detaillierte Backend-Schritte: **`tds-auth-api/INSTALL.md`**.

---

## 3. Panel-API-Kernel bereitstellen — `tds-core-panel-api`

Das Backend, das **alle Extension-Routen** des Panels bereitstellt (Tickets, CMS,
Lexware, Tools …). Es komponiert die in `src/Modules.php` aktivierten Module
in-process.

1. `composer install --no-dev` (löst die Extensions über ihre VCS-Tags + den
   Contract auf).
2. `.env` setzen:
   - `DB_*` — dieselbe Datenbank wie oben.
   - `AUTH_API_URL` — Basis der `tds-auth-api` (für die JWKS-Verifikation). Fehlt
     sie, ist jede Anfrage anonym (Boot funktioniert, aber niemand ist eingeloggt).
   - `SETTINGS_ENCRYPTION_KEY` — 32-Byte-Schlüssel; verschlüsselt die im Panel
     gespeicherten Secrets (Stripe/DeepL/…) AES-256-GCM. **Sicher aufbewahren** —
     ohne ihn sind gespeicherte Secrets nicht mehr lesbar.
   - `MAIL_DSN` — SMTP (sonst werden Mails stumm verworfen).
   - `CORS_ALLOWED_ORIGINS` — muss die Panel-Herkünfte enthalten
     (`https://management.tracht-digital.de`, `https://app.tracht-digital.de`) und
     ggf. `https://tools.tracht-digital.de` (siehe Abschnitt 7).
3. Migrationen: der Kernel migriert **in-process** beim ersten Request nach dem
   Deploy (der Prod-Host erlaubt keine Subprozesse/Cron); die Basis-Tabellen
   (`app_setting`, `user_dashboard_layout`) legen sich per `CREATE TABLE IF NOT
   EXISTS` selbst an.

> **Status/Blocker:** `tds-core-panel-api` hat **noch keine eigene
> Assemble-/Deploy-Pipeline** (die ist zusammen mit dem Auto-Migrator zurück-
> gestellt). Bis sie steht, wird der Kernel manuell auf den Host gebracht (Composer
> auf dem Plesk-Host, `main`-Branch) und über das Gateway eingebunden. Ohne
> deploytes `core-panel-api` funktionieren die Extension-Seiten des Panels nicht
> (nur Login/Shell). Details: **`tds-core-panel-api/README.md`**.

---

## 4. Gateway / Routing — `tds-api-gateway`

`api.tracht-digital.de` ist der einzige öffentliche Eingang. Das erste Pfad-Segment
wählt das Backend; der Rest wird weitergereicht (`/auth/…` → auth-api, der Rest →
Panel-API-Kernel).

- Standard `GATEWAY_MODE=inprocess` lädt die Backends **in denselben PHP-FPM-Prozess**
  (Plesk-Modell „installieren ohne SSH"). CORS bleibt bei den Upstreams — am Gateway
  **nicht** noch einmal hinzufügen.
- Nach dem Deploy: prüfen, dass `…/auth/.well-known/jwks.json` und die Panel-Routen
  (z. B. `…/admin/permissions`) erreichbar sind.

Details: **`tds-api-gateway/INSTALL.md`**.

---

## 5. Admin-Panel bauen & ausrollen — `tds-admin-panel` (dieses Repo)

Das Panel selbst besteht nur aus `astro.config.mjs` (Komposition) + Deploy-Pipeline.
Es wird aus veröffentlichten Paketen gebaut.

### 5.1 Secrets setzen (GitHub → Repo Settings → Secrets)

| Secret | Zweck | Pflicht |
|---|---|---|
| `PACKAGE_TOKEN` | Install von GitHub Packages **und** Push des Branches | ja |
| `DEPLOY_WEBHOOK_URL` | Plesk-Git-Webhook-URL (Ping nach `release`) | optional* |

*Ohne `DEPLOY_WEBHOOK_URL` wird der `release`-Branch trotzdem veröffentlicht; nur
der Host wird nicht automatisch benachrichtigt (dann manuell „Pull" im Plesk).

### 5.2 Lokal bauen (optional, zur Kontrolle)

```bash
npm install --no-package-lock   # Host + Extensions aus Packages (NPM_TOKEN nötig)
npm run type-check              # astro check — 0 Fehler
npm run build                   # → dist/
```

### 5.3 Ausrollen

- **`dev`-Branch** — baut automatisch bei jedem Push auf `main` (`dev.yml`);
  Staging-Artefakt, **nicht** deployt.
- **`release`-Branch** — der manuelle Button: **Actions → „Release → release branch
  (manual)" → Run workflow**. Baut, force-pusht `dist/` nach `release`, pingt
  `DEPLOY_WEBHOOK_URL`.
- Den Prod-Host (`management.tracht-digital.de`) auf den **`release`-Branch** zeigen
  lassen (Plesk: Git-Repo → Branch `release`, Deploy-Pfad = Web-Root).

Per CLI:
```bash
gh workflow run release.yml -R Tracht-Digital-Solutions/tds-admin-panel
```

Das Panel ist `noindex` + robots-disallowed — das ist **so gewollt** (internes Panel).

---

## 6. Erstanmeldung & Konfiguration

1. `https://management.tracht-digital.de` öffnen → Login mit dem in Schritt 2
   angelegten Admin. Die Shell prüft die Session vor dem Paint gegen `…/auth/me`.
2. Unter **Nutzer** weitere Admins/Support-Agenten + Firmen-Mitgliedschaften pflegen.
3. Unter **Einstellungen** die Extension-Schlüssel setzen (im DB-`SettingsStore`,
   verschlüsselt): u. a. **DeepL** (Blog-/Website-CMS-Übersetzungen), **Rebuild-PATs**
   (statische Seiten neu bauen), **Stripe** (Rechnungen/Billing), **Lexware**,
   **Tools/AdSense** (siehe Abschnitt 7). Secrets werden nur **maskiert**
   zurückgegeben (`konfiguriert · …last4`); leer lassen = behalten.

---

## 7. Öffentliche Tools-Plattform anbinden (optional)

Die öffentliche Tools-Seite `tools.tracht-digital.de` wird über die Extension
**`tds-ext-tools`** (bereits im Panel enthalten) gesteuert.

1. Sicherstellen, dass `tds-ext-tools` released + das Panel damit gebaut ist (ist es).
2. In **Einstellungen → Tools / AdSense** setzen: AdSense-Publisher-ID + Slots,
   Registry-Sync-Token (identisch als `TOOLS_REGISTRY_TOKEN` in `tds-tools`),
   Rebuild-Repo/-Token, Stripe (für Premium-Tools).
3. `CORS_ALLOWED_ORIGINS` (Schritt 3) muss `https://tools.tracht-digital.de`
   enthalten; den Stripe-Webhook auf `…/tools/stripe-webhook` zeigen lassen.
4. Die Website selbst bereitstellen: **`tds-tools`** (eigenes Repo) — `DEPLOY_WEBHOOK_URL`
   setzen, **Release** drücken, Domain auf dessen `release`-Branch zeigen.

Die **freien Tools + AdSense laufen unabhängig** vom Panel-Backend; der dynamische
Katalog + Premium brauchen ein deploytes `tds-core-panel-api` (Schritt 3).
Vollständige Anleitung: **`tds-tools/README.md`** + **`tds-ext-tools/README.md`**.

---

## 8. Extensions einbauen / entfernen

Eine Funktion ist eine **Extension** (`tds-ext-*`) — je Repo eine FE-Manifest + ein
PHP-`Module`. Ein-/Ausbauen betrifft **zwei** Stellen (Frontend + Backend):

1. **Frontend** (dieses Repo): das Manifest in `astro.config.mjs` `extensions[]`
   ergänzen **und** die passende Dependency in `package.json` (Pin `^0.1.x`):
   ```js
   import feature from "@tracht-digital-solutions/tds-ext-feature";
   const extensions = [ …, feature ];
   ```
2. **Backend** (`tds-core-panel-api`): `new FeatureModule()` in `src/Modules.php`
   `enabled()` ergänzen + ein Composer-Eintrag/`path`-Repo (dev) bzw. VCS-Require.
3. **Version bumpen** (dieses Repo `package.json`) und **Release** drücken. Nach dem
   Deploy des Panels **und** des Kernels ist die Funktion live.

Eine **neue** Extension entsteht aus `tds-ext-template` (Klonen + Umbenennen);
Details in `tds-ext-template/README.md` und `tds-panel-contract/AGENTS.md`. Regeln:
IDs (Extension/Permission/Nav/Widget/Settings/Route) sind **global eindeutig** (die
Komposition bricht sonst hart ab); Extensions bleiben in der `0.1.x`-Linie.

---

## Referenz

### Secrets (GitHub)
- **`PACKAGE_TOKEN`** (alle Plattform-Repos) — Install aus Packages + Publish +
  Branch-Push. Speist in der CI die Variable `NPM_TOKEN`.
- **`DEPLOY_WEBHOOK_URL`** (`tds-admin-panel`, `tds-customer-panel`, `tds-tools`) —
  Deploy-Ping nach `release`.

### Backend-`.env` (Kernbegriffe)
`DB_*`, `AUTH_API_URL`, `SETTINGS_ENCRYPTION_KEY`, `MAIL_DSN`,
`CORS_ALLOWED_ORIGINS`, `GATEWAY_MODE` (`inprocess`/`proxy`), `ADMIN_TOKEN`
(Gateway `/wiki`). Cookie-Domain `.tracht-digital.de`.

### Domains
`management.` (Panel · `release`-Branch), `app.` (Kundenportal), `api.` (Gateway →
auth + core-panel-api), `tools.` (Tools-Seite · optional).

### Troubleshooting
- **Login klappt, aber Extension-Seiten leer/Fehler** → `tds-core-panel-api` nicht
  (richtig) deployt oder `AUTH_API_URL`/`CORS_ALLOWED_ORIGINS` falsch.
- **`npm install` 401/403 in CI** → `PACKAGE_TOKEN` fehlt/abgelaufen (401) bzw.
  nicht SSO-autorisiert (403).
- **Cross-Origin-Requests blockiert (OPTIONS 405)** → Herkunft fehlt in
  `CORS_ALLOWED_ORIGINS`.
- **Release-Branch da, aber Host aktualisiert nicht** → `DEPLOY_WEBHOOK_URL` fehlt →
  im Plesk manuell „Pull".

### Offene Blocker (Stand: Plattform gebaut, Cutover ausstehend)
- `tds-core-panel-api` hat noch **keine Assemble-/Deploy-Pipeline** → manueller
  Deploy nötig; bis dahin sind die dynamischen Panel-Funktionen nicht produktiv.
- `DEPLOY_WEBHOOK_URL` auf den Produkten setzen + Domains auf die `release`-Branches
  zeigen.

Für die Repo-eigene Kurzfassung siehe `README.md`; für Architektur/Gotchas
`AGENTS.md`.
