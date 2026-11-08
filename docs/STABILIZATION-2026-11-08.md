# MaatruCare — focused stabilization results

8 November 2026. Prepared in the isolated worktree `C:/Users/saish/MaatruCare/maatrucare-stabilization-20261108`, branch `fix/stabilize-ai-2026-11-08`, based on **4a36db6995c6020cd9d262b005293618a374711f**. The verified changes are prepared for an explicitly authorized local review commit after the gates below; its resulting hash is reported separately. The existing release checkout/branch, its eleven untracked files, and the running localhost3000/8000 services were preserved. No push, production deployment, database mutation, reset, environment change or credential change occurred in this stabilization task.

## 1. Approval root cause and reproduction — VERIFIED

The previous editor initialization used `care_update ?? handoff_summary ?? summary` for every tool. The shared output schema permits those optional strings to be empty or populated even for another operation. A valid planner response with `care_update: ""` therefore selected an empty editor instead of its nonempty summary. The approval button was disabled. The same selection could discard the visible edited summary after a successful approval response or select unrelated output.

The browser reproduction used the actual frontend and authenticated local FastAPI endpoints, with only Gemini's external response substituted. It logged an empty editable value and disabled approval, and failed its expected-text assertion before the fix. This demonstrates a real supported-response defect; the user's private production draft was not inspected.

The backend review endpoint itself correctly persisted edited text and approval when called. New isolated API regressions cover six operation-specific output fields, draft ownership, revoked sharing, rejection, validation errors and zero automatic tasks. There was no need to weaken authorization, change the API or alter database persistence.

### Implemented fix

- [Operation-specific editor text](../frontend/lib/ai-drafts.ts) selects summary for plans/extraction/summarization/appointment preparation, care_update for update drafts, and handoff_summary for handoffs. Blank specialized text falls back to summary. Unrelated fields cannot override the intended text.
- [Draft review controls](../frontend/components/ai/DraftReviewActions.tsx) show immediate approving/rejecting state, prevent duplicate clicks, retain edits on failure, disable the editor during submission, and clearly label a saved unchanged approval. Editing re-enables approval. Proposed tasks remain individually reviewable.
- [Action feedback](../frontend/components/ai/ActionFeedback.tsx) places success/errors beside the relevant action and brings an error into view immediately, without animation or a fabricated delay. The full browser suite caught and verified a mobile error that was below the viewport; the assertion was retained and the implementation corrected.
- [AI Assist](../frontend/app/ai-assist/page.tsx) distinguishes draft approval, generation, rejection and individual task saves. It no longer misleadingly says Preparing draft during every operation. Tool switching is disabled during pending operations. Draft/individual rejection persists; copied approved updates explicitly say no message was sent. Created task cards show the saved edited title.
- The complete planner flow now passes: select tool → note/consent → generation → edit → actual review POST200 → persisted Approved/edited summary → reload/history restoration → separate individual task approval or rejection. No task is created by whole-draft approval.

## 2. Measured bottlenecks and targeted optimizations

### Unnecessary requests — VERIFIED REDUCTIONS

Approving one proposed task previously performed its POST, a draft GET, six unrelated full-workspace reads, and two planning-facts reads. Clearing shared records during the full refresh also produced a temporary empty/loading planning view.

