import {expect, type Page} from "@playwright/test";

export async function createOwner(page: Page, name = "Fictional Quality Owner", demo = false) {
  const response = await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true");
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  const created = await page.request.post("http://127.0.0.1:18010/api/auth/bootstrap", {
    headers: {Authorization: `Bearer ${session.access_token}`}, data: {name, role: "patient", demo_workspace: demo},
  });
  expect(created.ok()).toBeTruthy();
  return {session, account: await created.json()};
}

export async function installSession(page: Page, session: Awaited<ReturnType<typeof createOwner>>["session"]) {
  await page.addInitScript(value => {
    if (!sessionStorage.getItem("fixture-session-installed")) {
      localStorage.setItem("sb-localhost-auth-token", JSON.stringify(value));
      sessionStorage.setItem("fixture-session-installed", "true");
    }
  }, session);
}

export async function open(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
}
