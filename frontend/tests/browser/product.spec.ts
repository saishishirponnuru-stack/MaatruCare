import {expect, test} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";

test("profile, journey, theme and browser preferences persist", async ({page}) => {
  const {session} = await createOwner(page, "Profile Fictional Owner");
  await installSession(page, session);
  await open(page, "/profile");
  await page.getByRole("button", {name: "Edit profile", exact: true}).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Full name").fill("Updated Fictional Owner");
  await drawer.getByLabel("Phone (optional)").fill("1234567890");
  await drawer.getByRole("button", {name: "Save profile", exact: true}).click();
  await expect(drawer).not.toBeVisible();
  await page.evaluate(key => localStorage.removeItem(key), `maatru-care-demo-local-settings:${session.user.id}`);
  await open(page, "/settings");
  await expect(page.locator("main")).toContainText("1234567890");
  await page.getByLabel("Preferred language for future coordination").selectOption("Hindi");
  const dark = page.getByRole("switch", {name: "Dark mode", exact: true});
  await dark.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByLabel("Preferred language for future coordination")).toHaveValue("Hindi");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await dark.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await open(page, "/journey");
  let phaseTaskReads = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/tasks") phaseTaskReads++; });
  await page.getByRole("button", {name: "Postnatal", exact: true}).click();
  await page.getByRole("button", {name: "Save as my current phase", exact: true}).click();
  await expect(page.locator("main")).toContainText("Saved phase: Postnatal");
  await page.waitForTimeout(500);
  console.log(`Journey save task refresh requests: ${phaseTaskReads}`);
  expect(phaseTaskReads).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(page.locator("main")).toContainText("Saved phase: Postnatal");
  await open(page, "/dashboard");
  await expect(page.getByRole("heading", {name: "Welcome, Updated", exact: true})).toBeVisible();
});

test("appointment creation, editing, journey summary and cancellation", async ({page}) => {
  const {session} = await createOwner(page);
  await installSession(page, session);
  await open(page, "/appointments");
  const opener = page.getByRole("button", {name: "Add appointment", exact: true});
  await opener.click();
  let drawer = page.getByRole("dialog");
  await drawer.getByLabel("Title", {exact: true}).fill("Fictional planning visit");
  await drawer.getByLabel("Clinician", {exact: true}).fill("Fictional clinician");
  await drawer.getByLabel("Location", {exact: true}).fill("Fictional clinic");
  await drawer.getByLabel("Date", {exact: true}).fill("2030-01-01");
  await drawer.getByLabel("Local time", {exact: true}).fill("10:30");
  await drawer.getByRole("button", {name: "Create appointment", exact: true}).click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole("button", {name: "Edit", exact: true}).click();
  drawer = page.getByRole("dialog");
  await drawer.getByLabel("Title", {exact: true}).fill("Updated fictional visit");
  await drawer.getByRole("button", {name: "Save changes", exact: true}).click();
  await expect(drawer).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", {name: "Updated fictional visit", exact: true})).toBeVisible();
  await open(page, "/journey");
  await expect(page.locator("main")).toContainText("Updated fictional visit");
  await open(page, "/appointments");
  await page.getByRole("button", {name: "Cancel", exact: true}).click();
  await page.getByRole("button", {name: "Confirm cancel", exact: true}).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.locator("main")).toContainText("Cancelled");
});

