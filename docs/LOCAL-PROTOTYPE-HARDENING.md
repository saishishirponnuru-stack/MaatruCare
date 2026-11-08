# Local prototype hardening — 8 November 2026

**Local engineering candidate only. Nothing was pushed, deployed, promoted, or changed in production. Real OAuth acceptance and production-specific latency remain unverified.**

## A. Implementation and safety

Work is isolated at `C:/Users/saish/MaatruCare/maatrucare-polish-20261108`, branch `fix/local-polish-2026-11-08`, based on `70585b762f95c13639210ca4bf88806f9a7291a7`. The final local commit is reported separately. The safe worktree's existing generated instructions-file change and all local artifacts were preserved. The original checkout, submitted production frontend `e000184`/backend `4a36db6`, rollback deployments, and parked multi-Circle worktree were not modified.

- An unchanged account refresh preserves the previous React account snapshot. It still performs the authenticated server lookup; equal results no longer restart the entire coordination provider's six independent reads. Changed profile fields, subject changes, failures, explicit workspace refreshes and mutation invalidation retain their behavior. No settled private-data cache was added.
- Navigation uses Next's actual Link pending state and a route loading boundary, with a busy main region and usable navigation. There are no artificial delays, percentages, fabricated counts or successful-error fallbacks. The original page structure and coordination provider remain intact.
- A shared [BrandLogo](../frontend/components/ui/BrandLogo.tsx) preserves the original transparent512px mother-and-child emblem and uses a crisp, theme-aware text wordmark/tagline. Sidebar, compact header and sign-in use the same component and correct small image sizes. No raster asset was replaced or new branding invented.
- Explicit local fictional onboarding can create three simulated relationships atomically, using the same transaction-neutral creation function as Add simulated caregiver. All their sharing categories start **disabled**.
- Lifestyle deletion now requires a signed, five-minute, subject/workspace/option-bound preview of actual record identities **and values**. Deletes use exact reviewed IDs, in a transaction, with stale-preview, duplicate and concurrent-write protection. It remains behind the existing local/demo allowlist and controller authorization.
- A failed demo-options lookup cannot block changing the form to an ordinary caregiver invitation. The checkbox wording reflects the backend's actual capability, including older-backend fallback.

**No SQL model or migration changes.** The request schema gains a preview token; a small authenticated onboarding-capability read is added. No core authentication, role, membership or consent model was replaced. Multi-Circle remains unsupported and its existing409 explanation is preserved.

## B. Performance evidence

Baseline optimized-build benchmarks ran before application edits; the final benchmarks used the same headless Edge harness, disposable SQLite, synthetic identities and provider substitutes. Three repetitions per benchmark ran before and after. The original harness retains the last baseline file; the final repeated output also retains all three observations. Counts are scoped to a single measured phase, not an accumulated Network Preserve Log.

| Measurement | Baseline evidence | Final observations |
| --- | --- | --- |
| Task GETs caused by an unchanged profile refresh | 1; regression failed before correction | **0**, regression passes |
| Dashboard readiness | 370ms last baseline observation | 486/353/468ms in the three controlled final repetitions |
| Dashboard→AI Assist | 72ms last baseline | 95ms final median |
| AI Assist→Handoffs | 116ms last baseline | 72ms final median |
| Tasks navigation | 60ms last baseline | 72ms final median |
| Care Circle navigation | 55ms last baseline | 50ms final median |
| Task-save experiment, including UI readiness/scrolling | 142ms last baseline | 915/110/114ms; four requests in every run |
| Initial dashboard API reads | 10 | 10 |
| Duplicate initial/warm Care Circle API reads | 0/0 | 0/0 |
| Actual selected sign-in image responses at1440px | 88,152 bytes,2 unique images | **1,564 bytes,1 unique image** |

The unchanged-profile reload and oversized/duplicated branding responses are the confirmed avoidable work. The image comparison uses fresh anonymous browser contexts and standardized WebP responses for the browser-selected image URLs; baseline localhost is development mode and polished localhost is optimized mode. It measures image payload, **not** a page-speed percentage. The emblem asset is unchanged. JavaScript transfer did not decrease; the added boundary/UI has a small bundle cost.

Local navigation timings vary and several comparisons are slower. **No general navigation-speed improvement or production RSC/CDN/Render cold-start fix is claimed.** The reported8–11-second production page requests were not reproduced. Backend timings, browser rendering and network transport cannot be inferred from a screenshot's aggregate request count.

