// Unit tests use SDK method doubles only. No real accounts, email or browser sessions.
import {test} from "node:test";
import assert from "node:assert/strict";
import * as flow from "../lib/auth-flow.ts";

const session={user:{id:"confirmed-subject",email:"fictional@example.test"}};
const registration={email:" Fictional@Example.test ",password:"keep exact spaces ",confirmation:"keep exact spaces ",name:" Fictional Mother ",role:"patient"};
const success={data:{session,user:session.user},error:null};

for (const origin of ["http://localhost:3001", "http://localhost:3002", "https://maatru-care.vercel.app"]) {
  test(`OAuth callback stays on its initiating origin: ${origin}`, () => {
    const result=new URL(flow.callbackUrl(origin,"/care-circle"));
    assert.equal(result.origin,origin);assert.equal(result.pathname,"/auth/callback");
    assert.equal(result.searchParams.get("next"),"/care-circle");
    assert.equal(new URL(flow.callbackUrl(origin,"https://untrusted.example")).searchParams.get("next"),"/dashboard");
  });
}

test("registration validates email, password confirmation, name and caregiver invitation before contacting Supabase",async()=>{
  let called=0;const auth={signUp:async()=>{called++;return success;}};
  for(const change of [{email:"bad"},{password:"short",confirmation:"short"},{confirmation:"different"},{name:" "},{role:"caregiver",invitation:""}]) {
    await assert.rejects(()=>flow.registerWithEmail(auth,{...registration,...change},"http://localhost:3000"));
  }
  assert.equal(called,0);
});

test("unconfirmed registration remains pending and preserves password exactly",async()=>{
  let sent;
  const result=await flow.registerWithEmail({signUp:async(input)=>{sent=input;return {data:{user:session.user,session:null},error:null};}},registration,"http://localhost:3000");
  assert.equal(result.confirmationRequired,true);
  assert.equal(sent.email,"fictional@example.test");assert.equal(sent.password,registration.password);
  assert.equal(sent.options.data.name,"Fictional Mother");
  const redirect=new URL(sent.options.emailRedirectTo);
  assert.equal(redirect.origin,"http://localhost:3000");assert.equal(redirect.pathname,"/auth/callback");
  assert.equal(redirect.searchParams.get("next"),"/onboarding");
  assert.equal("password" in sent.options.data,false);
});

test("confirmed registration and caregiver invitations retain the correct onboarding destination",async()=>{
  const result=await flow.registerWithEmail({signUp:async()=>success},{...registration,role:"caregiver",invitation:"secure_invitation-code"},"https://care.example.test");
  assert.equal(result.confirmationRequired,false);
  assert.match(result.next,/role=caregiver&invitation=secure_invitation-code/);
  assert.equal(flow.authDestination(false,result.next),result.next);
});

test("registration rejection cannot become a success or workspace mutation",async()=>{
  await assert.rejects(()=>flow.registerWithEmail({signUp:async()=>({data:{session:null,user:null},error:{code:"weak_password"}})},registration,"https://care.example.test"),/stronger password/);
});

test("confirmed password sign-in uses signInWithPassword and keeps the returned session",async()=>{
  let sent;
  const result=await flow.signInWithEmail({signInWithPassword:async(input)=>{sent=input;return success;}},registration.email,registration.password);
  assert.equal(result,session);assert.equal(sent.email,"fictional@example.test");assert.equal(sent.password,registration.password);
  assert.equal(flow.authDestination(true,"/tasks"),"/tasks");
  assert.equal(flow.authDestination(false,"/tasks"),"/onboarding");
});

for(const code of ["invalid_credentials","user_not_found"])test(`${code} has the same non-enumerating sign-in error`,async()=>{
  await assert.rejects(()=>flow.signInWithEmail({signInWithPassword:async()=>({data:{session:null},error:{code}})},"fictional@example.test","wrong password"),{message:flow.authErrorMessage({code:"invalid_credentials"})});
});

