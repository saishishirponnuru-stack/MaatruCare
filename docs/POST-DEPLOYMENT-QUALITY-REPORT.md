# Post-deployment quality review — 8 November 2026

**Recommendation: READY WITH PATCH.** Four confirmed frontend defects are corrected locally. No push, deployment, promotion, rollback, production configuration change, authentication attempt, email, or production-record mutation was performed in this pass.

## Production baseline and safety

- Frontend remains **e0001843906c11ab9b47beeda9ac8b88a6384706**, deployment `dpl_8gS1iSsJ8beF5FgDyQNmUThR5tnJ`, at https://maatru-care.vercel.app. The public alias and authenticated hosting metadata match the documented release.
- Backend remains **4a36db6995c6020cd9d262b005293618a374711f**, Render deployment `dep-dbo10815efls73cje9u0`, at https://maatrucare.onrender.com. Health200; anonymous auth/me and Tasks401. These are protected anonymous probes, not signed-in database acceptance.
- A fresh, real-network anonymous browser inspected all twelve protected module routes. Each redirected to sign-in. No uncaught browser exceptions or unexpected4xx/5xx occurred. One401 from the deliberately unauthenticated backend probe was expected. The public browser reached backend health200/auth401 through CORS.
- Public sign-in overflow checks passed at375/768/1024/1440px in both themes. Private workflows below use disposable SQLite/JWT fixtures and provider substitutes, not real production accounts.
- Original checkout remains on release/final-2026-11-08 at4a36db6 with its existing untracked files preserved; the deployed stabilization checkout stays at e000184. New work is isolated at `C:/Users/saish/MaatruCare/maatrucare-postrelease-20261108`, branch **fix/post-release-quality-2026-11-08**, based on e000184. The new local commit hash is reported separately.

Evidence: [production metadata](performance/postrelease-baseline-production.json), [real anonymous browser probe](performance/postrelease-live-anonymous-browser.json). No patient information, authentication tokens or secret configuration values are recorded.

## Functional verification matrix

“Verified” describes isolated functional execution, including actual local API responses and persistence. **Authenticated production workflows were not exercised.** Opening a protected URL and seeing sign-in is not counted as private feature acceptance.

| Module | Isolated status | Functional evidence | Live production boundary |
| --- | --- | --- | --- |
| Authentication/onboarding | Verified | Email validation/session/recovery adapters, Google PKCE callback, preserved invitation intent, new onboarding, saved name, logout, account switching and stale-response isolation | Providers enabled and confirmation required; no real login, callback completion or mailbox request |
| Dashboard/Care Pulse | Verified | Empty/populated states, saved phase/name, due/overdue tasks, upcoming appointments, actual metrics, post-task navigation/refresh, browser-calendar boundary | Route protected; signed-in metrics not read |
| Care Circle | Verified | Real matching-email link acceptance, Pending/withdrawal, simulated labels, explicit second-Circle refusal, four sharing controls and refresh; simulated removal preserves an authenticated real member | Route protected; no invitation or caregiver written |
| Consent | Verified | Four switches synchronize with Care Circle and survive reload; backend owner/self/caregiver restrictions, revocation and cross-account denial | Route protected; no sharing changed |
| Tasks | Verified | Create/edit/assign/start/complete/reopen, due dates, strikethrough, backend deletion/audit, individual AI approval, duplicate guards and failed refresh handling | Route protected; no production task write |
| Handoffs/Story | Verified | Prepared→Sent→Acknowledged→Completed, bound real recipient, explicitly audited simulation, archive, linked task independence, timestamps, counts, invalid/revoked transitions and ordered Story | Route protected; no live handoff changed |
| AI tools/Planner | Verified with provider substitution | All existing tools, saved-fact retrieval, consent, generation/review/rejection, edited text, task review, failure/retry, history, no automatic task, pending-read navigation | Gemini key configured; external generation and real-account approval unverified |
| Appointments/Journey | Verified for supported actions | Create/edit/schedule/cancel, saved phase, dashboard/journey refresh, backend timeline/audit/permission checks | Protected routes; a separate completion action is not offered and is not claimed tested |
| Lifestyle | Verified | Water goals/corrections, overnight sleep and subjective quality, weight daily correction, activity planned/actual daily updates, nutrition goals/adherence, persisted histories and summaries | Route protected; no production lifestyle entries |
| Timeline/settings/profile | Verified | Actual recorded events/order/filtering, actor/access checks, profile/preferences persistence, failed-storage feedback, reduced motion and reset restrictions | Protected routes; reset never executed |
| UI/accessibility | Targeted verification | Responsive module samples, actual light/dark switch, long Planner/Story text, drawers/focus/Escape and closed/open mobile navigation | Public sign-in responsive checks only; no exhaustive WCAG certification |

