import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { panelHost } from "@tracht-digital-solutions/tds-panel-contract/astro";
import { corePanelBase } from "@tracht-digital-solutions/tds-core-panel-frontend/astro";
import { tdsViteBuild } from "@tracht-digital-solutions/tds-shared/astro";

// The admin extension set — this repo's ONLY composition decision. corePanelBase
// injects the shared base routes (dashboard/login/users/settings/wiki); panelHost
// injects each extension's route + the widget/settings virtual modules.
import timeTracker from "@tracht-digital-solutions/tds-ext-time-tracker";
import supportTickets from "@tracht-digital-solutions/tds-ext-support-tickets";
import contactTickets from "@tracht-digital-solutions/tds-ext-contact-tickets";
import websiteCms from "@tracht-digital-solutions/tds-ext-website-cms";
import blogCms from "@tracht-digital-solutions/tds-ext-blog-cms";
import lexware from "@tracht-digital-solutions/tds-ext-lexware";
import customers from "@tracht-digital-solutions/tds-ext-customers";
import billing from "@tracht-digital-solutions/tds-ext-billing";
import tools from "@tracht-digital-solutions/tds-ext-tools";

const extensions = [timeTracker, supportTickets, contactTickets, websiteCms, blogCms, lexware, customers, billing, tools];

// This product builds as the ADMIN target (shell auth-hint key + brand).
process.env.PANEL_TARGET = "admin";
process.env.PUBLIC_PANEL_TARGET = "admin";
// Login is the central site (auth.tracht-digital.de) — the host bounces there.
// The host defaults PUBLIC_LOGIN_URL; set it in the build env to override (e.g.
// the local tds-auth dev server).

export default defineConfig({
  output: "static",
  integrations: [react(), corePanelBase(), panelHost({ extensions })],
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { build: { ...tdsViteBuild } },
});