- The existing shared-context saved-task mapper is now exposed as [syncSavedTask](../frontend/context/MaatruCareDemoContext.tsx). AI approval uses the actual successful Task response to update Tasks/Care Pulse, refreshes Timeline, and reloads the draft's persisted review. It checks the task belongs to the current workspace. Unrelated caregivers, permissions, consent history and handoffs are not refetched.
- Observed task-save requests: **10 → 4**, a60% reduction. Planning-facts reads after that save: **2 → 1**. The saved task is shown immediately through existing shared state; failures reloading its draft are reported as a saved-task/reload problem, not a failed write or fake success.
- Dashboard period selection previously loaded both analytics and the period-independent lifestyle history. [CoordinationOverview](../frontend/components/dashboard/CoordinationOverview.tsx) now loads those independently. Period change: **2 requests → 1**. Analytics can render without waiting for lifestyle. Both retain explicit failure/retry handling.
- React development Strict Mode exposed duplicate concurrent appointments and draft-history reads. [ReadCoalescer](../frontend/lib/read-coalescer.ts) and the [API wrapper](../frontend/lib/api.ts) share only identical in-flight parsed GET results, keyed by subject, access token, method and path. There is **no persistent response cache or TTL**. Custom signals/headers are not combined. Writes invalidate pending generations before/after execution; overlapping stale reads refetch rather than return pre-write records. Existing auth refresh and changed-subject checks remain.
- Development initial dashboard API reads: **11 → 10**, with appointments **2 → 1**. Draft-history reads on AI navigation: **2 → 1**. Production dashboard initial reads stay10; those are real, distinct reads, not presented as eliminated duplicates.

### Before/after observations — limits explicit

Authenticated synthetic browser measurements use the same optimized Next build harness, native headless Edge and isolated SQLite backend. Navigation completion means URL plus shared loading state, not completion of every page-specific effect. Task-save timing includes Playwright scrolling/clicking, visible confirmation and planning-context readiness. These are individual local observations, **not statistically controlled production percentiles or a speed guarantee**.

- Production dashboard: **555ms before / 591ms final**. No initial-load speed improvement is claimed.
- Dashboard → AI Assist: **86 / 93ms**; AI Assist → Handoffs: **98 / 102ms**; Tasks: **89 / 89ms**; Care Circle: **51 / 70ms**. These differences are within the observed host variability; navigation is not claimed materially faster in production mode.
- Proposed-task save: **1136 / 953ms** in those production observations, with the robust10→4 request reduction above. An intermediate run was1143ms; the point estimates do not establish a universal latency improvement.
- Development dashboard: **2195 / 1865ms**; first AI route **1094 / 444ms**; Handoffs **763 / 406ms**; Tasks **684 / 327ms**; Care Circle **617 / 305ms**. Warm AI navigation was180 /214ms. Compiler/cache warmth differs, so these do not prove all development overhead was removed.
- Development task-save observation was212ms before /1000ms final despite fewer requests; a performance win is **not** claimed for that timing. Different browser scrolling/readiness/host conditions make request count a stronger result than this single duration.
- A subsequent commit-validation run recorded788ms initial dashboard and1016ms task save, with the same10→4 task-save and2→1 range-request reductions. [Its raw evidence](performance/stabilization-commit-validation.json) is retained to show timing variability rather than selecting only the fastest observation. The final invitation-validation run recorded597ms/1006ms respectively, preserving both request reductions; [the measurements](performance/stabilization-invitation-validation.json) and [navigation results](performance/stabilization-invitation-navigation.json) are also retained.
- A development run concurrent with other verification took5969ms for the dashboard. Development compilation and machine contention remain visible; adding client memoization or claiming a Render cold start caused that local result would be unsupported.
- The production Care Circle benchmark retained25 requests,2 contextual prefetches,9 API reads,0 duplicates, and one auth/me per document. Final fresh/warm usability was approximately674/259ms; JavaScript network transfer was287441/0 bytes. This preserves the previous navigation-prefetch improvement.

Raw evidence: [before production](performance/stabilization-before-production.json), [final production](performance/stabilization-final-production.json), [before development](performance/stabilization-before-development.json), [final development](performance/stabilization-final-development.json), [final navigation](performance/stabilization-final-navigation.json). Intermediate samples are retained separately, not silently discarded.

### Backend versus network/development costs