Browser evidence: [existing product flows](../frontend/tests/browser/product.spec.ts), [workflow suite](../frontend/tests/browser/workflows.spec.ts), [signature features](../frontend/tests/browser/signature.spec.ts), [new regressions](../frontend/tests/browser/postrelease.spec.ts). Backend coverage includes [permissions](../backend/tests/test_permissions.py), [core workflows](../backend/tests/test_core_workflows.py), [tasks](../backend/tests/test_task_mutations.py), [AI review](../backend/tests/test_ai_review.py), [invitation restrictions](../backend/tests/test_invitation_membership_limits.py), and existing lifestyle suites.

## Confirmed bugs and fixes

1. **Medium — individual task decisions discard unsaved draft edits.** Generate a Planner draft, edit its summary, then approve or reject one task. The common draft loader replaced the editor with the unchanged saved output. Both browser cases failed before the fix. [AI Assist](../frontend/app/ai-assist/page.tsx) now preserves the same draft's editor during individual-task updates. Explicit whole-draft approval still persists edited text; reload verifies it. No unsaved text is silently submitted or persisted.
2. **Medium — a confirmed task still appears unsaved after its draft refresh fails.** Allow task POST201, then return503 for the follow-up draft GET. The task exists, but the old UI keeps its save control and omits the created card. The patch records the actual returned task ID in the local suggestion review immediately after the successful save. It retains accurate refresh-error feedback and unsaved edits. Repeated creation is no longer offered; the backend's existing idempotence remains unchanged. A failed POST never reaches this state update.
3. **Low — long appointment text escapes the mobile Planner.** A valid177-character unbroken title extended to x1433.6 on a375px viewport. [PlannerContext](../frontend/components/ai/PlannerContext.tsx) now allows intrinsic word wrapping. Text fits a305px content width with right edge340 in both themes, without truncation or hiding.
4. **Low — closed mobile navigation dims the page.** The disabled backdrop's computed opacity was0.58: the global disabled-button selector overrode its opacity-zero class. This caused the viewport-sized grey layer seen in visual review even with the menu closed. [Sidebar](../frontend/components/layout/Sidebar.tsx) now explicitly sets backdrop opacity from the open state, preserving its disabled/pointer/keyboard behavior. Regression verifies closed0, open visibility, Escape and opener focus restoration. The global button styling is preserved.

The original targeted run recorded **4 failures/9 passes** for the first three defects (approval and rejection are separate cases). The backdrop additionally failed its own computed-opacity assertion before correction. All assertions remain. A date-boundary/hydration probe passed before any change; no speculative date fix was made. [Dark](review/postrelease-planner-dark.png) and [light](review/postrelease-planner-light.png) fictional screenshots were inspected; the final captures show readable wrapped text and no closed-menu dimming.

## Performance — observations, not a universal speed claim

The following are individual authenticated local measurements using the same optimized Next/browser harness and disposable backend. They are not controlled production percentiles. Timing includes browser readiness/scrolling, cache/compiler warmth and host variability; before/after differences alone do not prove a CPU improvement.

