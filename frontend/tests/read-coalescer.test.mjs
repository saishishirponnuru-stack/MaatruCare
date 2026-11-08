import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL("../lib/read-coalescer.ts", import.meta.url), "utf8"),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const context = {exports: {}}; vm.runInNewContext(compiled, context);
const {ReadCoalescer} = context.exports;
const deferred = () => {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};};

test("identical concurrent reads share one load", async () => {
  const reads = new ReadCoalescer(); const gate = deferred(); let calls = 0;
  const load = () => {calls++; return gate.promise;};
  const a = reads.read("owner-a:token:tasks", load); const b = reads.read("owner-a:token:tasks", load);
  gate.resolve("saved records"); assert.equal(await a, "saved records"); assert.equal(await b, "saved records"); assert.equal(calls, 1);
});
test("different subjects or tokens never share private records", async () => {
  const reads = new ReadCoalescer();
  const a = reads.read("owner-a:token1:tasks", async () => "first");
  const b = reads.read("owner-b:token2:tasks", async () => "second");
  assert.equal(await a, "first"); assert.equal(await b, "second");
});
test("completed reads are not cached", async () => {
  const reads = new ReadCoalescer(); let calls = 0;
  assert.equal(await reads.read("key", async () => ++calls), 1);
  assert.equal(await reads.read("key", async () => ++calls), 2);
});
test("failed requests are removed so retry performs a new request", async () => {
  const reads = new ReadCoalescer();
  await assert.rejects(reads.read("key", async () => {throw Error("backend unavailable");}));
  assert.equal(await reads.read("key", async () => "recovered"), "recovered");
});
test("mutation invalidation refetches an overlapping read instead of returning stale data", async () => {
  const reads = new ReadCoalescer(); const gate = deferred(); let calls = 0;
  const result = reads.read("key", () => ++calls === 1 ? gate.promise : Promise.resolve("after mutation"));
  await Promise.resolve(); reads.invalidate(); gate.resolve("before mutation");
  assert.equal(await result, "after mutation"); assert.equal(calls, 2);
});
test("a new account read can finish while the old account read is pending", async () => {
  const reads = new ReadCoalescer(); const gate = deferred();
  const old = reads.read("old-account", () => gate.promise);
  assert.equal(await reads.read("new-account", async () => "new records"), "new records");
  gate.resolve("old records"); assert.equal(await old, "old records");
});
