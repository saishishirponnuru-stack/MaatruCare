# MaatruCare performance and reliability — local implementation report

Date: 8 November 2026 (IST). Production remained on `11b885cad5c198ebb428a3c5283818ae5da0dd62`. No commits, pushes, deployments, production configuration changes, production migrations, resets, or production record mutations were performed. Production profiling used anonymous GET/OPTIONS requests and a PostgreSQL-enforced read-only transaction. Application mutation tests used temporary SQLite databases and fictional identities.

## A. Confirmed causes and fixes

### Unrelated route requests on Care Circle — moderate performance impact

The persistent sidebar and topbar used Next.js Link's default production prefetching. A real production-mode Next build in headless Edge made **22 prefetch requests** while opening Care Circle, before any navigation. Development mode does not automatically prefetch, explaining this particular localhost/production difference. This is route/RSC traffic, not 22 duplicated backend requests.

Disabled automatic prefetch only on persistent navigation links. Contextual links retain their existing behavior, as do Next's navigation and caches. The same observation window now sees **2** prefetch requests, both for the relevant Consent link. No layout, palette, typography, or navigation labels changed. [Next.js documents this production-only behavior](https://nextjs.org/docs/app/guides/prefetching).

### Participant-dependent task and handoff queries — moderate scaling risk

Task owner and handoff participant names triggered lazy relationship SELECTs during response serialization. In the isolated API regression test, growing from one to 25 distinct participants increased task-list SELECTs from **5 to 29**, and handoff-list SELECTs from **7 to 31**. Eager-loading these relationships now keeps the counts at **4 and 5**, respectively, for both sizes. JWT validation, workspace filtering, permissions, response contracts, and audit logging remain intact.

This is a confirmed scaling defect, not proof that it caused the reported production incident. The sampled production workspace had no tasks or handoffs returned by the limited profiling queries.

### Judges' accounts could not use simulations — confirmed configuration/design limitation

The production allowlist legitimately permits workspace 1 only. Added explicit, unchecked-by-default fictional-workspace opt-in during **new-account onboarding**. The backend persists the choice, binds it to the authenticated owner, and checks it when advertising or creating simulated caregivers. The global simulation switch remains required. The legacy workspace-1 allowlist remains supported.

Existing real workspaces cannot be converted through bootstrap or profile edits. Existing users must use a separate, previously unlinked account for a fictional demonstration. This avoids a broad multi-workspace redesign. Opt-in adds no sample caregivers, tasks, handoffs, or lifestyle records. Its real creation action is audited. Compatibility owner principals remain internal and are excluded from caregiver lists.

### Dependency advisories — critical package-level finding

The installed Next.js 16.3.6 and its locked dependencies matched published security advisories. Updated Next.js and its matching ESLint configuration to **16.4.5**, with compatible locked dependency updates for sharp, source-map-js and Zod. The [Next.js image-optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) and [Cache Components advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) identify patched releases. No exploitation test or claim of compromise was made.

The final production dependency audit reports zero vulnerabilities. Eight moderate findings remain in the development lint dependency chain; no forced downgrade or broad dependency rewrite was performed. These local updates have not yet reached production.

### What was not reproduced

Neither the reported **306 requests / 3.8-minute DOMContentLoaded/load** nor 7–10-second route requests were reproduced. Prefetching begins after hydration and does not by itself establish why DOMContentLoaded took minutes. An authenticated production HAR with initiators, timings, cache state, and browser performance trace is still needed to attribute that incident. No evidence justified rewriting auth, adding a global sensitive-data cache, removing permissions, adding indexes, or changing hosting plans.

## B. Measurements

### Local production-mode browser comparison

Sources: [before](performance/local-before.json), [navigation fix before the dependency update](performance/local-after-navigation.json), and [final implementation](performance/local-after.json). Each uses a fresh headless Edge context, temporary SQLite, valid synthetic JWTs, and a fixed 1.5-second background-prefetch observation window. The frontend is a real optimized Next production build. Browser request events include cached resources and do not count browser-internal preflights as page requests.

