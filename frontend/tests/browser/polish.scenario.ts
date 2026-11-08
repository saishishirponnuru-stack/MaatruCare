import {test,expect} from "./fixtures";
import {createOwner,installSession,open} from "./helpers";

test("explicit fictional onboarding creates three unshared simulated members once",async({page})=>{
  const session=await(await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true")).json();
  await installSession(page,session);await page.goto("/onboarding");
  await expect(page.getByText(/Adds three fictional, simulated caregivers/)).toBeVisible();
  await page.getByLabel("Full name",{exact:true}).fill("Fictional Seeded Owner");
  await page.getByRole("checkbox",{name:/Create a fictional demonstration workspace/}).check();
  await page.getByRole("button",{name:"Continue to MaatruCare",exact:true}).click();
  await page.waitForURL("**/dashboard");await open(page,"/care-circle");
  for(const [name,relationship] of [["Ananya Rao","Partner"],["Meera Rao","Mother"],["Priya Sharma","Sister"]])await expect(page.getByRole("button",{name:`Manage ${name}, ${relationship}`,exact:true})).toBeVisible();
  const headers={Authorization:`Bearer ${session.access_token}`};
  const owner=await(await page.request.get("http://127.0.0.1:18010/api/auth/me",{headers})).json();
  const params=`patient_id=${owner.patient_id}&actor_caregiver_id=${owner.caregiver_id}`;
  const permissions=await(await page.request.get(`http://127.0.0.1:18010/api/permissions?${params}`,{headers})).json();
  expect(permissions.filter((p:{caregiver_id:number;enabled:boolean})=>p.caregiver_id!==owner.caregiver_id).every((p:{enabled:boolean})=>!p.enabled)).toBe(true);
  await page.reload();await expect(page.getByRole("button",{name:/^Manage .*?, /})).toHaveCount(3);
  await page.getByRole("button",{name:"Manage Ananya Rao, Partner",exact:true}).click();
  const sharing=page.getByRole("switch",{name:"Coordination tasks for Ananya Rao",exact:true});
  await expect(sharing).toHaveAttribute("aria-checked","false");await sharing.click();await expect(sharing).toHaveAttribute("aria-checked","true");
  await open(page,"/tasks");await page.getByRole("button",{name:"Add task",exact:true}).click();
  const drawer=page.getByRole("dialog");const assignee=drawer.getByLabel("Assign to",{exact:true});
  await expect(assignee).toContainText("Ananya Rao");
  const value=await assignee.locator("option").filter({hasText:"Ananya Rao"}).getAttribute("value");expect(value).toBeTruthy();
  await assignee.selectOption(value!);await drawer.getByLabel("Task title",{exact:true}).fill("Fictional seeded transport");
  await drawer.getByLabel("Due date",{exact:true}).fill("2030-01-01");
  await drawer.getByRole("button",{name:"Save task",exact:true}).click();await expect(drawer).toHaveCount(0);
  await page.reload();await expect(page.getByText("Fictional seeded transport",{exact:true})).toBeVisible();
});

test("confirmed local history reset clears entries once and preserves goals and tasks",async({page})=>{
  const {session,account}=await createOwner(page);const headers={Authorization:`Bearer ${session.access_token}`};
  const identity={patient_id:account.patient_id,actor_caregiver_id:account.caregiver_id};
  const water=await page.request.post("http://127.0.0.1:18010/api/lifestyle/water",{headers,data:{...identity,log_date:"2030-01-01",quantity_ml:250,status:"Adequate"}});expect(water.ok()).toBeTruthy();
  const goal=await page.request.post("http://127.0.0.1:18010/api/lifestyle/diet/recommendations",{headers,data:{...identity,title:"Fictional preserved goal",instructions:"Personal notes only",start_date:"2030-01-01"}});expect(goal.ok()).toBeTruthy();
  const meal=await page.request.post("http://127.0.0.1:18010/api/lifestyle/nutrition",{headers,data:{...identity,log_date:"2030-01-01",meal_type:"Breakfast",notes:"Fictional meal"}});expect(meal.ok()).toBeTruthy();
  const task=await page.request.post("http://127.0.0.1:18010/api/tasks",{headers,data:{...identity,owner_patient_id:account.patient_id,title:"Preserved fictional responsibility",due_date:"2030-01-01",category:"Coordination"}});expect(task.ok()).toBeTruthy();
  await installSession(page,session);await open(page,"/settings");
  const button=page.getByRole("button",{name:"Confirm demo lifestyle reset",exact:true});await expect(button).toBeEnabled();
  let writes=0;page.on("request",r=>{if(new URL(r.url()).pathname==="/api/lifestyle/reset"&&r.method()==="POST")writes++;});
  page.on("dialog",dialog=>dialog.accept());
  await button.evaluate(element=>{(element as HTMLButtonElement).click();(element as HTMLButtonElement).click();});
  await expect(page.getByRole("status").filter({hasText:"History cleared."})).toBeVisible();
  await expect(button).toBeDisabled();expect(writes).toBe(1);
  const records=await(await page.request.get(`http://127.0.0.1:18010/api/lifestyle?patient_id=${account.patient_id}&actor_caregiver_id=${account.caregiver_id}`,{headers})).json();
  expect(records.water).toHaveLength(0);expect(records.nutrition).toHaveLength(0);expect(records.diet_recommendations).toHaveLength(1);
  const tasks=await(await page.request.get(`http://127.0.0.1:18010/api/tasks?actor_caregiver_id=${account.caregiver_id}`,{headers})).json();expect(tasks.some((t:{title:string})=>t.title==="Preserved fictional responsibility")).toBe(true);
  await open(page,"/lifestyle");await expect(page.getByText("0 mL",{exact:true}).first()).toBeVisible();
});

test("changed lifestyle records reject a stale UI confirmation and preserve the entry",async({page})=>{
  const {session,account}=await createOwner(page);const headers={Authorization:`Bearer ${session.access_token}`};
  const data={patient_id:account.patient_id,actor_caregiver_id:account.caregiver_id,log_date:"2030-01-01",quantity_ml:250,status:"Adequate"};
  const row=await(await page.request.post("http://127.0.0.1:18010/api/lifestyle/water",{headers,data})).json();
  await installSession(page,session);await open(page,"/settings");const button=page.getByRole("button",{name:"Confirm demo lifestyle reset",exact:true});await expect(button).toBeEnabled();
  expect((await page.request.put(`http://127.0.0.1:18010/api/lifestyle/water/${row.id}`,{headers,data:{...data,quantity_ml:300}})).ok()).toBeTruthy();
  page.once("dialog",dialog=>dialog.accept());await button.click();
  await expect(page.getByRole("alert").filter({hasText:"records changed"})).toBeVisible();
  const records=await(await page.request.get(`http://127.0.0.1:18010/api/lifestyle?patient_id=${account.patient_id}&actor_caregiver_id=${account.caregiver_id}`,{headers})).json();expect(records.water[0].quantity_ml).toBe(300);
});