- Isolated draft review measured approximately165ms through TestClient, **5 SELECTs and3 writes** in that observation. Review does not invoke Gemini. No backend runtime code was changed because approval persistence passed and participant-dependent query growth was not found.
- Existing query-growth regressions remain tasks4, handoffs5, analytics10 and facts10 SELECTs for both one and25 participants. No new backend N+1 or database schema optimization was invented.
- Read-only anonymous probes against the user's existing localhost development server returned documents in approximately68–252ms; health37ms and anonymous auth/me401 in6ms. These are **not authenticated readiness timings** and do not measure a signed-in database lookup.
- The reported~19.76-second navigation and broad perceived sluggishness were **not reproduced** in these controlled authenticated local scenarios. Local loopback tests cannot establish Render cold-start behavior, internet latency, live JWKS discovery or external Gemini latency. Those remain separate authenticated profiling concerns; the application is not declared universally fast based on these samples.

## 3. Functional verification matrix

- **Authentication — isolated paths verified:**23 auth adapter cases cover signup/password validation, confirmation/recovery callbacks, confirmed sign-in/session handling, Google PKCE destination, signout and safe redirects. Browser covers restoration, signout, protected routing and account switching. Actual Google consent/inbox login is untested here.
- **Identity/authorization — verified in isolated APIs:** persisted profile/workspace restoration, owner/caregiver checks, revoked category permissions, cross-workspace rejection, own-draft enforcement and duplicate onboarding. The API concurrency tests additionally reject an old-account response while another account loads its own data.
- **Dashboard/Care Pulse — verified:** real task/appointment counts and grouping, empty state, saved phase/profile greeting, task completion and new-task refresh, shortcuts and metrics. Existing premium metric styles were retained; no redesign or new healthcare score was added.
- **Care Circle/Consent — verified:** invitation link/withdrawal/matching-account acceptance, stable caregiver IDs, simulated labels, permissions and refresh persistence. Real email delivery is untested/unconfigured, not claimed sent.
- **Tasks — verified:** create/assign/edit/complete/reopen, persisted status/strikethrough, filters/export, AI-edited title and single submission. Backend suite retains supported deletion checks; no production records were removed.
- **Handoffs/Story — verified:** prepare/send, real-recipient and explicitly simulated acknowledgement/completion, archive/history, actual recorded actor/timestamps, linked-task independent status and refresh. A new375px test initially found2 overflowing text elements for a long caregiver name; [Story wrapping](../frontend/components/handoffs/CoordinationStory.tsx) now yields0, without hiding/clipping the text.
- **AI — verified with provider substitution:** Ask MaatruCare saved facts; summarize, extraction, appointment prep, handoff/update/meal-note tools and Care Planner; operation-specific review text, edited draft approval, rejection, individual task approval/rejection, history, approved handoff creation and approved-update clipboard. No task exists before explicit task approval. Provider failure,503 review failure/retry, duplicate clicks and preserved edits pass.
- **Lifestyle/Journey/Appointments — verified:** all five tracker forms and saved histories/corrections, routine/meal goal adherence, appointment create/edit/cancel and journey phase persistence. No clinical conclusions or fabricated data were introduced.
- **Timeline/Settings/Profile — verified:** real saved events/order/history, consent changes, profile name/phone, theme/browser preferences, storage failure feedback and reduced motion.
- **Responsive/accessibility — targeted verification:** mobile review errors are in viewport, native controls/loading labels remain accessible, drawers retain keyboard focus/Escape/restoration, existing375/768/1024/1440 checks pass, long Story names wrap. Updated fictional desktop/mobile screenshots in [review evidence](review) were visually inspected. This is not an exhaustive WCAG certification.

## 4. Final tests and exact outcomes

Executed in the isolated worktree; the existing interpreter at `C:/Users/saish/MaatruCare/maatrucare/backend/.venv/Scripts/python.exe` was reused, but conftest/fixtures force disposable databases. Existing development or production databases were never test targets.

