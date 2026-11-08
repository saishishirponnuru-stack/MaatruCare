import {expect, test} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";
import path from "node:path";

const note = "Fictional coordination note: Prepare the fictional folder for the visit.";
const edited = "Prepare the fictional folder, then confirm the pickup location.";

async function planner(page: Parameters<typeof open>[0]) {
  const who = await createOwner(page, "Fictional Patch Owner");
  await installSession(page, who.session);
  await open(page, "/ai-assist?tool=care_plan");
  await page.getByLabel("Your coordination note").fill(note);
  await page.getByRole("checkbox", {name: /This note is fictional/}).check();
  await page.getByRole("button", {name: "Prepare draft", exact: true}).click();
  await expect(page.getByLabel("Editable draft")).toHaveValue("Prepare the fictional folder for the visit.");
  return who;
}

for (const decision of ["approve", "reject"]) {
  test(`individual task ${decision} preserves a separate unsaved draft edit`, async ({page}) => {
    const who = await planner(page);
    await page.getByLabel("Editable draft").fill(edited);
    if (decision === "approve") {
      await page.getByLabel("Assign to", {exact: true}).selectOption(`patient:${who.account.patient_id}`);
      await page.getByLabel("Due date", {exact: true}).fill("2030-01-01");
      await page.getByRole("button", {name: "Approve & create task", exact: true}).click();
      await expect(page.getByText("Task created", {exact: true})).toBeVisible();
    } else {
      await page.getByRole("button", {name: "Reject", exact: true}).click();
      await expect(page.getByText("Suggestion rejected", {exact: true})).toBeVisible();
    }
    console.log(JSON.stringify({task_review:decision, editor_after:await page.getByLabel("Editable draft").inputValue()}));
    await expect(page.getByLabel("Editable draft")).toHaveValue(edited);
    await expect(page.getByRole("button", {name: "Approve draft", exact: true})).toBeEnabled();
    const approval = page.waitForResponse(r => r.request().method()==="POST" && /\/api\/ai\/drafts\/\d+\/review$/.test(new URL(r.url()).pathname));
    await page.getByRole("button", {name: "Approve draft", exact: true}).click();
    expect((await approval).status()).toBe(200);
    await page.reload();
    await page.getByRole("button", {name:/AI Care Planner.*Approved/}).click();
    await expect(page.getByLabel("Editable draft")).toHaveValue(edited);
  });
}

test("failed draft reload after task save keeps the actual saved task and prevents repeat submissions", async ({page}) => {
  const who = await planner(page);
  const headers = {Authorization:`Bearer ${who.session.access_token}`};
  await page.getByLabel("Editable draft").fill(edited);
  await page.getByLabel("Task title", {exact: true}).fill("Persisted fictional task");
  await page.getByLabel("Assign to", {exact: true}).selectOption(`patient:${who.account.patient_id}`);
  await page.getByLabel("Due date", {exact: true}).fill("2030-01-01");
  let writes = 0;
  page.on("request", r => {if(r.method()==="POST" && new URL(r.url()).pathname==="/api/tasks") writes++;});
  await page.route("**/api/ai/drafts/*", route => /\/api\/ai\/drafts\/\d+$/.test(new URL(route.request().url()).pathname)
    ? route.fulfill({status:503, contentType:"application/json", body:JSON.stringify({detail:"Synthetic draft refresh failure"})})
    : route.continue());
  await page.getByRole("button", {name:"Approve & create task", exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Task was saved"})).toBeVisible();
  const persisted = await page.request.get(`http://127.0.0.1:18010/api/tasks?actor_caregiver_id=${who.account.caregiver_id}`,{headers});
  expect((await persisted.json()).filter((item:{title:string})=>item.title==="Persisted fictional task")).toHaveLength(1);
  console.log(JSON.stringify({persisted_task_writes:writes, repeat_save_controls:await page.getByRole("button",{name:"Approve & create task",exact:true}).count()}));
  await expect(page.getByText("Task created",{exact:true})).toBeVisible();
  await expect(page.getByText("Persisted fictional task",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Approve & create task",exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Editable draft")).toHaveValue(edited);
  expect(writes).toBe(1);
  await page.unroute("**/api/ai/drafts/*");
  await page.reload();
  await page.getByRole("button",{name:/AI Care Planner.*Approved/}).click();
  await expect(page.getByText("Task created",{exact:true})).toBeVisible();
});

test("planning context keeps long appointment text readable at mobile widths in both themes", async ({page}) => {
  const who = await createOwner(page, "Fictional Layout Owner");
  const title = "Fictional"+"V".repeat(170);
  const result = await page.request.post("http://127.0.0.1:18010/api/appointments",{headers:{Authorization:`Bearer ${who.session.access_token}`},data:{patient_id:who.account.patient_id,actor_caregiver_id:who.account.caregiver_id,title,clinician_name:"Fictional clinician",location:"Fictional clinic",appointment_date:"2030-01-01",appointment_time:"10:30"}});
  expect(result.status()).toBe(201);
  await installSession(page,who.session);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:375,height:812});
  await open(page,"/ai-assist?tool=care_plan");
  await expect(page.getByRole("button",{name:"Organize this week",exact:true})).toBeEnabled();
  for(const theme of ["dark","light"]) {
    if(theme==="light")await page.getByRole("button",{name:"Switch to light mode",exact:true}).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
    const text = page.locator("p").filter({hasText:title});
    await expect(text).toBeVisible();
    const dimensions = await text.evaluate(element=>({scroll:element.scrollWidth,width:element.clientWidth,viewport:innerWidth,right:element.getBoundingClientRect().right}));
    console.log(JSON.stringify({planner_theme:theme,...dimensions}));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+1);
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport+1);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    await page.screenshot({path:path.resolve(`../docs/review/postrelease-planner-${theme}.png`),fullPage:true,animations:"disabled"});
  }
});

