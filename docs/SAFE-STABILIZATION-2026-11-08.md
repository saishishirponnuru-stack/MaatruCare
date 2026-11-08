# Protected-release stabilization â€” 8 November 2026

**Local regression gates pass. No production deployment is authorized or performed. Authenticated manual acceptance remains outstanding.**

The protected production baseline is frontend `e0001843906c11ab9b47beeda9ac8b88a6384706` and backend `4a36db6995c6020cd9d262b005293618a374711f`. No push, promotion, rollback, production schema mutation, account mutation, environment change or provider configuration change occurred. The existing rollback deployment is preserved. Earlier read-only schema inspection returned table names and binding-consistency results, not patient record values.

## Branches and safety boundary

- This candidate: `fix/release-safe-2026-11-08`, worktree `maatrucare-release-safe-20261108`, based on the verified local quality patch `60ae4b608f87fbdd1836bfd8c6dfcc94198887de`, whose parent is production frontend `e000184`. The final local commit is reported separately. Nothing is pushed.
- Original release checkout stays at `4a36db6`; all eleven pre-existing untracked paths remain untouched. The deployed stabilization checkout stays clean at `e000184`; the preceding quality worktree stays clean at `60ae4b6`.
- The experimental `feat/multi-circle-2026-11-08` worktree is preserved separately, uncommitted. Its [checkpoint and full inventory](../../maatrucare-multicircle-20261108/docs/MULTI-CIRCLE-EXPERIMENTAL-CHECKPOINT.md) explain its test boundary and architectural risks. It is **excluded from this candidate**.
- No model, migration, database URL, dependency, ownership binding, selected-workspace header, or consent policy changes are included in this safe candidate. No reset was executed. Temporary test databases contain only fictional records; the isolated native PostgreSQL server started for prototype testing has been stopped, preserving its files.

## Confirmed defects and narrow fixes

The inherited [quality patch](POST-DEPLOYMENT-QUALITY-REPORT.md) fixes four reproduced frontend defects: individual proposal decisions discarded unsaved draft edits; a successful task POST followed by a failed draft GET left a repeat-save control; long Planner appointment text overflowed mobile widths; and a disabled closed-menu backdrop dimmed the page. These fixes remain verified, without altering backend AI approval or automatically approving tasks.

Additional changes in this branch:

1. **Signed identity governs invitation email matching.** A persisted Account email can become stale. Authentication now retains the current verified JWT email for the request; invitation acceptance/bootstrap compares against that claim and rejects missing or explicitly unverified email instead of falling back to the stored address. Supabase subject remains the identity key. No identities are merged and existing account bindings remain intact.
2. **Bounded public signing-key cache.** JWKS discovery previously cached keys indefinitely. Keys expire after five minutes; unknown-key rotation refreshes share the newly fetched keyset. Expired discovery failure returns503 rather than trusting stale keys. This cache contains public signing keys, never private application records.
3. **Retry a failed invitation email without creating another invitation.** A controller-scoped endpoint requires the retained raw invitation capability, locks its pending record, rejects foreign/expired/withdrawn/accepted invitations, and preserves token, recipient and permissions. It reuses the existing Resend provider idempotency key, stores accepted delivery only after a valid provider response, and records/rate-limits retry attempts to ten per account/hour. Already provider-accepted invitations are not resent. No schema change is required. The optional returned invitation ID is backward-compatible; the frontend hides retry if an older backend omits it. The secure-link fallback remains available.
4. **Explicit Care Circle refresh.** An owner can reload invitations and members after another device accepts. No polling or automatic extra requests were introduced. A failed refresh produces an error instead of success.
5. **Honest unavailable records.** A general coordination load failure now sets task/handoff errors as well as clearing stale records. Care Pulse and dashboard show unavailable/not-shared states, suppressing fabricated zero counts and empty-journey claims.
6. **Invitation capabilities are redacted from Uvicorn access paths.** Matching token-bearing acceptance paths are sanitized before access logging. Tokens are not added to audit records or retry responses.

New test isolation also blanks Gemini/Resend credentials and disables email delivery in backend tests. Provider doubles are confined to tests; working application operations are not replaced with mocks.

## Actual validation

Commands below ran in this isolated worktree. The existing virtualenv interpreter was reused; conftest forces a disposable SQLite database and the browser harness uses loopback ports18010/3100, synthetic JWTs and substituted external providers. Existing local services and databases were not targets.

