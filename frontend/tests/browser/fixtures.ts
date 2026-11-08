import {test as base, expect} from "@playwright/test";

export const test = base.extend<{browserDiagnostics: void}>({
  browserDiagnostics: [async ({page}, use, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && /hydration|hydrating|Minified React error|maximum update depth/i.test(message.text())) errors.push(message.text());
    });
    page.on("response", response => {
      if (response.status() < 500) return;
      const path = new URL(response.url()).pathname;
      const deliberate = (info.title.includes("failed refresh") && path === "/api/lifestyle")
        || (info.title.includes("failed API load") && path === "/api/tasks")
        || (info.title.includes("AI provider failure") && path === "/api/ai/workspace");
      if (!deliberate) errors.push(`Unexpected HTTP ${response.status()} at ${path}`);
    });
    await use();
    expect(errors, "Uncaught browser errors, hydration errors or unexpected server failures").toEqual([]);
  }, {auto: true}],
});

export {expect};