| Measurement | Deployed-source baseline | Final patch observation |
| --- | ---: | ---: |
| Dashboard readiness | 713ms | 357ms |
| Dashboard initial API reads | 10 | 10 |
| auth/me round trip | 17ms | 14ms |
| Dashboard→AI Assist | 135ms | 79ms |
| AI Assist→Handoffs | 99ms | 56ms |
| Tasks navigation | 87ms | 57ms |
| Care Circle navigation | 70ms | 53ms |
| Task-save experiment, including UI/readiness | 169ms | 924ms |
| Task-save API requests | 4 | 4 |
| Dashboard time-range requests | 1 | 1 |
| Care Circle initial duplicate API requests | 0 | 0 |

- Task-save timing worsened in the end-to-end experiment; a broad save-speed improvement is **not** claimed. The previous release already reduced ten task-save requests to four; this patch retains that result and introduces no new cache, background polling or authorization shortcut.
- Responsiveness under a held draft read is directly verified: the confirmed task card becomes visible6ms after POST acknowledgement and navigation succeeds in88ms while that GET remains pending. This removes the unnecessary dependency of successful task feedback on a second read, without inventing write success.
- Fresh/warm Care Circle usability was409/166ms before and320/172ms after; initial JS transfer was287478/287477 bytes, warm0. Those small differences do not establish a bundle optimization. No meaningful dependency/bundle weight was added.
- A separate development-mode sample recorded dashboard2357ms, initial AI963ms, Handoffs790ms, Tasks683ms and Care Circle672ms; warmed AI161ms. It used the same ten initial API reads, with local auth14ms and other initial API calls55–132ms. Development startup/first-route compilation is a substantial measured cost; exact time cannot all be assigned to React rendering or SQL. No claim that this patch removes development compilation overhead is made. This sample predates only the final backdrop opacity correction, which changes no requests.
- The real anonymous public document had TTFB61.6ms, DOM-content readiness575.7ms and290803 bytes of JS transfer. Protected-route sign-in readiness ranged474–1255ms. Remote backend anonymous round trips were268–475ms including network/service costs; these are not signed-in database timings or proven cold starts.
- No production cold start was forced. The historic approximately20-second authenticated incident was not reproduced or declared fixed. Current authenticated production/JWKS/model latency needs a separately authorized trace.
- Backend query-growth regressions remain green. No backend runtime/query/database tuning was introduced without evidence.

Raw evidence: [before navigation](performance/postrelease-before-navigation.json), [before application profile](performance/postrelease-before-performance.json), [final navigation](performance/postrelease-after-navigation.json), [final application profile](performance/postrelease-after-performance.json), [development](performance/postrelease-development.json).

## Tests and configuration findings

Run from the isolated worktree. The original Python virtualenv was reused; test fixtures force disposable databases. No environment file or original development database was copied or modified.

- `python -m pytest tests -q --disable-warnings` from backend: **154 passed,3 skipped,0 failed**,2458 warnings,20.63s. Three reset execution cases stay skipped.
- `node --test tests/api-concurrency.test.mjs tests/auth-flow.test.mjs tests/demo-caregiver-visibility.test.mjs tests/care-pulse.test.mjs tests/ai-drafts.test.mjs tests/read-coalescer.test.mjs tests/invitation-limits.test.mjs`: **51 passed,0 failed,0 skipped**.
- `npx.cmd tsc --noEmit` and `npm.cmd run lint`: exit0.
- Fresh optimized-build full Playwright suite: **37 passed,0 failed,0 skipped**,1.4m. Eight new browser cases extend the prior29. Earlier full36 also passed before the final backdrop regression/fix. Unexpected browser/hydration/server errors remain failing assertions; only the deliberate exact draft-read503 is additionally allowlisted.
- Development profiling: **1 passed**,20.5s including startup. Final `npm.cmd run build`: **exit0**,23 prerendered routes, build ID `0eHeAxv8eLdh56SLrINth`. It uses isolated `.next-qa` output, process-local public settings and the production API URL; no environment file changes or deployment occur. Explicit TypeScript/lint checks were repeated after the final source/test changes.
- Runtime-only `npm audit --omit=dev --json`: **0 advisories**. `npm ci` reported eight moderate advisories including development dependencies; no dependency upgrade or automatic audit fix was attempted in this scoped patch.
- Public Supabase settings show Google and email enabled, with email confirmation required. Callback/redirect sanitization is covered locally. Dashboard redirect allowlist, Site URL, SMTP/templates and actual Google/email completion remain unverified without authorized Dashboard/account access. No sign-in or authentication email was initiated.
- Render configuration was read without printing values: invitation sending key/sender absent and delivery not enabled; Gemini configuration present. **Invitation email is unavailable**, not sent. Preserve secure link creation/sharing. Enabling email later requires an owned verified sender, server-side provider key and explicit configuration approval, followed by acceptance/inbox verification. See [safe configuration evidence](performance/postrelease-external-configuration-check.json).