| Check | Exact invocation | Result |
| --- | --- | --- |
| Focused auth/email/key regressions | `C:/Users/saish/MaatruCare/maatrucare/backend/.venv/Scripts/python.exe -m pytest tests/test_invitation_current_email.py tests/test_invitation_delivery_retry.py tests/test_jwks_cache_lifetime.py tests/test_auth.py -q` | 22 passed,284 warnings,6.93s |
| Full backend | Same interpreter: `-m pytest tests -q --tb=short` from backend | **165 passed,3 skipped,0 failed**,2639 warnings,32.73s |
| All Node tests | `node --test tests/*.test.mjs` from frontend | **51 passed,0 failed,0 skipped**,1.80s |
| TypeScript | `npx.cmd tsc --noEmit` | exit0 |
| ESLint | `npm.cmd run lint` | exit0 |
| Production build | `npm.cmd run build` | exit0; Next16.4.5;23 prerendered routes |
| Full browser suite | `npx.cmd playwright test`, with `MAATRUCARE_TEST_PYTHON` pointing to the existing virtualenv | **39 passed,0 failed,0 skipped**,1.8m; optimized Next build; headless Edge |
| Whitespace | `git diff --check` | exit0 |

The three skipped tests are intentionally disabled reset-execution tests. No reset permission was inferred. Existing FastAPI lifespan, UTC datetime, Node module-type and short synthetic HMAC-key warnings remain; production keys were not substituted with test keys.

An intermediate browser run had38 passes/1 failure: the new test expected an internal context error string, while Care Pulse correctly rendered its shorter existing message. The final test asserts the actual visible alert **and** absence of misleading overdue/waiting counters before and after reload. No app assertion was removed or weakened. The entire39-test suite then passed. Final browser rerun reused the same optimized app build because only test assertions changed.

Compared with the documented deployed-source baseline:154 backend/3 skipped,51 Node,29 browser; this candidate has165/3,51,39 respectively. All original tests remain enabled. The inherited quality patch added eight browser regressions; this branch adds eleven backend cases and two browser cases. Baseline figures are retained earlier evidence, not a fresh run of production users or databases.

## Functional verification and limits

| Area | Isolated verification | Live/manual boundary |
| --- | --- | --- |
| Auth/onboarding | Validation, session restoration, same-origin Google PKCE construction, invitation intent, persisted onboarding, logout and account-switch isolation | No actual Google/email login, mailbox verification or recovery email during this run |
| Care Circle/Consent | New-account invitation acceptance, withdrawal/expiry/wrong account, simulated restrictions, four sharing categories, saved state after refresh, explicit refresh without writes | No production caregiver, grant or invitation written |
| Existing-account second Circle | Explicit409 and unchanged original access; invitation stays Pending | **Unsupported**; no false acceptance or binding rewrite |
| Tasks/Dashboard/Care Pulse | Create/edit/assign/complete/reopen, actual counts, approval-created task, failed refresh feedback, no-share counters suppressed | No production task or dashboard write |
| Handoffs/Story/Timeline | Preparedâ†’Sentâ†’Acknowledgedâ†’Completed; real recipient authorization; simulations honestly audited; archive; linked task independence; actual ordered history | No live handoff changed; synthetic mobile Story capture visually inspected |
| AI Planner and existing tools | Generation with provider substitution, edited whole-draft approval/rejection, independent individual task approve/reject, duplicate clicks, failed requests/retry, history and persistence | One actual Gemini service smoke below; authenticated live approval remains unverified |
| Appointments/Journey/Lifestyle | Saved phase; appointment create/edit/cancel; water/sleep/weight/activity/nutrition histories, corrections, goals and summaries survive reload | No real lifestyle or clinical records changed |
| Settings/Profile/UI | Persisted preferences/name, storage failure, focus/Escape, reduced motion, light/dark and representative widths | Targeted automated checks and visual capture review; no claim of exhaustive accessibility certification |

## Performance evidence

No additional private-data cache, artificial delay, broad memoization, auth bypass or polling was added. Existing read coalescing and mutation invalidation remain covered by Node/API tests.

| Individual local observation | Deployed-source baseline | Final safe candidate |
| --- | ---: | ---: |
| Dashboard readiness | 713ms | 647ms |
| Dashboard initial API reads | 10 | 10 |
| Dashboardâ†’AI Assist | 135ms | 118ms |
| AI Assistâ†’Handoffs | 99ms | 104ms |
| Tasks navigation | 87ms | 88ms |
| Care Circle navigation | 70ms | 95ms |
| Task-save experiment including UI/readiness | 169ms | 1022ms |
| Task-save API requests | 4 | 4 |
| Care Circle duplicate initial/warm API reads | 0/0 | 0/0 |

These are separate single-run observations, not controlled latency percentiles; host/compiler/browser warmth differs. **A broad speed improvement is not claimed.** The previous stabilization already reduced task-save requests10â†’4 and planning-fact reads2â†’1; this candidate preserves those reductions. Dashboard time-range changes remain one request. A held draft reload does not block confirmed task feedback (13ms after POST acknowledgement) or navigation (155ms while the read remains pending). Care Circle readiness was490ms fresh/262ms warm in the final run. Evidence: [application timings](performance/release-safe-application.json), [navigation timings](performance/release-safe-navigation.json), [baseline observations](performance/postrelease-before-performance.json).

