import {test, expect} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";
import path from "node:path";

test("unavailable demo options do not block switching to an invitation",async({page})=>{
  const session=await(await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true")).json();
  await installSession(page,session);
  await page.route("**/api/auth/onboarding-options",route=>route.abort());
  await page.goto("/onboarding");
  await page.getByLabel("Full name",{exact:true}).fill("Fictional Invited Member");
  await page.getByRole("checkbox",{name:/Create a fictional demonstration workspace/}).check();
  await page.getByText("Join a Care Circle",{exact:true}).click();
  await expect(page.getByRole("radio",{name:/Join a Care Circle/})).toBeChecked();
  await page.getByLabel("Invitation code",{exact:true}).fill("invalid-fictional-invitation-token");
  const attempted=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/auth/bootstrap"&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Accept invitation",exact:true}).click();
  expect((await attempted).status()).toBe(400);
  await expect(page.getByRole("alert").filter({hasText:"Invitation token is invalid"})).toBeVisible();
});

test("unchanged profile refresh preserves the loaded coordination workspace", async ({page}) => {
  const owner=await createOwner(page,"Fictional Stable Profile");
  await installSession(page,owner.session);await open(page,"/profile");
  await page.getByRole("button",{name:"Edit profile",exact:true}).click();
  let taskReads=0;
  page.on("request",r=>{if(new URL(r.url()).pathname==="/api/tasks"&&r.method()==="GET")taskReads++;});
  await page.getByRole("dialog").getByRole("button",{name:"Save profile",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(500); // Same bounded observation window before/after.
  console.log(JSON.stringify({unchanged_profile_task_reads:taskReads}));
  expect(taskReads).toBe(0);
  await open(page,"/dashboard");
  await expect(page.getByRole("heading",{name:"Welcome, Fictional",exact:true})).toBeVisible();
});

test("branding keeps legible proportions across both themes and responsive layouts",async({page})=>{
  const owner=await createOwner(page);await installSession(page,owner.session);await open(page,"/dashboard");
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [1440,768,375]) {
    await page.setViewportSize({width,height:900});
    let firstWidth:number|undefined;
    for(const theme of ["light","dark"]) {
      if(await page.locator("html").getAttribute("data-theme")!==theme)await page.getByRole("button",{name:`Switch to ${theme} mode`,exact:true}).click();
      const logo=page.locator(width>=1024?"aside:visible .mc-logo":"header .mc-logo:visible").first();
      await expect(logo).toBeVisible();await expect(logo).toContainText("MaatruCare");
      const geometry=await logo.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth,right:element.getBoundingClientRect().right}));
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(geometry.right).toBeLessThanOrEqual(width);
      if(firstWidth!==undefined)expect(Math.abs(geometry.width-firstWidth)).toBeLessThanOrEqual(1);firstWidth=geometry.width;
      await expect(logo.locator("img")).toHaveJSProperty("complete",true);
      expect(await logo.locator("img").evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      if(width!==768) {
        await page.screenshot({path:path.resolve(`../docs/review/polish-${theme}-${width}.png`),animations:"disabled"});
        await logo.screenshot({path:path.resolve(`../docs/review/polish-${theme}-${width}-logo.png`),animations:"disabled"});
      }
    }
  }
});

test("navigation stays usable while optional route resources are held",async({page})=>{
  const owner=await createOwner(page);await installSession(page,owner.session);await open(page,"/dashboard");
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  let held=0;
  // A cached static RSC payload can still wait for its route's JS chunks.
  // Hold route fetches/modules, never the separate authenticated API.
  await page.route("**/*",async route=>{if(new URL(route.request().url()).port==="3100"&&["fetch","xhr","script"].includes(route.request().resourceType())){held++;await gate;}await route.continue();});
  try {
    const started=Date.now();
    await page.getByRole("link",{name:"Lifestyle",exact:true}).first().click();
    await expect(page.getByRole("heading",{name:"Lifestyle & wellbeing",exact:true})).toBeVisible();
    await expect(page.locator("main")).toHaveAttribute("aria-busy","false");
    console.log(JSON.stringify({navigation_with_optional_resources_held_ms:Date.now()-started,held_resources:held}));
    await expect(page.getByRole("link",{name:"Home",exact:true}).first()).toBeVisible();
  } finally {release();}
  await page.waitForURL("**/lifestyle");
  await expect(page.getByRole("heading",{name:"Lifestyle & wellbeing",exact:true})).toBeVisible();
});
