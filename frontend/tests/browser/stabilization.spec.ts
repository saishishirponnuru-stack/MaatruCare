import {expect, test} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";
import {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";

const note = "Fictional coordination note: Prepare the fictional folder for the visit.";

test("planner draft edits approve and persist independently of task proposals", async ({page}) => {
  const {session, account} = await createOwner(page);
  await installSession(page, session);
  await open(page, "/ai-assist?tool=care_plan");
  await page.getByLabel("Your coordination note").fill(note);
  await page.getByRole("checkbox", {name: /This note is fictional/}).check();
  await page.getByRole("button", {name: "Prepare draft", exact: true}).click();
  await expect(page.getByLabel("Task title", {exact: true})).toHaveValue("Prepare fictional folder", {timeout: 30000});
  console.log(JSON.stringify({approval_reproduction: {
    editable_text: await page.getByLabel("Editable draft").inputValue(),
    approve_disabled: await page.getByRole("button", {name: "Approve draft", exact: true}).isDisabled(),
  }}));
  await expect(page.getByLabel("Editable draft")).toHaveValue("Prepare the fictional folder for the visit.");
  await page.getByLabel("Editable draft").fill("Prepare the fictional folder; confirm the pickup location.");
  const review = page.waitForResponse(r => /\/api\/ai\/drafts\/\d+\/review$/.test(new URL(r.url()).pathname));
  await page.getByRole("button", {name: "Approve draft", exact: true}).click();
  const response = await review;
  expect(response.status()).toBe(200);
  const saved = await response.json();
  expect(saved.status).toBe("Approved");
  expect(saved.output.summary).toBe("Prepare the fictional folder; confirm the pickup location.");
  await expect(page.getByLabel("Editable draft")).toHaveValue(saved.output.summary);
  const headers = {Authorization: `Bearer ${session.access_token}`};
  const tasks = await page.request.get(`http://127.0.0.1:18010/api/tasks?actor_caregiver_id=${account.caregiver_id}`, {headers});
  expect(await tasks.json()).toHaveLength(0);
  await page.reload();
  await page.getByRole("button", {name: /AI Care Planner.*Approved/}).click();
  await expect(page.getByLabel("Editable draft")).toHaveValue(saved.output.summary);
  await expect(page.getByRole("button", {name: "Approve & create task", exact: true})).toBeEnabled();
});

test("stabilization performance profile", async ({page}) => {
  test.setTimeout(180000);
  const {session, account} = await createOwner(page);
  const headers = {Authorization: `Bearer ${session.access_token}`};
  expect((await page.request.post("http://127.0.0.1:18010/api/tasks", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, owner_patient_id: account.patient_id,
    title: "Existing fictional logistics", due_date: "2030-01-01", category: "Coordination",
  }})).ok()).toBeTruthy();
  await installSession(page, session);
  const reads: {path: string; method: string; started: number; duration?: number}[] = [];
  const pending = new Map<object, typeof reads[number]>();
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.port !== "18010" || !url.pathname.startsWith("/api/")) return;
    const item = {path: url.pathname, method: request.method(), started: Date.now()};
    reads.push(item); pending.set(request, item);
  });
  page.on("requestfinished", request => {const item = pending.get(request); if (item) item.duration = Date.now() - item.started;});
  const started = Date.now();
  await open(page, "/dashboard");
  await expect(page.getByRole("region", {name: "Care Pulse", exact: true})).toContainText("Existing fictional logistics");
  await expect(page.getByLabel("Coordination measures time range")).toBeEnabled();
  await expect(page.getByText("Pending responsibilities", {exact: true})).toBeVisible();
  await expect(page.getByText("Loading measures...", {exact: true})).toHaveCount(0);
  const dashboardMs = Date.now() - started;
  const initial = [...reads]; reads.length = 0;
  await page.getByLabel("Coordination measures time range").selectOption("7");
  await expect.poll(() => reads.filter(item => item.path === "/api/analytics" && item.duration != null).length).toBe(1);
  const rangeReads = [...reads];
  const navigation = [];
  for (const [label, route] of [["AI Assist", "/ai-assist"], ["Handoffs", "/handoffs"], ["Tasks", "/tasks"], ["Care Circle", "/care-circle"], ["Home", "/dashboard"], ["AI Assist", "/ai-assist"]]) {
    const before = reads.length; const start = Date.now();
    await page.getByRole("link", {name: label, exact: true}).first().click();
    await page.waitForURL(`**${route}`);
    await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
    navigation.push({route, ms: Date.now() - start, api_requests: reads.slice(before).map(item => item.path)});
  }
  await page.getByRole("button", {name: "AI Care Planner", exact: true}).click();
  await expect(page.getByRole("button", {name: "Organize this week", exact: true})).toBeEnabled();
  await page.getByLabel("Your coordination note").fill(note);
  await page.getByRole("checkbox", {name: /This note is fictional/}).check();
  await page.getByRole("button", {name: "Prepare draft", exact: true}).click();
  await expect(page.getByLabel("Task title", {exact: true})).toHaveValue("Prepare fictional folder", {timeout: 30000});
  await page.getByLabel("Assign to", {exact: true}).selectOption(`patient:${account.patient_id}`);
  await page.getByLabel("Due date", {exact: true}).fill("2030-01-01");
  reads.length = 0; const saving = Date.now();
  await page.getByRole("button", {name: "Approve & create task", exact: true}).click();
  await expect(page.getByText("Task created", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Organize this week", exact: true})).toBeEnabled();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  const report = {mode: process.env.MAATRUCARE_BROWSER_MODE || "production", dashboard_ms: dashboardMs,
    initial_api_requests: initial, range_change_requests: rangeReads, navigation,
    task_save_ms: Date.now() - saving, task_save_requests: reads};
  const directory = path.resolve("../docs/performance"); mkdirSync(directory, {recursive: true});
  writeFileSync(path.join(directory, `${process.env.STABILIZATION_LABEL || "stabilization-profile"}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});

async function readyDraft(page: Parameters<typeof open>[0]) {
  const who = await createOwner(page);
  await installSession(page, who.session);
  await open(page, "/ai-assist?tool=care_plan");
  await page.getByLabel("Your coordination note").fill(note);
  await page.getByRole("checkbox", {name: /This note is fictional/}).check();
  await page.getByRole("button", {name: "Prepare draft", exact: true}).click();
  await expect(page.getByLabel("Task title", {exact: true})).toHaveValue("Prepare fictional folder", {timeout: 30000});
  return who;
}

test("failed review displays a nearby error, preserves edits, and retries honestly on mobile", async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await readyDraft(page);
  await page.getByLabel("Editable draft").fill("Confirm the fictional folder and pickup.");
  await page.route("**/api/ai/drafts/*/review", route => route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({detail: "Review service temporarily unavailable. Try again."})}));
  const actions = page.getByTestId("draft-review-actions");
  await actions.getByRole("button", {name: "Approve draft", exact: true}).click();
  await expect(actions.getByRole("alert")).toContainText("temporarily unavailable");
  await expect(actions.getByRole("alert")).toBeInViewport();
  await expect(page.getByLabel("Editable draft")).toHaveValue("Confirm the fictional folder and pickup.");
  await expect(actions.getByRole("button", {name: "Approve draft", exact: true})).toBeEnabled();
  await page.unroute("**/api/ai/drafts/*/review");
  await actions.getByRole("button", {name: "Approve draft", exact: true}).click();
  await expect(actions.getByRole("button", {name: "Draft approved", exact: true})).toBeDisabled();
  await expect(actions.getByRole("status")).toContainText("Draft approved");
});

test("duplicate approval clicks issue one review and one individually approved task", async ({page}) => {
  const who = await readyDraft(page);
  let reviews = 0; let releaseReview: () => void = () => {};
  const gate = new Promise<void>(resolve => {releaseReview = resolve;});
  await page.route("**/api/ai/drafts/*/review", async route => {reviews++; await gate; await route.continue();});
  await page.getByRole("button", {name: "Approve draft", exact: true}).click({clickCount: 2});
  await expect(page.getByRole("button", {name: "Approving draft…", exact: true})).toBeDisabled();
  await expect(page.getByLabel("Editable draft")).toBeDisabled();
  releaseReview();
  await expect(page.getByRole("button", {name: "Draft approved", exact: true})).toBeDisabled();
  expect(reviews).toBe(1);
  await page.getByLabel("Task title", {exact: true}).fill("Reviewed fictional folder");
  await page.getByLabel("Assign to", {exact: true}).selectOption(`patient:${who.account.patient_id}`);
  await page.getByLabel("Due date", {exact: true}).fill("2030-01-01");
  let tasks = 0;
  page.on("request", r => {if (new URL(r.url()).pathname === "/api/tasks" && r.method() === "POST") tasks++;});
  await page.getByRole("button", {name: "Approve & create task", exact: true}).click({clickCount: 2});
  await expect(page.getByText("Task created", {exact: true})).toBeVisible();
  await expect(page.getByText("Reviewed fictional folder", {exact: true})).toBeVisible();
  expect(tasks).toBe(1);
});

test("individual proposal rejection and whole draft rejection survive reload", async ({page}) => {
  await readyDraft(page);
  await page.getByRole("button", {name: "Reject", exact: true}).click();
  await expect(page.getByText("Suggestion rejected", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Approve & create task", exact: true})).toHaveCount(0);
  await page.getByRole("button", {name: "Reject draft", exact: true}).click();
  await expect(page.getByTestId("draft-review-actions").getByRole("button", {name: "Draft rejected", exact: true})).toBeDisabled();
  await page.reload();
  await page.getByRole("button", {name: /AI Care Planner.*Rejected/}).click();
  await expect(page.getByRole("button", {name: "Approve & create task", exact: true})).toHaveCount(0);
});

test("all AI tools retain distinct reviewed outputs and approved handoff integration", async ({page, context}) => {
  test.setTimeout(90000);
  const {session, account} = await createOwner(page, "Fictional Tools Owner", true);
  const member = await page.request.post("http://127.0.0.1:18010/api/caregivers/demo", {headers: {Authorization: `Bearer ${session.access_token}`}, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, role: "Support caregiver", name: "Fictional AI Receiver", relationship: "Friend", coordination_access: true,
  }});
  expect(member.ok()).toBeTruthy(); const caregiver = await member.json();
  await installSession(page, session); await open(page, "/ai-assist");
  for (const tool of ["Summarize notes", "Extract tasks", "Prepare appointment", "Draft handoff", "Draft care update", "Organize meal notes"]) {
    await page.getByRole("button", {name: tool, exact: true}).click();
    await page.getByLabel("Your coordination note").fill(note);
    await page.getByRole("checkbox", {name: /This note is fictional/}).check();
    await page.getByRole("button", {name: "Prepare draft", exact: true}).click();
    await expect(page.getByLabel("Editable draft")).toHaveValue("Prepare the fictional folder for the visit.", {timeout: 30000});
    await page.getByRole("button", {name: "Approve draft", exact: true}).click();
    await expect(page.getByRole("button", {name: "Draft approved", exact: true})).toBeDisabled();
    if (tool === "Draft handoff") {
      await page.getByLabel("Receiving caregiver").selectOption(String(caregiver.id));
      await page.getByRole("button", {name: "Approve & create handoff", exact: true}).click();
      await expect(page.getByRole("status").filter({hasText: "Approved handoff created"})).toBeVisible();
    }
    if (tool === "Draft care update") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", {name: "Copy approved update", exact: true}).click();
      await expect(page.getByRole("status").filter({hasText: "No message was sent"})).toBeVisible();
    }
  }
  const list = await page.request.get(`http://127.0.0.1:18010/api/handoffs?actor_caregiver_id=${account.caregiver_id}`, {headers: {Authorization: `Bearer ${session.access_token}`}});
  expect(list.ok()).toBeTruthy(); expect(await list.json()).toHaveLength(1);
});

test("handoff story contains long names at narrow widths without hidden text overflow", async ({page}) => {
  const {session, account} = await createOwner(page, "Fictional Story Layout", true);
  const headers = {Authorization: `Bearer ${session.access_token}`};
  const response = await page.request.post("http://127.0.0.1:18010/api/caregivers/demo", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, role: "Support caregiver", name: "Fictional" + "X".repeat(170), relationship: "Friend", coordination_access: true,
  }});
  expect(response.ok()).toBeTruthy(); const member = await response.json();
  expect((await page.request.post("http://127.0.0.1:18010/api/handoffs", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, from_caregiver_id: account.caregiver_id, to_caregiver_id: member.id,
    title: "Fictional narrow story", reason: "Prepare the fictional folder.",
  }})).ok()).toBeTruthy();
  await installSession(page, session); await page.setViewportSize({width: 375, height: 812}); await open(page, "/handoffs");
  const story = page.getByRole("region", {name: "Care Coordination Story", exact: true});
  expect(await story.evaluate(element => [...element.querySelectorAll("p,li,h3")].filter(item => item.scrollWidth > item.clientWidth + 1).length)).toBe(0);
});