## External integration evidence and outstanding gates

Sanitized evidence is retained outside Git in `%LOCALAPPDATA%/MaatruCareRelease/five-gaps-20261108`. No credentials, tokens, connection strings, real user records or raw model notes are included in this report.

| Gap | Implementation | Integration verified | Production verified |
| --- | --- | --- | --- |
| Real authentication | Existing flows retained, current-claim email safety patched | SDK/isolated browser paths; live public settings confirm Google+email enabled, email confirmation required, matching issuer and discoverable supported keys | **No** actual interactive sign-in/recovery; shared app tab is signed out |
| Gemini | Existing backend-only service retained | **Yes:** one explicitly fictional coordination note; schema-valid response, summary and one proposal;4192ms; no DB accessed | Signed-in generationâ†’reviewâ†’saved task not exercised live |
| Invitation email | Existing Resend integration plus tested retry/fallback | Provider timeout/acceptance/idempotency/rejection paths use isolated doubles | **Unavailable:** provider key/verified sender/inbox not available; no real email sent |
| Production record writes | Exact controlled plan below | Local workflows pass | **Not performed/authorized in this override** |
| Multi-Care-Circle | Experimental prototype parked | Earlier synthetic nativePG/concurrency and browser checkpoints only | **Not implemented in safe candidate; not production-ready** |

For later manual verification, use owner-controlled synthetic test accounts and mailboxes; sign in privately in the shared browser. Never paste credentials into chat. Verify the exact Supabase Site URL/allowed callbacks, Google provider callback and confirmation/recovery templates/SMTP through an authenticated Dashboard session; enabled-provider discovery alone does not verify those settings. No external settings were changed.

Email setup, only after separate authorization: a Resend verified owned domain, server-side `RESEND_API_KEY`, `MAATRUCARE_INVITATION_FROM` on that domain, `MAATRUCARE_PUBLIC_APP_URL=https://maatru-care.vercel.app`, and `MAATRUCARE_INVITATION_EMAIL_ENABLED=true`. Preserve existing secrets. Verify provider acceptance and actual controlled-inbox arrival separately. Supabase auth SMTP is a separate configuration from caregiver invitation email. Keep secure links working until delivery is verified.

## Controlled production test plan â€” not executed

Explicit approval must identify synthetic owner A/caregiver C and, for isolation, unrelated synthetic owner B; exact account/workspace IDs are verified privately first. Do not use family/real care records. Prefix each new record `MC-QA-20261108-<runId>` and retain its returned ID in a manifest outside Git. Stop on any pre-existing daily lifestyle/date collision or account mismatch.

- One task: create/edit/complete/reopen; one appointment: create/edit/cancel.
- One matching-account invitation: accept; another controlled pending invitation: withdraw. Manage only the new relationship's categories. A second-Circle invitation remains an intentional409 in this release.
- One handoff: prepare/send, real recipient acknowledges/completes, then archive. Confirm owner cannot impersonate a real recipient. Simulations only in explicitly authorized fictional workspace.
- One fictional/de-identified Planner draft with explicit external-processing consent; approve edited summary, explicitly create one proposed task, reject remaining proposals; reload both records.
- If separately approved: one each water/sleep/weight/activity routine+check-in/nutrition goal+meal in an empty synthetic workspace; never overwrite existing measurements.
- Record actual201/200/401/403/409 results, refreshed record IDs, timeline and cross-account denials. No sensitive information is sent to Gemini.
- Non-destructive cleanup: complete test tasks, cancel the test appointment, archive the test handoff, withdraw only the new pending invitation, revoke only the new test relationship. Retain audit/timeline and lifestyle/draft records unless separately authorized. No reset, bulk deletion, authentication account deletion, database restore or fuzzy matching.

## Release decision and rollback

**Ready for local engineering review; not claimed production-ready.** Manual authenticated acceptance, real email delivery, and production write checks remain unverified. The retry endpoint is covered on disposable SQLite; its new PostgreSQL row-lock/rate-limit concurrency path has not been independently load-tested in this safe branch. The native PostgreSQL prototype tests must not be represented as testing this candidate's entire integration.

There is **no migration** in this candidate. The parked prototype proposes two new tables and a request authorization redesign, which require a separately reviewed rollout. Do not run its scripts or enable its flag in production. Earlier safe read-only inspection confirmed those tables are absent and legacy bindings consistent.