test("unverified email, rate limits, unavailable SMTP and network failures have actionable errors",()=>{
  assert.match(flow.authErrorMessage({code:"email_not_confirmed"}),/Confirm your email/);
  assert.match(flow.authErrorMessage({status:429}),/wait/);
  assert.match(flow.authErrorMessage({name:"AuthRetryableFetchError"}),/connection/);
  assert.match(flow.authErrorMessage({code:"email_address_not_authorized"}),/unavailable/);
  assert.match(flow.authErrorMessage({code:"unexpected_failure"}),/email service/);
});

test("a rejected sign-in or a missing session cannot authenticate using a previous session",async()=>{
  await assert.rejects(()=>flow.signInWithEmail({signInWithPassword:async()=>({data:{session:null},error:null})},"fictional@example.test","password"),/active session/);
});

test("redirect allowlist rejects external, protocol-relative, backslash and encoded destinations",()=>{
  for(const next of ["https://evil.test","//evil.test","/\\evil.test","/%2f%2fevil.test","/sign-in","/tasks\n","/auth/callback?next=https://evil.test"]){assert.equal(flow.safeAuthNext(next),"/dashboard",next);}
  assert.equal(flow.safeAuthNext("/tasks?next=https://evil.test#token"),"/tasks");
  assert.equal(flow.safeAuthNext("/onboarding?role=caregiver&invitation=safe_code&next=https://evil.test"),"/onboarding?role=caregiver&invitation=safe_code");
  assert.equal(flow.authDestination(true,"/onboarding"),"/dashboard");
});

test("Google and email callbacks always exchange the new PKCE code, even with an older session",async()=>{
  const calls=[];
  const result=await flow.resolveAuthLink({exchangeCodeForSession:async(code,options)=>{calls.push({code,options});return success;},getUser:async()=>({data:{user:session.user},error:null}),getSession:async()=>{throw Error("Must not reuse old session");}},"https://care.example.test/auth/callback?code=fresh&sb_flow_id=flow-id&next=/tasks");
  assert.equal(calls.length,1);assert.equal(calls[0].code,"fresh");assert.equal(calls[0].options.flowId,"flow-id");assert.equal(result.session,session);assert.equal(result.next,"/tasks");assert.equal(result.recovery,false);
});

test("an invalid callback code never falls back to an existing session",async()=>{
  await assert.rejects(()=>flow.resolveAuthLink({exchangeCodeForSession:async()=>({data:{session:null},error:{code:"flow_state_expired"}}),getSession:async()=>success},"https://care.example.test/auth/callback?code=expired"),/expired/);
});

test("provider URL errors are not reflected or mistaken for successful sign-in",async()=>{
  await assert.rejects(()=>flow.resolveAuthLink({},"https://care.example.test/auth/callback#error=access_denied&error_description=private-details"),error=>!error.message.includes("private-details")&&/could not be verified/.test(error.message));
  await assert.rejects(()=>flow.resolveAuthLink({},"https://care.example.test/auth/callback"),/valid confirmation/);
});

test("token-hash confirmation supports cross-browser email templates",async()=>{
  let otp;
  const result=await flow.resolveAuthLink({verifyOtp:async(input)=>{otp=input;return success;},getUser:async()=>({data:{user:session.user},error:null})},"https://care.example.test/auth/callback?token_hash=confirmation-proof&type=signup&next=/onboarding");
  assert.deepEqual(otp,{token_hash:"confirmation-proof",type:"signup"});assert.equal(result.recovery,false);
});

test("password recovery uses the callback and the correct recovery destination",async()=>{
  let sent;
  await flow.requestRecovery({resetPasswordForEmail:async(email,options)=>{sent={email,options};return {error:null};}},registration.email,"http://localhost:3000");
  const redirect=new URL(sent.options.redirectTo);
  assert.equal(sent.email,"fictional@example.test");assert.equal(redirect.pathname,"/auth/callback");assert.equal(redirect.searchParams.get("type"),"recovery");assert.equal(redirect.searchParams.get("next"),"/reset-password");
  const result=await flow.resolveAuthLink({exchangeCodeForSession:async()=>success,getUser:async()=>({data:{user:session.user},error:null})},redirect.toString()+"&code=recovery");
  assert.equal(result.recovery,true);
});

