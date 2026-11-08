import type {Page} from "@playwright/test";
import {test, expect} from "./fixtures";
import {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";

async function session(page: Page) {
  const response = await page.request.get("http://127.0.0.1:18010/__fixture/session");
  const value = await response.json();
  await page.addInitScript(value => {
    if (!localStorage.getItem("sb-localhost-auth-token")) localStorage.setItem("sb-localhost-auth-token", JSON.stringify(value));
  }, value);
}

test("production-mode navigation benchmark", async ({page}) => {
  await session(page);
  await page.addInitScript(() => {
    const state = window as Window & {benchmarkLCP?: number};
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.benchmarkLCP = entry.startTime;
    }).observe({type: "largest-contentful-paint", buffered: true});
  });
  const requests: {path: string; prefetch: boolean; api: boolean; type: string}[] = [];
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => {
    const url = new URL(r.url());
    requests.push({path: url.pathname + url.search, prefetch: Boolean(r.headers()["next-router-prefetch"] || r.headers()["next-router-segment-prefetch"]),
      api: url.port === "18010" && url.pathname.startsWith("/api/"), type: r.resourceType()});
  });
  await page.goto("/care-circle", {waitUntil: "load"});
  await expect(page.getByRole("button", {name: "Add simulated caregiver", exact: true})).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  const usableMs = await page.evaluate(() => performance.now());
  // A fixed observation window is used in both benchmark versions for background prefetch.
  await page.waitForTimeout(1500);
  const timing = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {ttfb_ms: n.responseStart - n.requestStart, dcl_ms: n.domContentLoadedEventEnd, load_ms: n.loadEventEnd,
      lcp_ms: (window as Window & {benchmarkLCP?: number}).benchmarkLCP ?? null,
      slowest_resources: performance.getEntriesByType("resource").sort((a, b) => b.duration - a.duration).slice(0, 5).map(e => ({path: new URL(e.name).pathname, duration_ms: e.duration})),
      js_transfer_bytes: performance.getEntriesByType("resource").filter(e => e.name.includes(".js")).reduce((n, e) => n + (e as PerformanceResourceTiming).transferSize, 0)};
  });
  const initial = [...requests];
  const navigation: {route: string; ms: number}[] = [];
  for (const [label, route] of [["Home", "/dashboard"], ["Tasks", "/tasks"], ["Handoffs", "/handoffs"], ["Consent", "/consent"], ["Care Circle", "/care-circle"]]) {
    const start = Date.now();
    await page.getByRole("link", {name: label, exact: true}).first().click();
    await page.waitForURL(`**${route}`);
    await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
    navigation.push({route, ms: Date.now() - start});
  }
  const counts = new Map<string, number>();
  for (const r of initial.filter(r => r.api)) counts.set(r.path, (counts.get(r.path) || 0) + 1);
  // The URL can change before Care Circle's route-specific effects finish.
  // Finish that navigation before measuring a new document's warm restoration.
  await expect(page.getByRole("button", {name: "Add simulated caregiver", exact: true})).toBeVisible();
  requests.length = 0;
  await page.reload({waitUntil: "load"});
  await expect(page.getByRole("button", {name: "Add simulated caregiver", exact: true})).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  const warmUsableMs = await page.evaluate(() => performance.now());
  await page.waitForTimeout(1500);
  const warm = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {ttfb_ms: n.responseStart - n.requestStart, dcl_ms: n.domContentLoadedEventEnd, load_ms: n.loadEventEnd,
      lcp_ms: (window as Window & {benchmarkLCP?: number}).benchmarkLCP ?? null,
      js_transfer_bytes: performance.getEntriesByType("resource").filter(e => e.name.includes(".js")).reduce((n, e) => n + (e as PerformanceResourceTiming).transferSize, 0)};
  });
  const warmCounts = new Map<string, number>();
  for (const r of requests.filter(r => r.api)) warmCounts.set(r.path, (warmCounts.get(r.path) || 0) + 1);
  const report = {methodology: "Isolated production Next build, headless Edge/Chromium, fresh browser context then warm reload, synthetic JWTs, temporary SQLite; 1.5s prefetch observation. Page request events include cached resources and exclude browser-internal preflights; not a production signed-in measurement or proven server cold start. Warm/LCP/usable/slowest metrics added after baseline; no before values available.",
    initial: {...timing, usable_ms: usableMs, requests: initial.length, api_requests: initial.filter(r => r.api).length,
      prefetch_requests: initial.filter(r => r.prefetch).length, duplicate_api_requests: [...counts.values()].reduce((n, v) => n + Math.max(0, v - 1), 0),
      prefetch_paths: [...new Set(initial.filter(r => r.prefetch).map(r => new URL(r.path, "http://localhost").pathname))],
      api_paths: Object.fromEntries(counts)}, warm_initial: {...warm, usable_ms: warmUsableMs, requests: requests.length, api_requests: requests.filter(r => r.api).length,
      api_paths: Object.fromEntries(warmCounts), duplicate_api_requests: [...warmCounts.values()].reduce((n, v) => n + Math.max(0, v - 1), 0)}, navigation, page_errors: errors};
  const label = process.env.BENCHMARK_LABEL || "local-after";
  const directory = path.resolve(__dirname, "../../../docs/performance");
  mkdirSync(directory, {recursive: true});
  writeFileSync(path.join(directory, `${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  expect(errors).toEqual([]);
  if (label !== "local-before") {
    // Contextual links may still prefetch; persistent navigation must not fan out.
    expect(report.initial.prefetch_paths.filter(p => p !== "/consent")).toEqual([]);
    expect(report.initial.duplicate_api_requests).toBe(0);
    expect(counts.get("/api/auth/me")).toBe(1);
    expect(warmCounts.get("/api/auth/me")).toBe(1);
    expect(report.warm_initial.duplicate_api_requests).toBe(0);
  }
});
