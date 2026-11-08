import {defineConfig} from "@playwright/test";
import path from "node:path";
import {existsSync} from "node:fs";

const python = process.env.MAATRUCARE_TEST_PYTHON || (process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python");
const edge = process.platform === "win32" && existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe");
export default defineConfig({
  testDir: "./tests/browser", testMatch: "**/*.spec.ts", workers: 1, timeout: 45000,
  outputDir: ".browser-test-results", reporter: "list",
  use: {baseURL: "http://localhost:3100", headless: true, viewport: {width: 1440, height: 1000},
        channel: edge ? "msedge" : undefined},
  webServer: [
    {command: `"${python}" tests/browser_server.py`, cwd: path.resolve(__dirname, "../backend"),
     url: "http://127.0.0.1:18010/api/health", reuseExistingServer: false, timeout: 60000},
    {command: "node tests/browser/start-app.mjs", url: "http://localhost:3100/sign-in",
     reuseExistingServer: false, timeout: 300000},
  ],
});