- Observed initial page requests: **55 → 25**, a 54.5% reduction.
- Route-prefetch requests: **22 → 2**, a 90.9% reduction.
- JavaScript transferred during the window: **423,610 → 286,339 bytes**, a 32.4% reduction. This reflects avoiding unrelated route downloads, not a claim that every bundle shrank.
- API requests: **9 → 9**. Duplicate API requests: **0 → 0**. `/api/auth/me`: **one per document**, including warm restoration.
- Document TTFB: **19.6 → 26.5 ms**; DOMContentLoaded: **84.3 → 95.4 ms**; load: **178.2 → 205.6 ms**. These single samples show no demonstrated improvement in those timings; do not infer a latency distribution from them.
- Final fresh-context usable state: **657 ms**; observed LCP: **712 ms**. These metrics were added after baseline, so no before comparison exists.
- Final warm reload: TTFB **4.8 ms**, DOMContentLoaded **28.9 ms**, load **63.8 ms**, usable state **345 ms**, observed LCP **324 ms**, JavaScript network transfer **0 bytes**. It still made nine authorized API calls, without duplicates.
- Sidebar navigation before/final, in milliseconds: Home **165/277**, Tasks **265/545**, Handoffs **70/108**, Consent **57/113**, Care Circle **55/83**. The original measurement waits for URL and shared loading state, not every route-specific effect. First visits pay an on-demand fetch cost after prefetch is disabled; no navigation-speed improvement is claimed.
- A browser workflow run measured simulated-caregiver creation becoming visible in **239 ms**, including automated form interaction. Creation and refresh persistence passed; this is a local observation with no before baseline.

The navigation-only sample preserves the same framework version as the original baseline. Final timing samples also include the supported dependency update. They are engineering observations, not controlled production percentiles. LCP is observed over a bounded window. A fresh browser context is not a proven server cold start.

### Production, read-only

[HTTP samples](performance/baseline-production-http.json) found subsequent anonymous frontend document GETs around **35–65 ms**, with first samples up to about **507 ms**. Twenty warm backend **health-only** samples yielded p50 **236.18 ms**, p95 **283.10 ms**. A CORS OPTIONS request took **237.36 ms**. Health does not query the database and these figures do not measure authenticated business endpoints.

[Actual public browser samples](performance/production-public-browser.json), three fresh-context/warm pairs on the anonymous sign-in page, showed fresh loads **693–1,061 ms** and observed LCP **816–1,340 ms**. Warm loads were **107–129 ms**. Each navigation observed 19 page requests and no uncaught page exceptions. This does not verify Google authentication or an authenticated production workspace. Static assets had long-lived immutable caching and Brotli compression; document caching/revalidation was intact. HTTP 304 is a normal conditional-cache response, not an error by itself.

[PostgreSQL profiling](performance/production-db-readonly.json) used `SET TRANSACTION READ ONLY`, fixed ID-only queries, and no application imports. Sampled server execution times were **0.027–0.086 ms**. The external TLS connection took **2,023 ms**; 20 external `SELECT 1` round trips had p50 **267.89 ms**, p95 **341.19 ms**. Those network timings are from this local machine, not Render's internal connection. No slow plan justified an index migration.

Render's backend is confirmed **Virginia / Free**, matching the database region. Production frontend API configuration points to Render; localhost points to local port 8000 and SQLite. These are different datastores, so local caregiver counts need not match production. Matching an actual signed-in person's accounts was unavailable in this sprint.

