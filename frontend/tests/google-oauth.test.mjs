import {test} from "node:test";
import assert from "node:assert/strict";
import {beginGoogleOAuth,googleCallbackDestination,googleIntentKey,resolveAuthLink} from "../lib/auth-flow.ts";

function memory() {
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
const started={data:{provider:"google",url:"https://identity.example/authorize"},error:null};

for(const origin of ["http://localhost:3000","http://localhost:3001","https://maatru-care.vercel.app"]) {
  test(`Google uses the exact allowlisted callback without query/fragment: ${origin}`,async()=>{
    const storage=memory();let sent;
    await beginGoogleOAuth({signInWithOAuth:async payload=>{sent=payload;return started;}},origin,"/care-circle",storage);
    assert.equal(sent.provider,"google");assert.equal(sent.options.redirectTo,origin+"/auth/callback");
    assert.deepEqual(Object.keys(JSON.parse(storage.getItem(googleIntentKey))).sort(),["expires","next","origin"]);
    assert.equal(googleCallbackDestination(origin+"/auth/callback?code=fictional-code","/dashboard",storage),"/care-circle");
    assert.equal(storage.getItem(googleIntentKey),null);
  });
}

test("an invitation survives leaving and reloading the initiating tab, after verified PKCE exchange",async()=>{
  const storage=memory();const next="/onboarding?role=caregiver&invitation=fictional_invitation_token";
  await beginGoogleOAuth({signInWithOAuth:async()=>started},"http://localhost:3000",next,storage);
  const session={user:{id:"verified-fictional-subject"}};let exchanges=0;
  const auth={exchangeCodeForSession:async code=>{assert.equal(code,"fictional-code");exchanges++;return {data:{session},error:null};},getUser:async()=>({data:{user:session.user},error:null})};
  const verified=await resolveAuthLink(auth,"http://localhost:3000/auth/callback?code=fictional-code");
  assert.equal(exchanges,1);assert.equal(googleCallbackDestination("http://localhost:3000/auth/callback?code=fictional-code",verified.next,storage),next);
  assert.equal(googleCallbackDestination("http://localhost:3000/auth/callback?code=fictional-code","/dashboard",storage),"/dashboard");
});

test("missing, malformed, expired, foreign-origin and external routing hints cannot redirect outside the app",()=>{
  const cases=[null,"invalid-json","null",JSON.stringify({origin:"http://localhost:3000",next:"/tasks",expires:0}),JSON.stringify({origin:"https://other.example",next:"/tasks",expires:Date.now()+10000}),JSON.stringify({origin:"http://localhost:3000",next:"https://evil.example",expires:Date.now()+10000})];
  for(const value of cases){const storage=memory();if(value)storage.setItem(googleIntentKey,value);assert.equal(googleCallbackDestination("http://localhost:3000/auth/callback?code=fictional","/dashboard",storage),"/dashboard");assert.equal(storage.getItem(googleIntentKey),null);}
});

test("legacy query destinations and recovery keep precedence over any stale Google hint",async()=>{
  const storage=memory();await beginGoogleOAuth({signInWithOAuth:async()=>started},"http://localhost:3000","/tasks",storage);
  assert.equal(googleCallbackDestination("http://localhost:3000/auth/callback?code=fictional&next=%2Fcare-circle","/care-circle",storage),"/care-circle");
  await beginGoogleOAuth({signInWithOAuth:async()=>started},"http://localhost:3000","/tasks",storage);
  assert.equal(googleCallbackDestination("http://localhost:3000/auth/callback?code=fictional","/dashboard",storage,true),"/dashboard");
});

test("failed OAuth initiation clears its hint and blocked storage never starts a provider flow",async()=>{
  const storage=memory();await assert.rejects(()=>beginGoogleOAuth({signInWithOAuth:async()=>({data:null,error:{code:"unexpected_failure",status:503}})},"http://localhost:3000","/tasks",storage));
  assert.equal(storage.getItem(googleIntentKey),null);
  let called=false;await assert.rejects(()=>beginGoogleOAuth({signInWithOAuth:async()=>{called=true;return started;}},"http://localhost:3000","/tasks",{...storage,setItem:()=>{throw new Error("Synthetic blocked storage");}}),/Allow session storage/);assert.equal(called,false);
});

test("a routing hint cannot replace a missing PKCE verifier or a failed user verification",async()=>{
  const auth={exchangeCodeForSession:async()=>({data:{session:null},error:{code:"bad_code_verifier"}}),getUser:async()=>{throw new Error("Must not verify failed exchange");}};
  await assert.rejects(()=>resolveAuthLink(auth,"http://localhost:3000/auth/callback?code=fictional"),/expired|different browser/);
  await assert.rejects(()=>resolveAuthLink(auth,"http://localhost:3000/auth/callback"),/valid confirmation or sign-in link/);
});