- Final `python -m pytest tests -q --disable-warnings` from isolated backend: **154 passed,3 skipped,0 failed**,2458 warnings,26.18s, including the five additional invitation-diagnosis cases. Three reset-execution cases remain deliberately skipped; no reset approval was inferred.
- `python -m pytest tests/test_ai_review.py tests/test_query_efficiency.py -q -s --disable-warnings`: **9 passed**,279 warnings,4.11s; includes the query/approval profiling observations above.
- `node --test tests/api-concurrency.test.mjs tests/auth-flow.test.mjs tests/demo-caregiver-visibility.test.mjs tests/care-pulse.test.mjs tests/ai-drafts.test.mjs tests/read-coalescer.test.mjs tests/invitation-limits.test.mjs`: **51 passed,0 failed,0 skipped**. Tests include account/token separation, concurrent read sharing, failure cleanup, no settled-response cache, actual API write/read invalidation and preserved/validated invitation callback routing.
- `npm.cmd run lint`: **exit0**, no lint errors/warnings after excluding the new development test output directory. Existing framework/runtime deprecation notices are not suppressed by weakening app rules.
- `npx.cmd tsc --noEmit`: **exit0**, no errors after the final build.
- `npm.cmd run build`: **exit0**, optimized Next16.4.5 build,23 prerendered routes, isolated `.next-qa` output. Process-local public Supabase settings and production Render URL were used; no env file was changed or uploaded. Final build ID `yyHILgNsfiSL9la6YgTvZ`, including the invitation routing/acceptance correction.
- Fresh optimized-build browser suite: **28 passed,0 failed,0 skipped**,1.6m before the invitation addition. The final suite against the updated app build passed **29 tests,0 failed,0 skipped**,1.4m, including existing-account invitation feedback and supported new-account acceptance. One intermediate invocation failed because a generic alert assertion also matched Next.js's route announcer; the test was narrowed to the actual error, and the entire suite reran green. A Windows test-server pipe disconnect warning occurred without a failed API/browser assertion. Diagnostics reject unexpected browser exceptions/hydration errors/HTTP5xx; deliberate error cases allow only their intended endpoint. The invitation diagnosis passing does not mean multi-Circle joining is implemented.
- Development-mode profiling case: **1 passed**,21.5s including server startup; its final authenticated measurements are recorded separately from the production build.
- `git diff --check`: **exit0**.

The initially failing approval, long-name overflow and below-viewport error assertions were reproduced and fixed; none was deleted or weakened to obtain a green result. One attempted simultaneous development profiling run was refused because the isolated test port was occupied; it was rerun sequentially, not pointed at another user's service.

## 5. Exact changed source/test files

Runtime frontend changes:

- [AI Assist](../frontend/app/ai-assist/page.tsx).
- [DraftReviewActions](../frontend/components/ai/DraftReviewActions.tsx) and [ActionFeedback](../frontend/components/ai/ActionFeedback.tsx), new restrained review/feedback components.
- [ai-drafts](../frontend/lib/ai-drafts.ts), new operation-aware editor helper.
- [read-coalescer](../frontend/lib/read-coalescer.ts), new in-flight-only coordinator, and [API integration](../frontend/lib/api.ts).
- [Shared coordination context](../frontend/context/MaatruCareDemoContext.tsx), exposing the existing saved-task mapper with a workspace check.
- [Dashboard overview](../frontend/components/dashboard/CoordinationOverview.tsx), independent analytics/lifestyle loading.
- [Handoff Story](../frontend/components/handoffs/CoordinationStory.tsx), narrow-text wrapping.
- [Authentication destination](../frontend/lib/auth-flow.ts), [onboarding acceptance](../frontend/app/onboarding/page.tsx) and the existing-endpoint [API wrapper](../frontend/lib/api.ts), preserving invitation intent and surfacing the current membership restriction honestly.

Regression/profiling inputs:

- [Backend review regressions](../backend/tests/test_ai_review.py), new; [browser provider fixture](../backend/tests/browser_server.py), realistic blank optional fields and strictly local positive tool responses.
- [Browser stabilization tests](../frontend/tests/browser/stabilization.spec.ts), new; [diagnostics](../frontend/tests/browser/fixtures.ts), intentional review-failure allowance only.
- New [editor tests](../frontend/tests/ai-drafts.test.mjs), [coalescer tests](../frontend/tests/read-coalescer.test.mjs) and [API concurrency tests](../frontend/tests/api-concurrency.test.mjs).
- [Browser startup](../frontend/tests/browser/start-app.mjs) supports isolated development profiling; [TypeScript config](../frontend/tsconfig.json), [ESLint ignores](../frontend/eslint.config.mjs), [.gitignore](../frontend/.gitignore) and [.vercelignore](../frontend/.vercelignore) cover that generated output. No dependencies were added or upgraded.
- This report, raw benchmark JSON under docs/performance, and four refreshed fictional review screenshots are local evidence artifacts.

## 6. Remaining issues and deployment assessment

**Ready for integration/review; not deployed.** The verified changes are prepared for the requested local stabilization commit on the isolated fix branch; no push or deployment is authorized at this stage. The original release checkout remains on release/final-2026-11-08 at4a36db6, with its pre-existing untracked work intact. No main push, Render operation or Vercel operation was performed.

There are **no backend runtime, API contract, schema or migration changes** in this stabilization. It is compatible with deployed backend4a36db6; a frontend release is sufficient after reviewed integration and explicit deployment authorization. Backend changes here are tests/fixtures only.

The earlier production snapshot mismatch was reviewed using the protected local release evidence: original IDs preserved, all original values unchanged except an owner-audited consent change, legitimate additions in fictional workspace1, verified full PostgreSQL restore and idempotent migration rehearsal. It was cleared during that release; it is not presented as a fresh production data audit during this stabilization. Future deployment still requires the then-current backup/data-safety checks; no restore/reset is authorized.

Remaining external verification: live Google/email authentication and confirmation/recovery inboxes, actual Gemini output/latency and invitation email provider delivery. No authorized real-provider session was used. Broad sluggishness outside the reproduced local paths still needs a current authenticated trace; we do not claim the prior19.76s incident or Render cold starts are resolved. No additional patient-data cache, permissions relaxation or timing disguise was introduced.

## 7. Existing-account invitation investigation

The [membership diagnosis and reviewed follow-up design](INVITATION-MEMBERSHIP-DIAGNOSIS.md) explains the additional critical report. Current accounts have one Circle binding. Existing-account direct acceptance returns409. The old linked-account routing discarded invitations, and old onboarding returned the existing binding without consuming the token. Fresh reads confirmed Pending, while original authorized access remained intact.

Added [five backend diagnosis tests](../backend/tests/test_invitation_membership_limits.py), [callback/routing regressions](../frontend/tests/invitation-limits.test.mjs) and [actual browser reproduction](../frontend/tests/browser/invitation-limits.spec.ts). The safe frontend fix preserves valid invitation intent and makes an existing account call the already-supported explicit acceptance endpoint, displaying409 clearly rather than falsely completing bootstrap. New users retain their existing acceptance flow, the button is explicit and submission waits for authentication. Files additionally changed: [auth-flow](../frontend/lib/auth-flow.ts), [onboarding](../frontend/app/onboarding/page.tsx), [API client](../frontend/lib/api.ts) and the existing [new-recipient browser case](../frontend/tests/browser/product.spec.ts).

Tests verify new recipients, bad/expired/withdrawn/wrong-email tokens, concurrent acceptance, no duplicate identities/grants, clear unsupported-membership feedback and preserved original Circle access. No existing-account rebinding, new membership table, selection mechanism or authorization refactor is shipped. Successful joining of a second Circle remains unsupported and requires the separately reviewed additive architecture described there.

The stabilization fixes are safe independently of that follow-up. Do not describe the commit as a fix for multi-Circle joining or rush that schema/security change into production.