A controlled resource-hold check found that the static Lifestyle route can render while two optional JavaScript requests remain held (107ms in the final full-suite observation). It verifies usable navigation rather than demanding an unnecessary spinner after a completed route. Initially the new test incorrectly assumed a specific RSC URL and then assumed held optional chunks must block the page; these assumptions were corrected after inspecting actual requests. The genuine unresolved-route fallback is implemented, but live production slow-RSC behavior is not verified.

Evidence: [baseline application timing](performance/polish-before-application.json), [baseline navigation](performance/polish-before-navigation.json), [three final repeated measurements](performance/polish-repeat-after.json), [final full-suite application measurement](performance/polish-final-application.json), [final full-suite navigation](performance/polish-final-navigation.json), [branding payload measurement](performance/polish-brand-transfer.json).

## C. Visual review

The original emblem was inspected and its transparency confirmed. All four full screenshots below were opened and visually inspected. Sidebar/compact crops were also checked. Both themes retain the editorial layout, restrained colors and typography; no rectangular logo background, clipping or theme-driven layout shift was observed. Automated geometry/image checks include1440/768/375px. These checks are not an exhaustive accessibility certification.

- [Light desktop](review/polish-light-1440.png) and [dark desktop](review/polish-dark-1440.png).
- [Light mobile](review/polish-light-375.png) and [dark mobile](review/polish-dark-375.png).
- Sidebar: [light logo](review/polish-light-1440-logo.png), [dark logo](review/polish-dark-1440-logo.png).
- Compact header: [light logo](review/polish-light-375-logo.png), [dark logo](review/polish-dark-375-logo.png).

## D. Actual test results

The existing virtualenv interpreter is `C:/Users/saish/MaatruCare/maatrucare/backend/.venv/Scripts/python.exe`; application source and working directories are exclusively this new worktree. Conftest and browser fixtures explicitly override database URLs to temporary SQLite before imports and blank Gemini/Resend credentials. No backup or real patient record is a fixture.

| Invocation | Final result |
| --- | --- |
| Backend: set process-only `MAATRUCARE_RUN_RESET_TESTS=true`; `python -m pytest tests -q --tb=short --disable-warnings` | **183 passed,0 failed,0 skipped**,3008 warnings,18.17s |
| `node --test tests/*.test.mjs` | **54 passed,0 failed,0 skipped** |
| `npx.cmd tsc --noEmit` | exit0 |
| `npm.cmd run lint` | exit0 |
| `npm.cmd run build` | exit0; Next16.4.5,23 prerendered routes; also rebuilt with isolated local API/auth configuration for manual testing |
| `npx.cmd playwright test` | **43 passed,0 failed,0 skipped**,1.3m; optimized build |
| `npx.cmd playwright test --config playwright.polish.config.ts` | **3 passed,0 failed,0 skipped**,13.2s; opt-in sample/reset fixture mode |
| Performance subset, `--repeat-each=3` | **6 passed** before changes; **6 passed** in the final controlled repetition run |
| Anonymous browser probe on actual localhost3002/8002 | 13 protected routes; health200/auth401;0 uncaught errors;0 production-backend requests;0 mutations/sign-in attempts |
| `npm.cmd audit --omit=dev --json` | 0 runtime vulnerabilities reported; package versions unchanged |
| `git diff --check` | exit0 |

Baseline evidence was165 backend passed/3 reset cases intentionally skipped,51 Node and39 browser cases. This task explicitly authorizes destructive testing **only against disposable data**, so the three existing reset cases were enabled by process flag, not deleted or disabled. New tests add concurrency, rollback, same-count edits, stale/expired/tampered previews, subject isolation, sample opt-in/production gating and UI persistence. Existing reset helper requests now include the stronger preview token; the repeated empty reset correctly expects409. Every original preservation assertion remains.

Intermediate failures were investigated: the unchanged-profile regression failed with one task reload before the fix; the pending-navigation test had the invalid assumptions described above; new UI tests initially used wrong task-button names and attempted to click a visually hidden radio instead of its visible label. Those selectors were corrected while retaining their behavior assertions. One unchanged invitation regression timed out during concurrent production build/backend testing: backend suite time rose from22s to101s under that load. It passed again with the original45s timeout when tests ran sequentially. The final full suite is green; no failure was suppressed or timeout increased.

Existing UTC/lifespan and short synthetic-test-key warnings remain. Dependency installation reported eight moderate development-tooling advisories and an ESLint deprecation; no forced dependency upgrade was performed. Runtime audit reports zero advisories at this check, not a security certification.

