import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {existsSync} from "node:fs";
const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const env = {...process.env, MAATRUCARE_BUILD_DIR: ".next-browser-tests",
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:18010", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:18010",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "isolated-browser-fixture-key", NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED: "true"};
let child;
function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [next, ...args], {env, stdio: "inherit"});
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Next exited ${code}`)));
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { child?.kill(); process.exit(); });
if (process.env.MAATRUCARE_BROWSER_REUSE_BUILD === "true") {
  if (!existsSync(".next-browser-tests/BUILD_ID")) throw new Error("Run browser tests with a fresh build first.");
} else await run(["build"]);
await run(["start", "--hostname", "127.0.0.1", "--port", "3100"]);
