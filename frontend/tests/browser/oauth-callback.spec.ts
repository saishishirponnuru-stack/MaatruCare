import {test,expect} from "./fixtures";
import {createOwner} from "./helpers";

test("bare Google callback restores invitation intent, exchanges PKCE and survives refresh",async({page})=>{
  const owner=await createOwner(page,"Fictional Inviting Owner");
  const session=await(await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true")).json();
  const invitation=await page.request.post("http://127.0.0.1:18010/api/auth/invitations",{headers:{Authorization:`Bearer ${owner.session.access_token}`},data:{email:session.user.email,name:"Fictional Invited Caregiver",relationship:"Friend"}});
  expect(invitation.status()).toBe(201);
  const token=(await invitation.json()).token;const next=`/onboarding?role=caregiver&invitation=${token}`;
  let exchanges=0;
  await page.route("http://localhost:18010/auth/v1/authorize?**",route=>route.fulfill({status:204}));
  await page.route("http://localhost:18010/auth/v1/token?**",route=>{
    const body=route.request().postDataJSON();expect(body.code_verifier).toBeTruthy();exchanges++;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(session)});
  });
  await page.route("http://localhost:18010/auth/v1/user",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(session.user)}));
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("button",{name:"Continue with Google",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(sessionStorage.getItem("maatru-care-google-return:v1")))).toBe(true);
  await page.goto("/auth/callback?code=isolated-fictional-code");
  await page.waitForURL(url=>url.pathname==="/onboarding"&&url.searchParams.get("invitation")===token);
  expect(exchanges).toBe(1);
  expect(await page.evaluate(()=>sessionStorage.getItem("maatru-care-google-return:v1"))).toBeNull();
  await page.reload();await expect(page.getByLabel("Invitation code",{exact:true})).toHaveValue(token);
  await page.getByLabel("Full name",{exact:true}).fill("Fictional Invited Caregiver");
  await page.getByRole("button",{name:"Accept invitation",exact:true}).click();
  await page.waitForURL("**/dashboard");await page.reload();
  const me=await page.request.get("http://127.0.0.1:18010/api/auth/me",{headers:{Authorization:`Bearer ${session.access_token}`}});
  expect(me.status()).toBe(200);expect((await me.json()).patient_id).toBe(owner.account.patient_id);
});

test("a failed PKCE callback clears routing intent and never reports authentication success",async({page})=>{
  await page.route("http://localhost:18010/auth/v1/authorize?**",route=>route.fulfill({status:204}));
  await page.route("http://localhost:18010/auth/v1/token?**",route=>route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({error_code:"bad_code_verifier",msg:"Synthetic invalid verifier"})}));
  await page.goto("/sign-in");await page.getByRole("button",{name:"Continue with Google",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(sessionStorage.getItem("maatru-care-google-return:v1")))).toBe(true);
  await page.goto("/auth/callback?code=isolated-invalid-code");
  await expect(page.getByRole("alert").filter({hasText:/expired|different browser/})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/auth/callback");expect(new URL(page.url()).searchParams.has("code")).toBe(false);
  expect(await page.evaluate(()=>sessionStorage.getItem("maatru-care-google-return:v1"))).toBeNull();
});
