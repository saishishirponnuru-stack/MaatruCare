import path from "node:path";
import {expect, test} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";

test("Care Pulse and planner reflect approved tasks and isolate a new account", async ({page, browser}) => {
  const {session, account} = await createOwner(page, "Fictional Planner Owner");
  await installSession(page, session);
  await open(page, "/dashboard");
  const pulse = page.getByRole("region", {name: "Care Pulse", exact: true});
  await expect(pulse).toContainText("Your care journey starts here");
  const headers = {Authorization: `Bearer ${session.access_token}`};
  const task = await page.request.post("http://127.0.0.1:18010/api/tasks", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id,
    owner_patient_id: account.patient_id, title: "Existing fictional responsibility", due_date: "2020-01-01", category: "Coordination",
  }});
  expect(task.ok()).toBeTruthy();
  const taskId = (await task.json()).id;
  const visit = await page.request.post("http://127.0.0.1:18010/api/appointments", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, title: "Fictional future visit",
    clinician_name: "Fictional clinician", location: "Fictional clinic", appointment_date: "2030-01-02", appointment_time: "10:30",
  }});
  expect(visit.ok()).toBeTruthy();
  await page.reload();
  await expect(pulse.getByTestId("pulse-overdue")).toHaveText("1 overdue task");
  await expect(pulse).toContainText("Fictional future visit");
  await pulse.getByRole("link", {name: "Open AI Care Planner", exact: true}).click();
  await expect(page.getByRole("heading", {name: "AI Care Planner", exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Organize this week", exact: true})).toBeEnabled();
  await page.getByRole("button", {name: "Prepare for my next visit", exact: true}).click();
  const note = page.getByLabel("Your coordination note");
  await expect(note).toContainText("2030-01-02");
  expect(await note.inputValue()).not.toContain("Fictional future visit");
  expect(await note.inputValue()).not.toContain("Existing fictional responsibility");
  await note.fill("Fictional coordination note: Prepare the fictional folder for the visit.");
  await page.getByRole("checkbox", {name: /This note is fictional or de-identified/}).check();
  await page.getByRole("button", {name: "Prepare draft", exact: true}).click();
  await expect(page.getByLabel("Task title", {exact: true})).toHaveValue("Prepare fictional folder", {timeout: 30000});
  await page.getByLabel("Assign to", {exact: true}).selectOption(`patient:${account.patient_id}`);
  await page.getByLabel("Due date", {exact: true}).fill("2030-01-01");
  await page.getByRole("button", {name: "Approve & create task", exact: true}).click();
  await expect(page.getByText("Task created", {exact: true})).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("button", {name: "Organize this week", exact: true})).toBeEnabled();
  await expect(page.getByRole("button", {name: "Prepare draft", exact: true})).toBeEnabled();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({path: path.resolve("../docs/review/ai-care-planner-desktop.png"), fullPage: true});
  await page.setViewportSize({width: 375, height: 812});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path: path.resolve("../docs/review/ai-care-planner-mobile.png"), fullPage: true});
  await page.setViewportSize({width: 1440, height: 1000});
  await open(page, "/dashboard");
  await expect(pulse).toContainText("Prepare fictional folder");
  const complete = await page.request.post(`http://127.0.0.1:18010/api/tasks/${taskId}/complete`, {headers, data: {actor_caregiver_id: account.caregiver_id, completed: true}});
  expect(complete.ok()).toBeTruthy();
  await page.reload();
  await expect(pulse.getByTestId("pulse-overdue")).toHaveText("0 overdue tasks");
  await page.screenshot({path: path.resolve("../docs/review/care-pulse-desktop.png"), fullPage: true});
  await page.setViewportSize({width: 375, height: 812});
  await expect(pulse.getByRole("link", {name: "Open AI Care Planner", exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    const other = await createOwner(otherPage, "Other fictional owner");
    await installSession(otherPage, other.session);
    await open(otherPage, "/dashboard");
    await expect(otherPage.getByRole("region", {name: "Care Pulse", exact: true})).toContainText("Your care journey starts here");
    await expect(otherPage.locator("main")).not.toContainText("Prepare fictional folder");
  } finally { await otherContext.close(); }
});

test("Care Coordination Story follows actual simulation transitions and linked task state", async ({page}) => {
  const {session, account} = await createOwner(page, "Fictional Story Owner", true);
  const headers = {Authorization: `Bearer ${session.access_token}`};
  const memberResponse = await page.request.post("http://127.0.0.1:18010/api/caregivers/demo", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, role: "Support caregiver",
    name: "Fictional Story Caregiver", relationship: "Friend", coordination_access: true,
  }});
  expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy();
  const member = await memberResponse.json();
  const taskResponse = await page.request.post("http://127.0.0.1:18010/api/tasks", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, owner_id: member.id,
    title: "Linked fictional responsibility", due_date: "2030-01-01", category: "Coordination",
  }});
  expect(taskResponse.ok()).toBeTruthy();
  const task = await taskResponse.json();
  const created = await page.request.post("http://127.0.0.1:18010/api/handoffs", {headers, data: {
    patient_id: account.patient_id, actor_caregiver_id: account.caregiver_id, from_caregiver_id: account.caregiver_id,
    to_caregiver_id: member.id, title: "Fictional story transport", reason: "Confirm the fictional pickup.", related_task_id: task.id,
  }});
  expect(created.ok()).toBeTruthy();
  await installSession(page, session);
  await open(page, "/handoffs");
  const story = page.getByRole("region", {name: "Care Coordination Story", exact: true});
  await expect(story).toContainText("Linked fictional responsibility");
  await expect(story).toContainText("Open");
  await page.getByText("Inspect recorded activity", {exact: true}).click();
  await expect(story.getByRole("list", {name: "Recorded handoff activity"}).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", {name: "Send handoff", exact: true}).click();
  await expect(story).toContainText("Waiting for Fictional Story Caregiver");
  await page.getByRole("button", {name: "Acknowledge (simulation)", exact: true}).click();
  await expect(story.getByRole("list", {name: "Recorded handoff activity"}).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", {name: "Complete (simulation)", exact: true}).click();
  await expect(story).toContainText("The handoff is complete");
  await expect(story.getByRole("list", {name: "Recorded handoff activity"}).getByRole("listitem")).toHaveCount(4);
  await expect(story.getByRole("list", {name: "Recorded handoff activity"})).toContainText("Fictional Story Owner");
  await expect(story.getByRole("list", {name: "Recorded handoff activity"})).toContainText("Simulated");
  await page.reload();
  await expect(story).toContainText("The handoff is complete");
  await expect(story).toContainText("Linked fictional responsibility");
  await page.setViewportSize({width: 375, height: 812});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path: path.resolve("../docs/review/coordination-story-mobile.png"), fullPage: true});
  await open(page, "/dashboard");
  await expect(page.getByTestId("pulse-waiting")).toHaveText("0 awaiting acknowledgement");
});