| Functional area | Verified isolated behavior |
| --- | --- |
| Auth/profile/onboarding | Input validation, SDK session/callback adapters, real signed synthetic JWT authorization, saved greeting/profile, refresh, logout, cross-account/stale-request isolation, failed demo-options→invitation transition |
| Care Circle/Consent | Real invitation-link acceptance/withdrawal, explicit second-Circle rejection, simulated participants, stable IDs, sharing persistence/revocation, self/foreign denial |
| Tasks/Dashboard/Care Pulse | Create/edit/assign/complete/reopen, persisted counts and updates, unchanged-account refresh stability, actual empty/unavailable states |
| Handoffs/Story/Timeline | Prepare/send/authorized acknowledgement/completion, real-recipient restrictions, honestly audited simulations, archive, linked task independence, actual chronological events |
| AI Planner/tools | Safe provider substitutes, distinct tools, editing, draft approve/reject, explicit individual task approval/rejection, persistence, duplicate clicks, failure/retry and navigation |
| Journey/Appointments | Saved phase and appointment create/edit/cancel, coordination updates |
| Lifestyle/settings | All five trackers, history and summaries after refresh, goals, safe reset preview/confirmation/stale handling, settings/preferences, keyboard/focus and responsive themes |

## E. OAuth status and exact manual action

Application redirect construction is already origin-based: Google uses `callbackUrl(window.location.origin, ...)`; no production redirect is hardcoded into localhost. New tests independently validate localhost3001, localhost3002 and production URLs, including rejection of external `next` destinations. Browser integration verifies Google PKCE construction with a substituted provider.

The reported redirect to the production Site URL is consistent with Supabase rejecting an unallowlisted localhost redirect. **The actual Dashboard allowlist was not accessible/verified and was not changed. No real sign-in using the user's account was attempted.**

In Supabase → Authentication → URL Configuration, manually verify/add **Additional Redirect URLs** only, after the owner chooses to do so:

```text
http://localhost:3001/auth/callback
http://localhost:3001/auth/callback**
http://localhost:3002/auth/callback
http://localhost:3002/auth/callback**
```