[Render documents](https://render.com/docs/free) that free web services spin down after 15 minutes without traffic. Cold-start impact remains a hosting limitation; no actual cold-start interval was measured and no plan changes or keepalive automation were made. Authenticated production readiness cannot be inferred from anonymous edge or health latency.

## C. Functional correctness

The full backend suite covers authentication, workspace isolation, invitations/withdrawal/acceptance, consent and revocation, task transitions, handoff lifecycle and simulation audit, cancellation/archive, appointments, lifestyle persistence/serialization, and AI validation/review/error handling with isolated fixtures. New tests cover query growth, explicit demo opt-in, idempotent bootstrap, prevention of conversion, legacy profile preservation, feature-off behavior, authorization, and additive migration retention.

Seven real headless-browser tests passed against the optimized local frontend and isolated backend:

1. Production-mode navigation, single auth initialization and no duplicate initial/warm API calls.
2. Simulated caregiver creation, refresh persistence, consent switches, task assignment/completion/reopening, handoff send/simulated acknowledgement/completion/archive, and timeline ordering.
3. Real invitation-link creation and withdrawal.
4. Account switching clears the previous workspace; sign-out clears the SDK session and protected navigation redirects.
5. A new account explicitly creates an empty fictional workspace and retains capability after refresh.
6. Dashboard, Journey, Lifestyle, AI Assist, Settings and Profile load; Care Circle remains accessible without horizontal overflow at 375, 768, 1024 and 1440 pixels.
7. A failed task API load shows an error, finishes loading, and Retry recovers.

The fixture substitutes Supabase's logout response locally; it does not test the external provider. No production account was created or changed. Actual Google sign-in, email delivery/confirmation, recovery email delivery, authenticated public workflows, live Gemini generation and live consent revocation require controlled manual/staging verification. No delivered email or live AI success is claimed.

## D. Security and data preservation

Authentication, owner checks, permission enforcement, simulated-account restrictions and audit history were preserved. Existing account-scoped state and obsolete-response guards were retained rather than replaced with a global cache. Backend isolation tests and browser account-switch tests pass.

Only a new, authenticated owner can opt into a new fictional workspace. Unrelated accounts and real caregivers cannot create its simulated members. Existing real workspaces retain `is_demo_workspace=false`; workspace 1 keeps its existing allowlist exception. Simulated caregivers receive no Account record or sign-in identity. Duplicate creation returns a conflict. Permission switches remain authoritative server-side.

No local development database or backup was reset, overwritten or used for mutation tests. No credentials or tokens were placed in reports or benchmark output. Existing unrelated untracked reports, backups and scratch files were left untouched. The running user development services were not stopped.

## E. Exact changed files

Application and configuration changes:

- [Sidebar](../frontend/components/layout/Sidebar.tsx), [Topbar](../frontend/components/layout/Topbar.tsx): disable persistent navigation prefetch.
- [Task router](../backend/app/routers/tasks.py), [handoff service](../backend/app/services/handoff_service.py): eager-load participant relationships.
- [Models](../backend/app/models.py), [migration](../backend/app/migrations.py): additive `patients.is_demo_workspace BOOLEAN NOT NULL DEFAULT FALSE`.
- [Auth router](../backend/app/routers/auth.py), [caregiver router](../backend/app/routers/caregivers.py), [simulation service](../backend/app/services/demo_caregiver_service.py): explicit owner opt-in and persisted workspace capability.
- [Onboarding](../frontend/app/onboarding/page.tsx), [API types](../frontend/lib/api.ts): opt-in checkbox and compatible request/response typing.
- [Backend environment example](../backend/.env.example), [frontend environment example](../frontend/.env.example): accurate flag semantics; no actual environment secrets changed.
- [Package manifest](../frontend/package.json), [lockfile](../frontend/package-lock.json): Playwright test infrastructure, test command and supported dependency/security updates.
- [TypeScript configuration](../frontend/tsconfig.json), [ESLint configuration](../frontend/eslint.config.mjs), [Git ignores](../frontend/.gitignore), [Vercel ignores](../frontend/.vercelignore): isolated test-build types and exclusions for generated outputs.

New executable checks and evidence:

- [Query-growth test](../backend/tests/test_query_efficiency.py), [demo-workspace tests](../backend/tests/test_demo_workspace.py), [isolated browser backend](../backend/tests/browser_server.py).
- [Playwright configuration](../frontend/playwright.config.ts), [test app runner](../frontend/tests/browser/start-app.mjs), [navigation benchmark](../frontend/tests/browser/performance.spec.ts), [workflow tests](../frontend/tests/browser/workflows.spec.ts), [anonymous production probe](../frontend/tests/browser/probe-public.mjs).
- [Read-only HTTP benchmark](../backend/scripts/benchmark_http.py), [read-only PostgreSQL profiler](../backend/scripts/profile_postgres_readonly.py).
- Six evidence files in [performance/](performance/): `baseline-production-http.json`, `local-before.json`, `local-after-navigation.json`, `local-after.json`, `production-db-readonly.json`, `production-public-browser.json`, plus this report.

No new production secret is required. Existing settings remain `MAATRUCARE_DEMO_CAREGIVERS_ENABLED=true`, `MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS=1`, and build-time `NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED=true`. Reset, seed and compatibility-auth flags must remain disabled. Production environment preflight returned zero configuration errors. Vercel's active production revision and public API/Supabase URLs were checked read-only and remain unchanged.

## F. Validation results

From [backend/](../backend/):

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q --disable-warnings
```

**131 passed, 3 skipped, 0 failed**. The three reset-execution tests remain skipped because resets are not authorized. Existing datetime/FastAPI deprecation and short synthetic test-key warnings remain; 1,859 warnings were reported.

From [frontend/](../frontend/):

```powershell
npm.cmd run test:auth
node --test tests/demo-caregiver-visibility.test.mjs
npm.cmd run test:browser
npx.cmd tsc --noEmit
npm.cmd run lint
$env:MAATRUCARE_BUILD_DIR='.next-qa'
npm.cmd run build
npm.cmd audit --omit=dev
```

Results: **23 auth tests passed; 6 visibility tests passed; 7 browser tests passed; TypeScript passed; ESLint passed; production build passed (23 generated pages); production dependency audit: 0 vulnerabilities.** A focused final benchmark rerun also passed its initial/warm duplicate-request assertions. Test-build outputs are ignored and the normal development build directory was preserved. Native Windows Edge was used; Linux CI needs a Playwright browser installation and the backend Python environment.

New migration behavior was tested twice against a disposable preceding SQLite schema, preserving the existing row and defaulting the new field to false. The migration was not executed on production PostgreSQL; PostgreSQL staging execution remains a deployment gate. No reset tests were enabled.

## G. Controlled deployment readiness

Local implementation and quality gates are complete. Production fixes are **not deployed**. Live authenticated acceptance and the original multi-minute incident are not yet verified. The current production release still has its older dependencies and behavior.

After explicit approval:

1. Review the explicit changed/new source, test and evidence files above; stage those paths only. Exclude unrelated reports, scratch helpers, backup copies, actual environment files, databases, virtual environments, node_modules and generated builds. Verify branch/remote and diff before committing or pushing.
2. Confirm an authorized PostgreSQL backup/restore procedure and run the additive migration against a disposable PostgreSQL staging database. Do not import the application against production merely to test configuration: application startup performs schema initialization.
3. Deploy backend first. Startup adds the Boolean with default false; do not run seed/reset commands. Preserve the existing managed database URL, Supabase/JWKS/issuer, exact CORS origin and simulation allowlist. Verify runtime logs and authenticated reads as well as health, which alone does not establish database connectivity.
4. Rebuild Vercel from the same reviewed revision using `frontend` as root and the existing production API/Supabase values. Keep the public simulation flag true at build time. Do not promote an older compiled build that lacks these changes or the dependency update.
5. Verify existing workspace 1 without changing its records; use a separate new fictional account for opt-in, creation and persistence checks. Verify a separate real workspace cannot create simulated caregivers and a caregiver cannot elevate access. Complete Google/email sign-in and approved fictional task/handoff flows.
6. Capture an authenticated production HAR and performance trace for Care Circle with cache state recorded. Repeat fresh-browser, warm reload and internal navigation measurements. Keep measured Render cold-start trials separate from warm trials. Confirm the deployed revision before comparing it with this report.

Rollback: restore the previous frontend first and backend application revision as needed, retaining the additive database column and all records. Do not drop tables/columns, reset the database, or restore an old backup over newly recorded work. The older backend ignores the new field and continues to use its legacy allowlist; newly opted-in demo workspaces may temporarily lose simulation availability on rollback. The global simulation flag can disable the optional feature during a controlled, separately approved rollback without deleting records. Restart the local development server when convenient to load the updated installed Next.js version.