test("dashboard uses the browser calendar across a date boundary without hydration errors", async ({page}) => {
  const who=await createOwner(page,"Fictional Calendar Owner");
  await installSession(page,who.session);
  await page.clock.install({time:new Date("2025-01-01T23:30:00Z")});
  await open(page,"/dashboard");
  const date=await page.evaluate(()=>new Date().toLocaleDateString("en-IN",{weekday:"long",month:"long",day:"numeric"}));
  await expect(page.getByText(date,{exact:true})).toBeVisible();
});

test("a confirmed task is visible while draft refresh is pending and navigation remains responsive", async ({page}) => {
  const who=await planner(page);
  await page.getByLabel("Assign to",{exact:true}).selectOption(`patient:${who.account.patient_id}`);
  await page.getByLabel("Due date",{exact:true}).fill("2030-01-01");
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/ai/drafts/*",async route=>{
    if(/\/api\/ai\/drafts\/\d+$/.test(new URL(route.request().url()).pathname))await gate;
    await route.continue();
  });
  try {
    const saved=page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/tasks");
    await page.getByRole("button",{name:"Approve & create task",exact:true}).click();
    expect((await saved).status()).toBe(201);
    const acknowledged=Date.now();
    await expect(page.getByText("Task created",{exact:true})).toBeVisible();
    const feedbackMs=Date.now()-acknowledged;
    const started=Date.now();
    await page.getByRole("link",{name:"Handoffs",exact:true}).first().click();
    await expect(page).toHaveURL(/\/handoffs$/);
    await expect(page.locator("main")).toHaveAttribute("aria-busy","false");
    console.log(JSON.stringify({pending_read_does_not_block_saved_feedback_ms:feedbackMs,navigation_during_pending_read_ms:Date.now()-started}));
  } finally {release();}
});

test("all sharing categories synchronize and removing a simulated caregiver preserves a real member", async ({page}) => {
  const who=await createOwner(page,"Fictional Sharing Owner",true);
  const headers={Authorization:`Bearer ${who.session.access_token}`};
  const session=await (await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true")).json();
  const invitation=await page.request.post("http://127.0.0.1:18010/api/auth/invitations",{headers,data:{email:session.user.email,name:"Fictional Retained",relationship:"Friend"}});
  expect(invitation.status()).toBe(201);
  const acceptance=await page.request.post(`http://127.0.0.1:18010/api/auth/invitations/${(await invitation.json()).token}/accept`,{headers:{Authorization:`Bearer ${session.access_token}`}});
  expect(acceptance.status()).toBe(200);
  const added=await page.request.post("http://127.0.0.1:18010/api/caregivers/demo",{headers,data:{patient_id:who.account.patient_id,actor_caregiver_id:who.account.caregiver_id,name:"Fictional Removable",relationship:"Friend",role:"Support caregiver",coordination_access:false}});
  expect(added.status()).toBe(201);
  await installSession(page,who.session);await open(page,"/care-circle");
  await page.getByRole("button",{name:"Manage Fictional Removable, Friend",exact:true}).click();
  for(const category of ["Appointments","Coordination tasks","Care handoffs","Approved care updates"]) {
    const control=page.getByRole("switch",{name:`${category} for Fictional Removable`,exact:true});
    await expect(control).toHaveAttribute("aria-checked","false");await control.click();
    await expect(control).toBeEnabled();await expect(control).toHaveAttribute("aria-checked","true");
  }
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  await open(page,"/consent");
  await page.getByRole("button",{name:/Fictional Removable/}).click();
  await expect(page.getByRole("switch")).toHaveCount(4);
  for(const control of await page.getByRole("switch").all())await expect(control).toHaveAttribute("aria-checked","true");
  await page.reload();await page.getByRole("button",{name:/Fictional Removable/}).click();
  for(const control of await page.getByRole("switch").all())await expect(control).toHaveAttribute("aria-checked","true");
  await open(page,"/care-circle");
  await page.getByRole("button",{name:"Manage Fictional Removable, Friend",exact:true}).click();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Remove caregiver",exact:true}).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Manage Fictional Removable, Friend",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Manage Fictional Retained, Friend",exact:true})).toBeVisible();
  const current=await page.request.get("http://127.0.0.1:18010/api/auth/me",{headers:{Authorization:`Bearer ${session.access_token}`}});
  expect(current.status()).toBe(200);expect((await current.json()).patient_id).toBe(who.account.patient_id);
});

test("closed mobile navigation does not leave a disabled backdrop dimming the page", async ({page}) => {
  const who=await createOwner(page,"Fictional Navigation Owner");
  await installSession(page,who.session);await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:375,height:812});await open(page,"/dashboard");
  const overlay=page.locator('button[aria-label="Close navigation overlay"]');
  const hidden=async()=>overlay.evaluate(element=>{const style=getComputedStyle(element);return style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0;});
  console.log(JSON.stringify({closed_mobile_backdrop:await overlay.evaluate(element=>({disabled:element.matches(":disabled"),opacity:getComputedStyle(element).opacity}))}));
  expect(await hidden()).toBe(true);
  await page.getByRole("button",{name:"Open navigation",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Mobile navigation",exact:true})).toBeVisible();
  expect(await hidden()).toBe(false);
  await page.keyboard.press("Escape");
  await expect.poll(hidden).toBe(true);
  await expect(page.getByRole("button",{name:"Open navigation",exact:true})).toBeFocused();
});