The narrow callback suffix follows the existing repository convention for sanitized onboarding/invitation/recovery query parameters. Supabase documents the allowlist requirement and local wildcard support in its [official redirect guide](https://supabase.com/docs/guides/auth/redirect-urls). Keep the production Site URL and existing production redirects. Do not alter Google Cloud credentials or its Supabase callback `https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/callback`. Confirm both plain login and invitation/recovery return locally before testing authenticated local writes. Stop a local test if OAuth returns to production.

## F. Fictional onboarding

Set `MAATRUCARE_DEMO_CAREGIVERS_ENABLED=true` plus the new **local-only**, default-false `MAATRUCARE_DEMO_ONBOARDING_SEED_ENABLED=true`; the frontend's existing public simulation flag is also required for its checkbox. The authenticated options endpoint tells the UI whether seeding is available.

Only a **new** explicitly fictional owner workspace gets Ananya Rao—Partner, Meera Rao—Mother, Priya Sharma—Sister. No Supabase users, invitations, emails, tasks, clinical records or caregiver acknowledgements are created. All five caregiver permissions start false; no consent grants are fabricated. The owner must explicitly enable Coordination tasks/Care handoffs before those assignments/transfers. Members are clearly Simulated and cannot authenticate.

One transaction creates account/profile/samples; partial failure rolls everything back. Repeated/concurrent bootstrap yields one workspace and three samples, preserves existing members and never resurrects removed members. Existing workspaces return before seeding and cannot be converted. There is no existing caregiver-count limit to change; the operation adds only these fixed three to a new empty Circle.

**Production and Render seeding are hard-disabled even if the new flag is accidentally true.** A separately approved product rollout would need an explicitly reviewed production policy/code change. Startup's old global seed flag remains false; the fresh manual database starts with no records.

## G. Lifestyle reset scope and safeguards

Existing gates remain: controller/owner authorization, exact patient scope, `MAATRUCARE_DEMO_RESET_ENABLED=true`, `MAATRUCARE_ENV=local|demo`, not Render, and an explicit patient-ID allowlist. Production reset is **not enabled**.

Deletion categories: water, sleep, weight, meal/nutrition entries, nutrition-plan adherence, activity check-ins. Optional separate selection removes personal lifestyle preferences/goals. Activity routines and nutrition plans remain. There is no medication-log model to assume or clear.

Always preserved: authentication, profile, caregivers, invitations, permissions/consent, tasks, appointments, handoffs, existing timeline/audit history, AI drafts/plans, all other workspaces. The new audit/timeline entry records the reset action/actor/time without deleted notes or measurements.

A five-minute signed preview binds the subject, patient, preferences option and fingerprint of IDs/values. Editing a row without changing its count still invalidates confirmation. SQLite reserves writes before comparison; the PostgreSQL code path uses row locks. Deletion targets exact reviewed IDs so newly inserted records cannot silently join the deletion set. Rollback and concurrent duplicate-confirmation cases are tested on SQLite. The UI locks duplicate submissions, refreshes preview after completion/failure and disables empty confirmations. A successful reset followed by failed preview reload is reported as saved with reload unavailable, not as an unsuccessful deletion.

Remaining future gates: retention/user-consent approval for ordinary real-care use; independently exercised PostgreSQL reset concurrency; shared signing-key/preview policy for multiple workers. The current process-local signing key intentionally invalidates previews after restart. No production reset was executed and no production schema/data was accessed.

## H. Readiness boundaries

**Implemented locally and automatically verified:** targeted identity-refresh optimization, responsive branding, origin-safe callback construction, local explicit samples, stronger local reset, existing product workflows.

**Visually inspected:** four theme/viewport captures and logo crops. **Not manually verified:** real Google/email login, recovery/confirmation mailbox delivery, real Gemini generation, real caregiver email, authenticated production workflows. Those integration boundaries are not proven by substituted providers. Gemini/Resend keys are intentionally absent from manual QA; invitation links remain available.

**No SQL migration required. Not declared production-ready.** Backend-first API compatibility review, controlled manual account acceptance, redirect configuration, privacy/retention decisions and fresh explicit deployment approval are still required. Keep production on its protected known-good revisions. Multi-Circle is excluded.

## I. Exact local testing

The new optimized candidate runs at **http://localhost:3002/sign-in**; backend **http://127.0.0.1:8002/api/health**. Earlier3000/8000 and safe-baseline3001/8001 services are preserved. Do not confuse3001 with this new candidate.

A fresh SQLite database lives outside Git at `%LOCALAPPDATA%/MaatruCareLocalQA/polish-20261108/manual-test.sqlite3`. Before importing application code, the runner overrides DATABASE_URL, verifies the SQLite engine and exact file via PRAGMA, clears external provider/service-role secrets, disables auth compatibility and startup seeding, and limits CORS/API URLs to the local app. Initial schema:21 empty tables. Supabase is used for real authentication only; no Supabase/Render database connection is configured.

Use a designated synthetic account in a separate browser profile. Verify the allowlist before Google login. Complete local onboarding with a fictional name and check the fictional workspace option. Confirm three Simulated members after refresh; explicitly grant only needed categories, create/complete a fictional task, prepare/send/simulate a handoff, and inspect Story/Pulse/Timeline. Log fictional lifestyle entries. Reset is available only to the first local workspace(ID1) and still requires preview/native confirmation; it never runs in the background. Other local IDs remain unallowlisted. The manual database is separate from all automated fixtures and production records.

Safe startup runner and public-only auth settings are outside Git. If a service exits, use two PowerShell terminals; commands refuse occupied ports and preserve the disposable database:

```powershell
Set-Location 'C:\Users\saish\MaatruCare\maatrucare-polish-20261108'
& 'C:\Users\saish\MaatruCare\maatrucare\backend\.venv\Scripts\python.exe' "$env:LOCALAPPDATA\MaatruCareLocalQA\polish-20261108\run-local.py" backend
```

```powershell
Set-Location 'C:\Users\saish\MaatruCare\maatrucare-polish-20261108'
& 'C:\Users\saish\MaatruCare\maatrucare\backend\.venv\Scripts\python.exe' "$env:LOCALAPPDATA\MaatruCareLocalQA\polish-20261108\run-local.py" frontend
```

The frontend runner builds with local API/auth variables and then uses `next start`, keeping compilation overhead out of ordinary manual navigation. Neither command deploys, resets a database, sends email, creates auth accounts, or uses a production datastore.

## J. Final Git inventory

Only the isolated polishing branch may receive the verified local commit. All modified source, tests, public example settings and requested screenshots are listed below relative to70585b7. Generated old regression captures were archived outside Git and restored to their starting bytes; dependencies, builds, private QA files, databases, logs and secrets are excluded. The final commit and clean status are reported after the commit succeeds.

- [backend/.env.example](../backend/.env.example)
- [backend/app/lifestyle_schemas.py](../backend/app/lifestyle_schemas.py)
- [backend/app/routers/auth.py](../backend/app/routers/auth.py)
- [backend/app/routers/caregivers.py](../backend/app/routers/caregivers.py)
- [backend/app/routers/lifestyle.py](../backend/app/routers/lifestyle.py)
- [backend/app/services/audit_service.py](../backend/app/services/audit_service.py)
- [backend/app/services/lifestyle_reset_service.py](../backend/app/services/lifestyle_reset_service.py)
- [backend/app/services/simulated_caregiver_service.py](../backend/app/services/simulated_caregiver_service.py)
- [backend/tests/browser_server.py](../backend/tests/browser_server.py)
- [backend/tests/conftest.py](../backend/tests/conftest.py)
- [backend/tests/test_demo_onboarding_seed.py](../backend/tests/test_demo_onboarding_seed.py)
- [backend/tests/test_lifestyle_reset.py](../backend/tests/test_lifestyle_reset.py)
- [backend/tests/test_lifestyle_reset_safety.py](../backend/tests/test_lifestyle_reset_safety.py)
- [docs/CODEX-SESSION-HANDOFF.md](../docs/CODEX-SESSION-HANDOFF.md)
- [docs/LOCAL-PROTOTYPE-HARDENING.md](../docs/LOCAL-PROTOTYPE-HARDENING.md)
- [docs/performance/polish-after-application.json](../docs/performance/polish-after-application.json)
- [docs/performance/polish-after-navigation.json](../docs/performance/polish-after-navigation.json)
- [docs/performance/polish-before-application.json](../docs/performance/polish-before-application.json)
- [docs/performance/polish-before-navigation.json](../docs/performance/polish-before-navigation.json)
- [docs/performance/polish-brand-transfer.json](../docs/performance/polish-brand-transfer.json)
- [docs/performance/polish-final-application.json](../docs/performance/polish-final-application.json)
- [docs/performance/polish-final-navigation.json](../docs/performance/polish-final-navigation.json)
- [docs/performance/polish-local-anonymous.json](../docs/performance/polish-local-anonymous.json)
- [docs/performance/polish-repeat-after.json](../docs/performance/polish-repeat-after.json)
- [docs/review/polish-dark-1440-logo.png](../docs/review/polish-dark-1440-logo.png)
- [docs/review/polish-dark-1440.png](../docs/review/polish-dark-1440.png)
- [docs/review/polish-dark-375-logo.png](../docs/review/polish-dark-375-logo.png)
- [docs/review/polish-dark-375.png](../docs/review/polish-dark-375.png)
- [docs/review/polish-light-1440-logo.png](../docs/review/polish-light-1440-logo.png)
- [docs/review/polish-light-1440.png](../docs/review/polish-light-1440.png)
- [docs/review/polish-light-375-logo.png](../docs/review/polish-light-375-logo.png)
- [docs/review/polish-light-375.png](../docs/review/polish-light-375.png)
- [frontend/app/globals.css](../frontend/app/globals.css)
- [frontend/app/loading.tsx](../frontend/app/loading.tsx)
- [frontend/app/onboarding/page.tsx](../frontend/app/onboarding/page.tsx)
- [frontend/app/settings/page.tsx](../frontend/app/settings/page.tsx)
- [frontend/components/auth/AuthPageShell.tsx](../frontend/components/auth/AuthPageShell.tsx)
- [frontend/components/layout/AppShell.tsx](../frontend/components/layout/AppShell.tsx)
- [frontend/components/layout/NavigationPending.tsx](../frontend/components/layout/NavigationPending.tsx)
- [frontend/components/layout/Sidebar.tsx](../frontend/components/layout/Sidebar.tsx)
- [frontend/components/layout/Topbar.tsx](../frontend/components/layout/Topbar.tsx)
- [frontend/components/ui/BrandLogo.tsx](../frontend/components/ui/BrandLogo.tsx)
- [frontend/context/AuthContext.tsx](../frontend/context/AuthContext.tsx)
- [frontend/lib/api.ts](../frontend/lib/api.ts)
- [frontend/playwright.polish.config.ts](../frontend/playwright.polish.config.ts)
- [frontend/tests/auth-flow.test.mjs](../frontend/tests/auth-flow.test.mjs)
- [frontend/tests/browser/polish.scenario.ts](../frontend/tests/browser/polish.scenario.ts)
- [frontend/tests/browser/polish.spec.ts](../frontend/tests/browser/polish.spec.ts)