test("previously issued implicit recovery links are verified through Supabase",async()=>{
  let credentials;
  const result=await flow.resolveAuthLink({setSession:async(input)=>{credentials=input;return success;},getUser:async()=>({data:{user:session.user},error:null})},"http://localhost:3000/reset-password#access_token=provider-proof&refresh_token=refresh-proof&type=recovery");
  assert.equal(credentials.access_token,"provider-proof");assert.equal(result.recovery,true);
});

test("callback must verify the same identity before showing workspace access",async()=>{
  await assert.rejects(()=>flow.resolveAuthLink({exchangeCodeForSession:async()=>success,getUser:async()=>({data:{user:{id:"different-subject"}},error:null})},"https://care.example.test/auth/callback?code=code"),/account changed/);
});

test("password changes require matching confirmation and a current verified account",async()=>{
  let updated;
  const auth={getUser:async()=>({data:{user:session.user},error:null}),updateUser:async(input)=>{updated=input;return {error:null};}};
  await assert.rejects(()=>flow.changePassword(auth,"new-password","mismatch",session.user.id),/do not match/);
  await assert.rejects(()=>flow.changePassword(auth,"new-password","new-password","other-subject"),/account changed/);
  assert.equal(updated,undefined);
  await flow.changePassword(auth,"new-password","new-password",session.user.id);
  assert.deepEqual(updated,{password:"new-password"});
});

test("resend confirmation preserves invitations without implying email delivery",async()=>{
  let sent;
  await flow.resendConfirmation({resend:async(input)=>{sent=input;return {error:null};}},registration.email,"https://care.example.test","/onboarding?role=caregiver&invitation=safe_token");
  assert.equal(sent.type,"signup");assert.equal(sent.email,"fictional@example.test");assert.equal(new URL(sent.options.emailRedirectTo).searchParams.get("next"),"/onboarding?role=caregiver&invitation=safe_token");
});

test("callback secrets and provider errors are removed from browser-history URLs",()=>{
  assert.equal(flow.scrubAuthUrl("https://care.example.test/auth/callback?code=secret&sb_flow_id=id&token_hash=secret&type=signup&next=/tasks#access_token=secret&refresh_token=secret"),"/auth/callback?type=signup&next=%2Ftasks");
});

test("legacy provider errors have the same safe credential and confirmation handling",()=>{
  assert.equal(flow.authErrorMessage({name:"AuthApiError",message:"Invalid login credentials",status:400}),flow.authErrorMessage({code:"invalid_credentials"}));
  assert.match(flow.authErrorMessage({name:"AuthApiError",message:"Email not confirmed",status:400}),/Confirm your email/);
});

test("sign-out uses Supabase and rejects failures instead of reporting false success",async()=>{
  let scope;
  await flow.signOutCurrentSession({signOut:async(options)=>{scope=options.scope;return {error:null};}});
  assert.equal(scope,"local");
  await assert.rejects(()=>flow.signOutCurrentSession({signOut:async()=>({error:{name:"AuthRetryableFetchError"}})}),/connection/);
});

test("session adapter preserves the SDK singleton/persistence and surfaces restoration errors",async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://auth-unit.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="public-unit-placeholder";
  const adapter=await import("../lib/supabase.ts");
  const client=adapter.getSupabaseBrowserClient();
  assert.equal(client,adapter.getSupabaseBrowserClient());
  assert.equal(client.auth.persistSession,true);assert.equal(client.auth.flowType,"pkce");
  const original=client.auth.getSession;
  try {
    client.auth.getSession=async()=>({data:{session},error:null});
    assert.equal(await adapter.readSupabaseSession(),session);
    client.auth.getSession=async()=>({data:{session:null},error:{message:"expired"}});
    await assert.rejects(()=>adapter.readSupabaseSession(),/restored/);
  } finally {client.auth.getSession=original;await client.auth.stopAutoRefresh();}
});
