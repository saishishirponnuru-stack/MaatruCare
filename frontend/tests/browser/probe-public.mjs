// Anonymous, read-only production navigation. Never signs in or submits forms.
import {chromium} from "@playwright/test";
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const channel = process.platform === "win32" && existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") ? "msedge" : undefined;
const browser = await chromium.launch({channel, headless: true});
const results = [];
try {
  for (let index = 0; index < 3; index++) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__lastLCP = null;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__lastLCP = entry.startTime;
      }).observe({type: "largest-contentful-paint", buffered: true});
    });
    for (const cache of ["fresh-browser-context", "warm-reload"]) {
      const requests = [];
      const errors = [];
      const responses = [];
      const onRequest = request => requests.push(request.url());
      const onError = error => errors.push(error.message);
      const onResponse = response => responses.push({url: response.url(), status: response.status(), cache: response.headers()["x-vercel-cache"] || null,
        encoding: response.headers()["content-encoding"] || null, cache_control: response.headers()["cache-control"] || null});
      page.on("request", onRequest); page.on("pageerror", onError); page.on("response", onResponse);
      if (cache === "warm-reload") await page.reload({waitUntil: "load"});
      else await page.goto("https://maatru-care.vercel.app/sign-in", {waitUntil: "load"});
      await page.getByRole("button", {name: /Google/}).waitFor();
      await page.waitForTimeout(1000);
      const measurement = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return {ttfb_ms: n.responseStart - n.requestStart, dcl_ms: n.domContentLoadedEventEnd, load_ms: n.loadEventEnd, lcp_ms: window.__lastLCP,
          js_transfer_bytes: resources.filter(r => r.name.includes(".js")).reduce((n, r) => n + r.transferSize, 0),
          slowest_resources: resources.sort((a, b) => b.duration - a.duration).slice(0, 5).map(r => ({path: new URL(r.name).pathname, duration_ms: r.duration, transfer_bytes: r.transferSize}))};
      });
      results.push({sample: index + 1, cache, final_url: page.url(), ...measurement, observed_requests: requests.length, page_errors: errors,
        response_metadata: responses.filter(r => r.url.includes("/_next/static/") || r.url.endsWith("/sign-in")).slice(0, 5)});
      page.off("request", onRequest); page.off("pageerror", onError); page.off("response", onResponse);
    }
    await context.close();
  }
} finally { await browser.close(); }
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/performance/production-public-browser.json");
mkdirSync(path.dirname(output), {recursive: true});
writeFileSync(output, JSON.stringify({timestamp_utc: new Date().toISOString(), methodology: "Anonymous sign-in page only; headless Edge/Chromium. Fresh context then warm reload, 3 pairs. One second LCP observation. No authenticated API or mutation tested; no proven backend cold start.", results}, null, 2));
console.log(JSON.stringify(results.map(({sample, cache, ttfb_ms, dcl_ms, load_ms, lcp_ms, observed_requests, page_errors}) => ({sample, cache, ttfb_ms, dcl_ms, load_ms, lcp_ms, observed_requests, page_errors}))));
