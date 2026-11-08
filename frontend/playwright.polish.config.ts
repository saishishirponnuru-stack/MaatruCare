import {defineConfig} from "@playwright/test";
import base from "./playwright.config";

// Opt-in only: the existing backend fixture refuses production hosts and always
// creates its own temporary SQLite DB. It never reads a development DB/backup.
export default defineConfig({...base, testMatch:"**/polish.scenario.ts",
  webServer:(Array.isArray(base.webServer)?base.webServer:[]).map(server=>({...server,
    env:{...server.env,MAATRUCARE_BROWSER_POLISH_TESTS:"true"},
  })),
});