One isolated browser invocation encountered SQLite `database is locked` errors during initial reads before its UI assertion; a fresh disposable invocation and the final full suite completed. This intermittent local SQLite condition was not attributed to production PostgreSQL or silently ignored. Its exact lock holder remains unidentified and it may warrant investigation if local slowness recurs. The temporary dependency-sharing junction also proved incompatible with Turbopack's filesystem boundary; it was removed safely and the new worktree received its own locked dependencies. One overquoted test filter selected no cases and was corrected before actual execution. None of these environment incidents was reported as a successful run or hidden by relaxed application assertions.

## Multi-Care-Circle follow-up — no implementation

The existing [precise membership design](INVITATION-MEMBERSHIP-DIAGNOSIS.md) was reviewed against the unchanged deployed backend. It covers all required identity, roles, selection, invitations, permission isolation, cache, migration and rollback concerns. Current Account still has one patient/caregiver binding; additional-circle acceptance returns409 and leaves Pending. The current frontend preserves the invitation and explains that refusal.

Minimum safe future work: add an explicit unique account/Circle membership with per-Circle role and active/revoked state; backfill only unambiguous existing bindings while preserving IDs/grants/history; retain the legacy default binding for old clients; authorize selected membership on every request; scope all providers/coalescing/private responses by membership and invalidate on switch. Accept a valid matching verified-email invitation transactionally with token claim/row lock, membership uniqueness and accepted-by provenance; new grants start disabled. Define same-member, revocation/reactivation, decline and repeat-acceptance semantics explicitly. A selector or second caregiver row alone cannot safely implement this.

Rehearse additive migrations/backfill and concurrent acceptance/revocation on isolated PostgreSQL with a verified recovery path. Audit all module reads/writes, cross-Circle/owner escalation, pending-response switching and multi-tab behavior. Roll out compatible backend and frontend behind a separately approved flag. Roll back code/flags while retaining all additive records; never rewrite legacy account bindings or restore an old backup over new activity. **Separate approval and architectural work are required. No membership schema or authorization redesign is in this patch.**

## Final handoff

Runtime changes: [AI Assist](../frontend/app/ai-assist/page.tsx), [PlannerContext](../frontend/components/ai/PlannerContext.tsx), [Sidebar](../frontend/components/layout/Sidebar.tsx). Test changes: [eight browser regressions](../frontend/tests/browser/postrelease.spec.ts) and [scoped failure diagnostics](../frontend/tests/browser/fixtures.ts). Other additions are this report, synthetic screenshots and sanitized measurements.

**No backend API contract, model, migration, dependency, identity or consent change.** This is compatible with deployed backend4a36db6. After review and fresh explicit deployment authorization, only the existing Vercel frontend needs a candidate build and smoke verification before promotion. Keep e000184 as the then-current frontend rollback target; preserve all production data. No automatic deployment or main push is authorized.

Remaining boundaries: real provider sign-in/recovery and redirect/SMTP settings; actual Gemini generation; invitation email; authenticated live mutations; unsupported multiple memberships; exhaustive accessibility/security/load testing; and the intermittent isolated SQLite lock. Existing production is available, but it is not described as fully accepted for real clinical data or all external integrations.