test("AI task suggestions require human approval and use real task persistence", async ({page}) => {
  const {session, account} = await createOwner(page);
  await installSession(page, session);
  await open(page, "/ai-assist");
  await page.getByRole("button", {name: "Extract tasks", exact: true}).click();
  await page.getByLabel("Your coordination note").fill("Fictional coordination note: Prepare the fictional folder for the visit.");
  const prepare = page.getByRole("button", {name: "Prepare draft", exact: true});
  await expect(prepare).toBeDisabled();
  await page.getByRole("checkbox", {name: /This note is fictional or de-identified/}).check();
  await prepare.click();
  await expect(page.getByLabel("Task title", {exact: true})).toHaveValue("Prepare fictional folder", {timeout: 30000});
  const list = async () => {
    const response = await page.request.get(`http://127.0.0.1:18010/api/tasks?actor_caregiver_id=${account.caregiver_id}`, {headers: {Authorization: `Bearer ${session.access_token}`}});
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  expect(await list()).toHaveLength(0);
  await page.getByLabel("Assign to", {exact: true}).selectOption(`patient:${account.patient_id}`);
  await page.getByLabel("Due date", {exact: true}).fill("2030-01-01");
  await page.getByRole("button", {name: "Approve & create task", exact: true}).click();
  await expect(page.getByText("Task created", {exact: true})).toBeVisible();
  expect(await list()).toHaveLength(1);
  await open(page, "/tasks");
  await expect(page.getByRole("button", {name: "Prepare fictional folder", exact: true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", {name: "Prepare fictional folder", exact: true})).toBeVisible();
  await open(page, "/ai-assist");
  await page.getByRole("button", {name: "Check saved records", exact: true}).click();
  await expect(page.locator("main")).toContainText("Prepare fictional folder");
});

test("AI provider failure keeps tasks unchanged and allows another attempt", async ({page}) => {
  const {session} = await createOwner(page);
  await installSession(page, session);
  await open(page, "/ai-assist");
  await page.getByRole("button", {name: "Summarize notes", exact: true}).click();
  await page.getByRole("button", {name: "Use fictional example", exact: true}).click();
  await page.getByRole("checkbox", {name: /This note is fictional or de-identified/}).check();
  const prepare = page.getByRole("button", {name: "Prepare draft", exact: true});
  await prepare.click();
  await expect(page.getByRole("alert").filter({hasText: /AI|unavailable|completed/i})).toBeVisible();
  await expect(prepare).toBeEnabled();
  await open(page, "/tasks");
  await expect(page.getByRole("button", {name: /^Complete /})).toHaveCount(0);
});

test("drawers contain keyboard focus and restore it after Escape", async ({page}) => {
  const {session} = await createOwner(page);
  await installSession(page, session);
  await page.setViewportSize({width: 375, height: 812});
  await open(page, "/care-circle");
  const invite = page.getByRole("button", {name: "Invite caregiver", exact: true});
  await invite.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByLabel("Name", {exact: true})).toBeFocused();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.querySelector("dialog")?.contains(document.activeElement))).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(invite).toBeFocused();
});

test("Google login constructs a same-origin callback with PKCE", async ({page}) => {
  let destination = "";
  await page.route("http://localhost:18010/auth/v1/authorize?**", route => {
    destination = route.request().url();
    return route.fulfill({status: 200, contentType: "text/plain", body: "Isolated provider navigation check"});
  });
  await page.goto("/sign-in?next=%2Fcare-circle");
  await page.getByRole("button", {name: /Google/}).click();
  await expect.poll(() => destination).not.toBe("");
  const url = new URL(destination);
  expect(url.searchParams.get("provider")).toBe("google");
  const callback = new URL(url.searchParams.get("redirect_to") || "");
  expect(callback.origin).toBe("http://localhost:3100");
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("next")).toBe("/care-circle");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});

test("an invited authenticated caregiver joins and completes their own real handoff", async ({page}) => {
  const owner = await createOwner(page, "Fictional Care Circle Owner");
  const recipientResponse = await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true");
  const recipientSession = await recipientResponse.json();
  const headers = {Authorization: `Bearer ${owner.session.access_token}`};
  const invitation = await page.request.post("http://127.0.0.1:18010/api/auth/invitations", {headers, data: {email: recipientSession.user.email, name: "Fictional Recipient", relationship: "Friend"}});
  expect(invitation.ok()).toBeTruthy();
  await installSession(page, recipientSession);
  await page.goto(`/onboarding?invitation=${encodeURIComponent((await invitation.json()).token)}`);
  await page.getByLabel("Full name", {exact: true}).fill("Fictional Recipient");
  await page.getByRole("button", {name: "Accept invitation", exact: true}).click();
  await page.waitForURL("**/dashboard");
  const members = await page.request.get(`http://127.0.0.1:18010/api/caregivers?actor_caregiver_id=${owner.account.caregiver_id}`, {headers});
  const recipient = (await members.json()).find((member: {name: string}) => member.name === "Fictional Recipient");
  expect(recipient).toBeTruthy();
  expect(recipient.is_demo).toBe(false);
  const permission = await page.request.put("http://127.0.0.1:18010/api/permissions", {headers, data: {patient_id: owner.account.patient_id, actor_caregiver_id: owner.account.caregiver_id, caregiver_id: recipient.id, permission_name: "Care handoffs", enabled: true}});
  expect(permission.ok()).toBeTruthy();
  const created = await page.request.post("http://127.0.0.1:18010/api/handoffs", {headers, data: {patient_id: owner.account.patient_id, actor_caregiver_id: owner.account.caregiver_id, from_caregiver_id: owner.account.caregiver_id, to_caregiver_id: recipient.id, title: "Fictional recipient responsibility", reason: "Organize the fictional visit folder"}});
  expect(created.ok()).toBeTruthy();
  const handoffId = (await created.json()).id;
  expect((await page.request.post(`http://127.0.0.1:18010/api/handoffs/${handoffId}/send`, {headers, data: {actor_caregiver_id: owner.account.caregiver_id}})).ok()).toBeTruthy();
  await open(page, "/handoffs");
  await page.getByRole("button", {name: "Acknowledge", exact: true}).click();
  await page.getByRole("button", {name: "Complete handoff", exact: true}).click();
  await page.reload();
  await expect(page.getByRole("list", {name: "Handoff progress"}).getByText("Completed", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: /simulation/})).toHaveCount(0);
});