After review and fresh explicit deployment authorization only: deploy a backend candidate to the existing Render service, verify health/auth/CORS and controller-scoped retry contract, then build a frontend candidate in the existing Vercel project and perform controlled smoke tests before promotion. New response fields are optional on the client; old clients still work. Preserve current backend4a36db6 and frontend`e000184` deployment targets. Code rollback does not require restoring a database or deleting newer records. No deployment command is executed by this work.

## Complete changed-file inventory

The generated inventory below covers this candidate relative to production frontend `e000184`, including inherited quality fixes, tests, reports and sanitized evidence. Runtime code was reviewed separately from evidence. Environment files, databases, backups, local captures and dependency directories are excluded. The experimental prototype has its own full inventory in the linked checkpoint.

- Runtime: [backend/app/dependencies.py](../backend/app/dependencies.py)
- Runtime: [backend/app/main.py](../backend/app/main.py)
- Runtime: [backend/app/routers/auth.py](../backend/app/routers/auth.py)
- Runtime: [backend/app/services/auth_service.py](../backend/app/services/auth_service.py)
- Runtime: [backend/app/services/safe_access_logging.py](../backend/app/services/safe_access_logging.py)
- Tests: [backend/tests/conftest.py](../backend/tests/conftest.py)
- Tests: [backend/tests/test_auth.py](../backend/tests/test_auth.py)
- Tests: [backend/tests/test_invitation_current_email.py](../backend/tests/test_invitation_current_email.py)
- Tests: [backend/tests/test_invitation_delivery_retry.py](../backend/tests/test_invitation_delivery_retry.py)
- Tests: [backend/tests/test_jwks_cache_lifetime.py](../backend/tests/test_jwks_cache_lifetime.py)
- Documentation/evidence: [docs/CODEX-SESSION-HANDOFF.md](../docs/CODEX-SESSION-HANDOFF.md)
- Documentation/evidence: [docs/POST-DEPLOYMENT-QUALITY-REPORT.md](../docs/POST-DEPLOYMENT-QUALITY-REPORT.md)
- Documentation/evidence: [docs/SAFE-STABILIZATION-2026-11-08.md](../docs/SAFE-STABILIZATION-2026-11-08.md)
- Documentation/evidence: [docs/performance/postrelease-after-navigation.json](../docs/performance/postrelease-after-navigation.json)
- Documentation/evidence: [docs/performance/postrelease-after-performance.json](../docs/performance/postrelease-after-performance.json)
- Documentation/evidence: [docs/performance/postrelease-baseline-production.json](../docs/performance/postrelease-baseline-production.json)
- Documentation/evidence: [docs/performance/postrelease-before-navigation.json](../docs/performance/postrelease-before-navigation.json)
- Documentation/evidence: [docs/performance/postrelease-before-performance.json](../docs/performance/postrelease-before-performance.json)
- Documentation/evidence: [docs/performance/postrelease-development.json](../docs/performance/postrelease-development.json)
- Documentation/evidence: [docs/performance/postrelease-external-configuration-check.json](../docs/performance/postrelease-external-configuration-check.json)
- Documentation/evidence: [docs/performance/postrelease-live-anonymous-browser.json](../docs/performance/postrelease-live-anonymous-browser.json)
- Documentation/evidence: [docs/performance/postrelease-production-dependency-audit.json](../docs/performance/postrelease-production-dependency-audit.json)
- Documentation/evidence: [docs/performance/release-safe-application.json](../docs/performance/release-safe-application.json)
- Documentation/evidence: [docs/performance/release-safe-navigation.json](../docs/performance/release-safe-navigation.json)
- Documentation/evidence: [docs/review/postrelease-planner-dark.png](../docs/review/postrelease-planner-dark.png)
- Documentation/evidence: [docs/review/postrelease-planner-light.png](../docs/review/postrelease-planner-light.png)
- Runtime: [frontend/app/ai-assist/page.tsx](../frontend/app/ai-assist/page.tsx)
- Runtime: [frontend/app/care-circle/page.tsx](../frontend/app/care-circle/page.tsx)
- Runtime: [frontend/components/ai/PlannerContext.tsx](../frontend/components/ai/PlannerContext.tsx)
- Runtime: [frontend/components/layout/Sidebar.tsx](../frontend/components/layout/Sidebar.tsx)
- Runtime: [frontend/context/MaatruCareDemoContext.tsx](../frontend/context/MaatruCareDemoContext.tsx)
- Runtime: [frontend/lib/api.ts](../frontend/lib/api.ts)
- Tests: [frontend/tests/browser/fixtures.ts](../frontend/tests/browser/fixtures.ts)
- Tests: [frontend/tests/browser/postrelease.spec.ts](../frontend/tests/browser/postrelease.spec.ts)
- Tests: [frontend/tests/browser/release-safe.spec.ts](../frontend/tests/browser/release-safe.spec.ts)
