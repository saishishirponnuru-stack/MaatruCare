import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = ts.transpileModule(readFileSync(new URL("../lib/ai-drafts.ts", import.meta.url), "utf8"),
  {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const context = {exports: {}}; vm.runInNewContext(source, context);
const text = context.exports.editableDraftText;
const output = {summary: "Summary to review", care_update: "", handoff_summary: ""};
for (const operation of ["care_plan", "extract_tasks", "summarize", "appointment_prep"]) {
  test(`${operation} uses its summary with empty or populated unrelated fields`, () => {
    assert.equal(text({operation, output}), output.summary);
    assert.equal(text({operation, output: {...output, care_update: "Unrelated update", handoff_summary: "Unrelated handoff"}}), output.summary);
  });
}
test("care update uses its own text, with a summary fallback for blank output", () => {
  assert.equal(text({operation: "update_draft", output}), output.summary);
  assert.equal(text({operation: "update_draft", output: {...output, care_update: "Approved update"}}), "Approved update");
});
test("handoff uses its own summary and ignores an unrelated care update", () => {
  assert.equal(text({operation: "handoff_draft", output}), output.summary);
  assert.equal(text({operation: "handoff_draft", output: {...output, handoff_summary: "Handoff responsibility", care_update: "Other"}}), "Handoff responsibility");
});
