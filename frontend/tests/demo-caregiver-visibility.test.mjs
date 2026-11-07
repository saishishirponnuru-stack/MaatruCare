// Render the real Care Circle component with isolated provider values; no API calls.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/care-circle/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}}).outputText;
const wrapper = tag => function FixtureWrapper({children}) { return React.createElement(tag, null, children); };

function render({frontendFlag, backendAvailable, role = "patient", members = []}) {
  const modules = {
    react: {...React, useState(initial) {
      return React.useState(initial && typeof initial === "object" && "simulated_available" in initial
        ? {...initial, simulated_available: backendAvailable} : initial);
    }},
    "next/link": ({href, children}) => React.createElement("a", {href}, children),
    "@/components/layout/AppShell": wrapper("main"),
    "@/components/ui/ProductUI": {
      Badge: wrapper("span"), Button: ({children, ...props}) => React.createElement("button", props, children),
      Drawer: wrapper("aside"), Field: wrapper("label"), Message: wrapper("p"), Panel: wrapper("section"),
      PageHeading: ({title, action}) => React.createElement("header", null, title, action),
    },
    "@/lib/api": {api: {}},
    "@/context/AuthContext": {useAuth: () => ({account: {role, patient_id: 1, caregiver_id: 2}})},
    "@/context/MaatruCareDemoContext": {useMaatruCareDemo: () => ({caregiverRecords: members, permissions: {}, loading: false, error: ""})},
    "@/lib/coordination": {displayTimestamp: value => value},
  };
  const cjsModule = {exports: {}};
  const context = vm.createContext({module: cjsModule, exports: cjsModule.exports,
    process: {env: {NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED: frontendFlag}},
    require: name => Object.hasOwn(modules, name) ? modules[name] : require(name),
  });
  new vm.Script(compiled).runInContext(context);
  return renderToStaticMarkup(React.createElement(cjsModule.exports.default));
}

for (const [label, frontendFlag, backendAvailable, role, visible] of [
  ["both flags and owner", "true", true, "patient", true],
  ["missing build flag", undefined, true, "patient", false],
  ["disabled build flag", "false", true, "patient", false],
  ["backend capability off", "true", false, "patient", false],
  ["caregiver account", "true", true, "caregiver", false],
]) {
  test(`simulation action: ${label}`, () => {
    const markup = render({frontendFlag, backendAvailable, role});
    assert.equal(markup.includes("Add simulated caregiver"), visible);
    assert.equal(markup.includes("Invite caregiver"), role === "patient");
  });
}

test("fictional caregiver cards keep normal names, Active and Simulated badges", () => {
  const members = [["Rahul Rao", "Partner"], ["Lakshmi Rao", "Parent"], ["Priya Rao", "Sister"]]
    .map(([name, relationship], index) => ({id: index + 10, name, relationship, is_demo: true, access_status: "Active"}));
  const markup = render({frontendFlag: "true", backendAvailable: true, members});
  for (const {name, relationship} of members) {
    assert.ok(markup.includes(name));
    assert.ok(markup.includes(relationship));
  }
  assert.equal((markup.match(/>Active<\/span>/g) || []).length, 3);
  assert.equal((markup.match(/>Simulated<\/span>/g) || []).length, 3);
  assert.ok(!markup.includes("Demo #"));
});
