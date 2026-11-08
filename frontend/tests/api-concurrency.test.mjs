import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = name => ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const gate = () => {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};};
const session = subject => ({user: {id: subject}, access_token: `fictional-${subject}`});
const json = data => new Response(JSON.stringify(data), {headers: {"Content-Type": "application/json"}});

function client(fetch) {
  let current = session("first");
  const modules = {"./supabase": {readSupabaseSession: async () => current, getSupabaseBrowserClient: () => null}};
  function evaluate(source) {
    const exports = {};
    vm.runInNewContext(source, {exports, require: name => modules[name], process: {env: {NEXT_PUBLIC_API_BASE_URL: "http://fixture.invalid"}}, fetch, AbortSignal, DOMException});
    return exports;
  }
  modules["./read-coalescer"] = evaluate(compile("read-coalescer"));
  return {api: evaluate(compile("api")).api, switchAccount: subject => {current = session(subject);}};
}

test("API shares parsed results for concurrent identical authenticated GETs", async () => {
  const response = gate(); let calls = 0;
  const {api} = client(async () => {calls++; return response.promise;});
  const a = api.getTasks({patientId: 1, caregiverId: 1});
  const b = api.getTasks({patientId: 1, caregiverId: 1});
  await Promise.resolve(); await Promise.resolve(); response.resolve(json([{id: 1, title: "Own task"}]));
  assert.equal((await a)[0].title, "Own task"); assert.equal((await b)[0].title, "Own task"); assert.equal(calls, 1);
});

test("API rejects an old-account response while a new account loads its own data", async () => {
  const response = gate(); let calls = 0;
  const c = client(async () => ++calls === 1 ? response.promise : json([{title: "Second account task"}]));
  const old = c.api.getTasks({patientId: 1, caregiverId: 1});
  const rejected = assert.rejects(old, error => error.status === 409);
  await Promise.resolve(); await Promise.resolve();
  c.switchAccount("second");
  assert.equal((await c.api.getTasks({patientId: 2, caregiverId: 2}))[0].title, "Second account task");
  response.resolve(json([{title: "First account task"}])); await rejected;
});

test("API mutation invalidates an overlapping GET and returns refreshed records", async () => {
  const response = gate(); let reads = 0; let writes = 0;
  const {api} = client(async (_url, init) => {
    if (init.method === "POST") {writes++; return json({id: 2, title: "Saved task"});}
    return ++reads === 1 ? response.promise : json([{id: 2, title: "Saved task"}]);
  });
  const oldRead = api.getTasks({patientId: 1, caregiverId: 1});
  await Promise.resolve(); await Promise.resolve();
  await api.createTask({patient_id: 1, actor_caregiver_id: 1, owner_patient_id: 1, title: "Saved task", category: "Coordination", due_date: "2030-01-01"});
  response.resolve(json([]));
  assert.equal((await oldRead)[0].title, "Saved task"); assert.equal(reads, 2); assert.equal(writes, 1);
});
