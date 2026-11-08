import {test, expect} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";

test("system motion preference is respected on a first visit", async ({page}) => {
  const {session} = await createOwner(page);
  await installSession(page, session);
  await page.emulateMedia({reducedMotion: "reduce"});
  await open(page, "/settings");
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
});

test("unavailable browser preference storage has honest feedback", async ({page}) => {
  const {session} = await createOwner(page);
  await installSession(page, session);
  await page.addInitScript(() => {
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("maatru-care-")) throw new DOMException("Synthetic storage failure", "QuotaExceededError");
      return save.call(this, key, value);
    };
  });
  await open(page, "/settings");
  await expect(page.getByRole("alert").filter({hasText: "Browser preferences could not be saved"})).toBeVisible();
});

test("a successful save with failed refresh can retry without duplicate writes", async ({page}) => {
  const {session} = await createOwner(page);
  await installSession(page, session);
  await open(page, "/lifestyle");
  await expect(page.getByRole("button", {name: "Log intake", exact: true})).toBeEnabled();
  await page.route("**/api/lifestyle?**", route => route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({detail: "Temporary refresh failure"})}));
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/lifestyle/water") writes++; });
  await page.getByRole("button", {name: "Log intake", exact: true}).click();
  await expect(page.getByRole("button", {name: "Retry loading", exact: true})).toBeVisible();
  await expect(page.getByRole("alert").filter({hasText: "Your change was saved"})).toBeVisible();
  await page.unroute("**/api/lifestyle?**");
  await page.getByRole("button", {name: "Retry loading", exact: true}).click();
  await expect(page.getByRole("button", {name: "Retry loading", exact: true})).toHaveCount(0);
  await expect(page.locator("main")).toContainText("250 mL");
  expect(writes).toBe(1);
});

test("callback account switching cannot copy another account's browser profile", async ({page}) => {
  const first = await createOwner(page, "First Fictional Owner");
  const second = await createOwner(page, "Second Fictional Owner");
  await installSession(page, first.session);
  const key = `maatru-care-demo-local-settings:${first.session.user.id}`;
  await page.addInitScript(({key}) => {
    localStorage.setItem(key, JSON.stringify({profile: {phone: "1234567890", email: "private-fictional@example.test"}, carePreferences: {preferredLanguage: "Hindi"}}));
  }, {key});
  await page.goto("/auth/callback?error=access_denied");
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || "{}").carePreferences?.communicationPreference === "Email and text message", key);
  await page.evaluate(value => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(value));
    const channel = new BroadcastChannel("sb-localhost-auth-token");
    channel.postMessage({event: "SIGNED_IN", session: value});
    channel.close();
  }, second.session);
  const otherKey = `maatru-care-demo-local-settings:${second.session.user.id}`;
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}").profile?.phone ?? "pending", otherKey)).toBe("");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}").carePreferences?.preferredLanguage, otherKey)).toBe("English");
});
