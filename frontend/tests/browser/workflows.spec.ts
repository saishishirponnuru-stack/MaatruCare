import type {Page} from "@playwright/test";
import {expect, test} from "./fixtures";

async function installSession(page: Page, actor = "A") {
  const response = await page.request.get(`http://127.0.0.1:18010/__fixture/session?actor=${actor}`);
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript(value => {
    if (!sessionStorage.getItem("fixture-session-installed")) {
      if (!localStorage.getItem("sb-localhost-auth-token")) localStorage.setItem("sb-localhost-auth-token", JSON.stringify(value));
      sessionStorage.setItem("fixture-session-installed", "true");
    }
  }, session);
  return session;
}

async function open(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
}

test("saved caregiver, sharing, task, simulated handoff and history", async ({page}) => {
  await installSession(page);
  await open(page, "/care-circle");
  const started = Date.now();
  await page.getByRole("button", {name: "Add simulated caregiver", exact: true}).click();
  let drawer = page.getByRole("dialog");
  await drawer.getByLabel("Name", {exact: true}).fill("Jaya Fictional");
  await drawer.getByLabel("Relationship").selectOption("Friend");
  await drawer.getByRole("button", {name: "Add simulated caregiver", exact: true}).click();
  const manage = page.getByRole("button", {name: "Manage Jaya Fictional, Friend", exact: true});
  await expect(manage).toBeVisible();
  console.log(`Saved caregiver visible: ${Date.now() - started}ms (includes form interaction).`);
  await page.reload();
  await expect(manage).toBeVisible();
  await expect(page.locator("article").filter({has: manage})).toContainText("Simulated");
  await manage.click();
  await page.getByRole("dialog").getByLabel("Relationship", {exact: true}).fill("Cousin");
  await page.getByRole("button", {name: "Save details", exact: true}).click();
  await expect(page.getByRole("dialog").getByRole("status").filter({hasText: "Caregiver details saved"})).toBeVisible();
  await page.getByRole("button", {name: "Close panel", exact: true}).click();
  await page.reload();
  await expect(page.getByRole("button", {name: "Manage Jaya Fictional, Cousin", exact: true})).toBeVisible();

  await open(page, "/consent");
  await page.getByRole("button", {name: /Jaya Fictional/}).click();
  const sharing = page.getByRole("switch", {name: "Appointments for Jaya Fictional"});
  await expect(sharing).toHaveAttribute("aria-checked", "false");
  await sharing.click();
  await expect(sharing).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(sharing).toHaveAttribute("aria-checked", "true");

  await open(page, "/tasks");
  await page.getByRole("button", {name: "Add task", exact: true}).click();
  drawer = page.getByRole("dialog");
  await drawer.getByLabel("Task title").fill("Prepare fictional documents");
  const assignee = drawer.getByLabel("Assign to");
  const memberOption = assignee.locator("option").filter({hasText: "Jaya Fictional"});
  await assignee.selectOption(await memberOption.getAttribute("value") || "");
  await drawer.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", {name: "Complete Prepare fictional documents", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Complete Prepare fictional documents", exact: true}).click();
  const title = page.getByRole("button", {name: "Prepare fictional documents", exact: true});
  await expect(title).toHaveClass(/line-through/);
  await page.reload();
  await expect(title).toHaveClass(/line-through/);
  await page.getByRole("button", {name: "Reopen Prepare fictional documents", exact: true}).click();
  await expect(title).not.toHaveClass(/line-through/);
  await page.getByRole("button", {name: "Edit Prepare fictional documents", exact: true}).click();
  drawer = page.getByRole("dialog");
  const pastDate = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  await drawer.getByLabel("Due date", {exact: true}).fill(pastDate);
  await drawer.getByLabel("Status", {exact: true}).selectOption("In progress");
  await drawer.locator('button[type="submit"]').click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole("button", {name: "Overdue", exact: true}).click();
  await expect(title).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export", exact: true}).click();
  expect((await download).suggestedFilename()).toMatch(/^maatrucare-tasks-.*\.csv$/);
  await page.getByRole("button", {name: "My tasks", exact: true}).click();
  await expect(title).toHaveCount(0);
  await page.getByRole("button", {name: "All", exact: true}).click();
  await expect(title).toBeVisible();

  await open(page, "/handoffs");
  await page.getByRole("button", {name: "Create handoff", exact: true}).click();
  drawer = page.getByRole("dialog");
  await drawer.getByLabel("Handoff title").fill("Fictional document responsibility");
  const recipient = drawer.getByLabel("Receiving caregiver");
  const recipientOption = recipient.locator("option").filter({hasText: "Jaya Fictional"});
  await recipient.selectOption(await recipientOption.getAttribute("value") || "");
  await drawer.getByLabel("Responsibility / reason").fill("Organize fictional appointment documents.");
  await drawer.getByRole("button", {name: "Prepare handoff", exact: true}).click();
  await page.getByRole("button", {name: "Send handoff", exact: true}).click();
  await page.getByRole("button", {name: "Acknowledge (simulation)", exact: true}).click();
  await page.getByRole("button", {name: "Complete (simulation)", exact: true}).click();
  await expect(page.getByRole("button", {name: "Archive handoff", exact: true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", {name: "Archive handoff", exact: true})).toBeVisible();
  await expect(page.getByRole("list", {name: "Handoff progress"}).getByText("Completed", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Archive handoff", exact: true}).click();
  await page.getByRole("button", {name: "Confirm archive", exact: true}).click();
  await expect(page.getByRole("button", {name: /Fictional document responsibility/})).toHaveCount(0);
  await open(page, "/timeline");
  await expect(page.locator(".mc-action-timeline__event").first()).toBeVisible();
  await expect(page.locator("main")).toContainText("Simulated");
  await page.getByLabel("Activity order").selectOption("oldest");
  await expect(page.getByRole("list", {name: "Activity from oldest to newest"})).toBeVisible();
});

test("real invitation links and withdrawal remain operational", async ({page}) => {
  await installSession(page);
  await open(page, "/care-circle");
  await page.getByRole("button", {name: "Invite caregiver", exact: true}).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Name", {exact: true}).fill("Invited Fictional Friend");
  await drawer.getByLabel("Email", {exact: true}).fill("invite-browser@example.test");
  await drawer.getByRole("button", {name: "Create invitation link", exact: true}).click();
  await expect(drawer.getByLabel("Secure invitation link")).toHaveValue(/invitation=/);
  await drawer.getByRole("button", {name: "Close panel"}).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", {name: "Withdraw invitation", exact: true}).click();
  await expect(page.getByRole("button", {name: "Withdraw invitation", exact: true})).toHaveCount(0);
});

test("account switch clears previous workspace and sign-out removes session", async ({page}) => {
  const session = await installSession(page);
  const headers = {Authorization: `Bearer ${session.access_token}`};
  const account = await (await page.request.get("http://127.0.0.1:18010/api/auth/me", {headers})).json();
  const members = await (await page.request.get(`http://127.0.0.1:18010/api/caregivers?actor_caregiver_id=${account.caregiver_id}`, {headers})).json();
  if (!members.some((member: {name: string}) => member.name === "Jaya Fictional")) {
    const created = await page.request.post("http://127.0.0.1:18010/api/caregivers/demo", {headers, data: {patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, name: "Jaya Fictional", relationship: "Friend", role: "Support caregiver", coordination_access: true}});
    expect(created.ok()).toBeTruthy();
  }
  await open(page, "/care-circle");
  await expect(page.getByRole("button", {name: /^Manage Jaya Fictional, /})).toBeVisible();
  const response = await page.request.get("http://127.0.0.1:18010/__fixture/session?actor=B");
  await page.evaluate(value => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(value)), await response.json());
  await page.reload();
  await expect(page.getByRole("link", {name: "View care profile"})).toContainText("Nila Fictional");
  await expect(page.getByRole("button", {name: /Manage Jaya Fictional/})).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Add simulated caregiver", exact: true})).toHaveCount(0);
  await page.getByRole("button", {name: "Sign out", exact: true}).last().click();
  await page.waitForURL("**/sign-in");
  expect(await page.evaluate(() => localStorage.getItem("sb-localhost-auth-token"))).toBeNull();
  await page.goto("/tasks");
  await page.waitForURL("**/sign-in?**");
});

test("new account explicitly opts into an empty fictional workspace", async ({page}) => {
  await installSession(page, "C");
  await page.goto("/onboarding");
  const choice = page.getByRole("checkbox", {name: /Create a fictional demonstration workspace/});
  await expect(choice).not.toBeChecked();
  await page.getByLabel("Full name", {exact: true}).fill("Fictional New Owner");
  await choice.check();
  await page.getByRole("button", {name: "Continue to MaatruCare"}).click();
  await page.waitForURL("**/dashboard");
  await expect(page.locator("main")).toContainText("Welcome, Fictional");
  await open(page, "/care-circle");
  await expect(page.getByRole("button", {name: "Add simulated caregiver", exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: /^Manage /})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", {name: "Add simulated caregiver", exact: true})).toBeVisible();
});

test("remaining pages and representative widths load without browser exceptions", async ({page}) => {
  await installSession(page, "B");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const route of ["/dashboard", "/journey", "/lifestyle", "/ai-assist", "/settings", "/profile"]) {
    await open(page, route);
    await expect(page.locator("main")).toBeVisible();
  }
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({width, height: 900});
    await open(page, "/care-circle");
    await expect(page.getByRole("button", {name: "Invite caregiver", exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test("failed API load finishes with visible error feedback", async ({page}) => {
  await installSession(page, "B");
  await page.route("**/api/tasks?**", route => route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({detail: "Temporary test service unavailable"})}));
  await open(page, "/tasks");
  await expect(page.locator("main")).toContainText("Tasks could not be loaded. Try again.");
  await expect(page.getByRole("button", {name: "Retry", exact: true})).toBeVisible();
  await page.unroute("**/api/tasks?**");
  await page.getByRole("button", {name: "Retry", exact: true}).click();
  await expect(page.getByRole("button", {name: "Retry", exact: true})).toHaveCount(0);
});
