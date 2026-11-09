import {test} from "node:test";
import assert from "node:assert/strict";
import {fictionalExamples, fictionalExampleAt} from "../lib/ai-examples.ts";

for (const mode of Object.keys(fictionalExamples)) {
  test(`${mode} cycles distinct explicitly fictional examples without side effects`, () => {
    const items = fictionalExamples[mode];
    assert.ok(items.length >= 2);
    assert.equal(new Set(items).size, items.length);
    for (let i = 0; i < items.length; i++) {
      assert.equal(fictionalExampleAt(mode, i), items[i]);
      assert.match(items[i], /^Fictional/);
      assert.ok(items[i].length >= 10 && items[i].length <= 3000);
    }
    assert.equal(fictionalExampleAt(mode, items.length), items[0]);
  });
}
