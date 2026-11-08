# MaatruCare — production-readiness candidate

8 November 2026 (IST). This report extends the [performance implementation report](PERFORMANCE-RELIABILITY-REPORT.md). Work remains local and uncommitted. The production release was not changed, no production settings were modified, and no production records or authentication accounts were created, changed, reset or deleted.

## 1. Confirmed defects repaired

- **Blocking authentication:** synchronous JWT/JWKS discovery and SQLAlchemy lookup ran on the ASGI event loop. A regression test observed verification executing on that loop. They now run in a worker; the authenticated Account is bound back in the original request context. Twelve concurrent requests for two different owners retain their own subjects/workspaces, and a following anonymous request is rejected. Sessions now use an explicit context manager instead of taking a session from an unretained dependency generator. JWT algorithms, audience, issuer, role and relationship checks are unchanged.
- **Analytics query growth:** the dashboard analytics endpoint went from 11 SELECTs for one participant to 35 for 25. Eager-loaded task owners keep it at 10 for both sizes. The saved-facts endpoint is also protected by a query-growth test with distinct task owners and handoff recipients; it stays at 10. Existing task/handoff query fixes remain constant at 4/5.
- **Duplicate journey refreshes:** the browser measured two task-list refresh requests after saving a phase. The page explicitly refreshed data immediately after refreshing the account, which already refreshes the shared context. Removed the extra refresh; the regression now observes one. Phase and timeline persistence remain intact.
- **Browser profile state during account switching:** a public callback can change subjects without remounting its layout. The settings provider previously retained the old settings when the new subject had no stored record, allowing persistence under the wrong key. Its snapshot, hydration and updates are now scoped to the subject that loaded them. It exposes defaults until the new subject is hydrated and rejects stale updates. Callback children remain mounted, preserving PKCE/callback execution. A browser broadcast-switch regression verifies that the second account does not inherit the first account's fictional phone, email or coordination preference.
- **First-visit accessibility preference:** an incorrectly nested fallback ignored the OS reduced-motion setting when no browser preference existed. First visits and malformed preferences now use the system setting; an explicit saved preference still wins.
- **Silent browser-storage failure:** blocked/quota-limited storage previously appeared to save. Settings now displays an accessible message explaining that changes apply only for the current visit. This does not turn browser preferences into backend notification services.
- **Saved lifestyle entry with failed reload:** a successful write followed by a failed GET left stale summaries without a retry action. The page now distinguishes the saved change from the reload failure, provides Retry loading, and prevents another mutation until records reload. The browser regression verifies that recovery makes only one write.
- **Settings phone source:** account information now displays the backend-persisted phone rather than an optional browser cache or hardcoded sample exclusion. It remains correct after that account's test browser cache is removed.
- **Drawer keyboard behavior:** initial focus and Tab containment were inconsistent in the mobile browser. Drawers now focus their first enabled field, cycle Tab/Shift+Tab among visible enabled controls, and restore the opener after Escape/close. Native modal semantics and busy-close guards remain.
- **Repeated feedback and copy:** Care Circle displays mutation feedback in the active drawer or page, without duplicate announcements. Appointment cancellation now quotes the actual title cleanly. Settings introduction uses ordinary product language. No colors, typography, layouts or navigation labels were redesigned.

The previous fixes remain: persistent navigation prefetch control; task/handoff eager loading; explicit new-account fictional-workspace opt-in; supported Next.js/security dependency updates. No additional schema change was introduced in this pass.

## 2. Functional verification

The browser suite uses an optimized Next production build, native headless Edge, a temporary file-backed SQLite database and valid synthetic JWTs. Application routes, authorization, mutations, persistence, review and UI updates run normally. Only the external Gemini provider and Supabase logout response are substituted locally. No Gemini or email provider receives these fixture requests.

The suite exercises:

- Dashboard greeting after profile updates; saved journey phase and its refresh behavior.
- Real invitation-link creation, withdrawal, caregiver onboarding through an invitation and recipient-account handoff acknowledgement/completion. This is a genuine caregiver relationship in the isolated application, not a simulated participant; it is not evidence of live Google account participation.
- Simulated caregiver creation, relationship editing, labels, refresh persistence and availability in Tasks, Consent and Handoffs.
- Sharing switches and persistence; backend tests cover revocation, unauthorized updates and cross-workspace rejection.
- Task creation, assignment, completion/strikethrough, reopening, editing, overdue/My tasks filters and CSV download.
- Prepared → Sent → simulated acknowledgement → completion → archive, refresh persistence and retained timeline history.
- Timeline ordering; existing backend tests cover filtered/paginated history and permitted visibility.
- All five lifestyle forms: hydration goal/intake/correction; overnight sleep and separate quality; same-date weight correction; routine creation and daily activity update; personal nutrition goal and meal adherence. Saved records and counts are checked through the actual backend after refresh.
- AI note consent, validated draft, explicit task approval and real task persistence; retrieved saved task facts; provider-unavailable feedback and unchanged task records on failure. No task exists before human approval.
- Profile name/phone, local language preference, theme switching and persistence; system reduced motion; storage-failure feedback; callback account switching; sign-out/protected redirects.
- Google OAuth destination and PKCE challenge construction, without contacting Google or claiming a successful live sign-in.
- Mobile drawer focus and Escape behavior; Care Circle at 375/768/1024/1440 pixels; additional application page smoke checks.

The final browser fixture checks uncaught page exceptions, React hydration/update-depth errors and unexpected HTTP 5xx responses. Deliberate failure scenarios allow only their intended failing endpoint. This is automated interaction coverage, not a full WCAG certification, assistive-technology audit, or proof of every possible form/input combination.

## 3. Performance evidence

The [original baseline](performance/local-before.json) and [previous comparison](performance/local-after.json) remain intact. The [current candidate observation](performance/local-final-quality.json) uses the same page-request/prefetch observation approach, with the expanded application and isolated backend.

- Initial observed page requests: **55 before → 25 now**.
- Background route-prefetch requests: **22 → 2**, both remaining requests for the contextual Consent link.
- API calls: **9 → 9**, with no identical initial or warm-restore duplicates and one `/api/auth/me` per document. No API-call reduction is claimed.
- Journey phase save: **two → one** task-list refresh.
- In the latest completed browser observation, fresh-context usability was **633 ms**, DOMContentLoaded **91.8 ms**, load **167.6 ms**, observed LCP **540 ms**. Warm reload usability was **231 ms**, load **60.4 ms**, with zero JavaScript network transfer.
- Latest sidebar navigation observations: Home **159 ms**, Tasks **257 ms**, Handoffs **88 ms**, Consent **72 ms**, Care Circle **66 ms**. As in the original benchmark, completion uses URL/shared loading state, not every destination-specific effect. These are individual local observations, not production percentiles.
- Another run under concurrent build/test load recorded a fresh-context usable time around **4.3 seconds** and a document TTFB around **3.8 seconds**. This was seconds, not the reported minutes. Local build contention and first-route/host variability prevent guaranteeing the 2–3-second target for every fresh load.

The reported **306 requests / 3.8-minute load** still has not been reproduced or causally attributed. Earlier read-only production samples found warm health p50/p95 around 236/283 ms, and anonymous sign-in loads around 0.7–1.1 seconds. Health does not test database access. Those samples do not substitute for authenticated production traces. See the [prior report](PERFORMANCE-RELIABILITY-REPORT.md) and its JSON evidence for exact methods and limitations.

Render is on its Free plan in Virginia. Application changes do not eliminate [Render's documented idle spin-down/cold-start behavior](https://render.com/docs/free). No hosting plan, keepalive automation, production database index or cache policy was changed.

## 4. Authentication and email — verified configuration and blockers

Read-only production checks confirm Google and email/password providers enabled, signups enabled, and `mailer_autoconfirm=false` (email confirmation required). The backend has Supabase JWKS/issuer configuration. Frontend and backend use the existing project `qvbwpcnjshkrwvdcecmc`. No verification bypass or account merging was added.

**Caregiver invitation email is not enabled in Render:** `MAATRUCARE_INVITATION_EMAIL_ENABLED` is not true, `RESEND_API_KEY` is absent, and `MAATRUCARE_INVITATION_FROM` is absent. The public app URL is configured. This explains `email_available=false`; it is not a Google OAuth verification defect. The existing Resend integration and secure invitation-link fallback are functional in isolated tests. Added coverage for provider rate-limit and service-unavailable failures; neither is marked delivered and the secure link remains redeemable according to its normal rules.

To enable invitation email after approval:

1. Use an authorized Resend account and an owned domain/subdomain. Add its required DNS records and confirm the domain is verified in Resend. Do not use an unverified personal Gmail/Outlook address as sender. [Resend requires domain verification](https://resend.com/docs/dashboard/domains/introduction).
2. Configure only the backend: `MAATRUCARE_INVITATION_EMAIL_ENABLED=true`, `RESEND_API_KEY=<server-side sending key>`, `MAATRUCARE_INVITATION_FROM=MaatruCare <invites@YOUR_VERIFIED_DOMAIN>`, and confirm `MAATRUCARE_PUBLIC_APP_URL=https://maatru-care.vercel.app`. The domain/key placeholders are not usable credentials. No purchase, DNS change or provider configuration was performed.
3. After an approved backend restart/deployment, verify capability as an authenticated owner and send one approved fictional invitation to an authorized mailbox. A provider message ID establishes acceptance for delivery, not inbox delivery. Verify receipt separately. Preserve the link fallback for rejection, timeout and unconfigured environments.

**Supabase signup/recovery email is a separate configuration.** Its SMTP settings and actual mailbox delivery were not available through public provider settings. Configure custom SMTP and a verified sender in Supabase Authentication → Email/SMTP for public users. [The default Supabase mailer restricts recipients without custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Do not infer its configuration from Render's Resend variables.

Verify Supabase Site URL is `https://maatru-care.vercel.app`, with production and localhost `/auth/callback` redirect entries and required onboarding/invitation/recovery query variants. Retain existing `/reset-password` entries for previously issued recovery links. Use `{{ .ConfirmationURL }}` in confirmation/recovery templates. Keep confirmation enabled. The Google Cloud provider callback is `https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/callback`; the application's callback is the subsequent app redirect, not Google's provider callback. [Supabase's Google guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [redirect documentation](https://supabase.com/docs/guides/auth/redirect-urls) describe that distinction. Exact existing Dashboard allowlists/templates/SMTP and Google credentials remain manually unverified. The [authentication repair notes](AUTHENTICATION-REPAIR.md) contain the full setup and mailbox acceptance flow.

No real email delivery, real Google sign-in, live recovery, or live Gemini generation is claimed from these local tests.

## 5. Demo workspaces, migrations and data safety

The earlier minimal solution remains one additive `patients.is_demo_workspace BOOLEAN NOT NULL DEFAULT FALSE` column. Existing records stay false and existing workspace 1 keeps the explicit legacy allowlist. New authenticated owners may opt in only during first onboarding. Existing real workspaces cannot be converted or designated by another account. Simulated caregivers receive no authentication accounts and remain subject to sharing rules.

No new workspace architecture or additional migration was added here. The tradeoff is intentional: an existing real-workspace owner needs a separate new account for a fictional demonstration. This protects existing information and avoids changing the application's one-owner/workspace model. The migration is locally tested for retained rows and idempotence; it has not been run against production PostgreSQL. Controlled PostgreSQL staging verification and an authorized backup/restore check remain required before promotion.

Keep the existing production simulation settings: `MAATRUCARE_DEMO_CAREGIVERS_ENABLED=true`, `MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS=1`, and Vercel build-time `NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED=true`. Existing caregivers, tasks, invitations, permissions, handoffs and history must remain in place. Reset, automatic seeding and compatibility authentication remain disabled. No production writes or migration imports were performed during this sprint.

## 6. Changed files

This follow-up changes or adds:

- [Authentication dependency](../backend/app/dependencies.py): off-loop credential/database work and request-context binding.
- [Analytics router](../backend/app/routers/analytics.py): eager-loaded owners.
- [Auth concurrency tests](../backend/tests/test_auth_concurrency.py), [query tests](../backend/tests/test_query_efficiency.py), [core workflow tests](../backend/tests/test_core_workflows.py): concurrency/isolation/query growth and email failure coverage.
- [Browser backend](../backend/tests/browser_server.py): fresh fictional identities, transactional disposable schema setup and strictly local provider substitutions. Production flags/credentials cannot turn this into a production fixture server.
- [Local settings](../frontend/context/LocalSettingsContext.tsx), [appearance preferences](../frontend/context/PreferencesContext.tsx): identity scoping, correct fallback and storage feedback.
- [Lifestyle](../frontend/app/lifestyle/page.tsx), [Settings](../frontend/app/settings/page.tsx), [Journey](../frontend/app/journey/page.tsx), [Care Circle](../frontend/app/care-circle/page.tsx), [Appointments](../frontend/app/appointments/page.tsx), [shared UI](../frontend/components/ui/ProductUI.tsx): the confirmed repairs described above.
- [Playwright configuration](../frontend/playwright.config.ts), [diagnostic fixtures](../frontend/tests/browser/fixtures.ts), [helpers](../frontend/tests/browser/helpers.ts), [quality regressions](../frontend/tests/browser/quality.spec.ts), [lifestyle interactions](../frontend/tests/browser/lifestyle.spec.ts), [product interactions](../frontend/tests/browser/product.spec.ts), [coordination workflows](../frontend/tests/browser/workflows.spec.ts), [performance checks](../frontend/tests/browser/performance.spec.ts): expanded isolated coverage and bounded build/test execution.
- [Current benchmark](performance/local-final-quality.json) and this report.

The earlier uncommitted files and dependency/security updates are enumerated in [the previous report](PERFORMANCE-RELIABILITY-REPORT.md#e-exact-changed-files). All remain uncommitted; unrelated existing reports, backup copies and scratch files were preserved. No actual environment secret file was modified.

## 7. Quality gates and readiness

Final local gates on 8 November: backend **141 passed, 3 skipped, 0 failed, 2155 warnings, 13.23s**; Node auth/visibility/Care Pulse suites **34 passed, 0 failed**; explicit TypeScript and ESLint exit **0**; optimized Next 16.4.5 production build exit **0**, 23 generated pages. The full production-build browser suite now contains **21 workflows**; see the final review for the final collected result. Three reset-execution tests remain skipped because no destructive-operation approval was given. Existing framework deprecations/test-key warnings remain. Production dependency audit previously returned zero vulnerabilities; eight moderate development lint-chain advisories remain.

The candidate is **not yet verified production-ready end to end**. The local candidate is suitable for controlled staging/release review once its final gates are green. Public signup/recovery email, optional invitation delivery, actual Google callback/account journeys, live Gemini behavior, authenticated production performance and PostgreSQL migration staging require the external checks above. Eight moderate development lint-chain advisories remain; the production dependency audit is clean. Existing deprecation/test-key warnings are not suppressed by weakening production checks.

## 8. Approved deployment sequence and rollback

Do not execute this sequence without explicit approval:

1. Review all intended source/config/test/doc paths and staged diff. Exclude actual environment files, databases, backups, scratch files, virtual environments, node_modules and generated builds. Verify the remote and upstream branch; local `main` remains at `11b885c`, with these changes unstaged/uncommitted. Do not force-push or blindly stage the entire repository.
2. Verify a supported PostgreSQL backup/restore procedure and run the additive migration on a disposable PostgreSQL staging database. Do not run startup imports against production just to inspect settings.
3. Deploy the reviewed backend revision first, preserving the managed PostgreSQL connection, Supabase/JWKS/issuer, CORS and demo scoping. Check startup logs, authenticated reads, isolation and consent; health alone is insufficient evidence of a database connection.
4. Rebuild Vercel from the same revision, root `frontend`, with the Render API URL and the existing Supabase project/public key and build-time simulation flag. Do not reuse the older compiled frontend.
5. Complete the controlled live acceptance: Google and confirmed email sign-in; existing workspace restoration; new-account demo opt-in; real invitation acceptance by its matching account; consent/revocation; task edit/complete/reopen; real and simulated handoffs; timeline; lifestyle refresh; AI draft approval. Use authorized fictional workspaces/mailboxes, not other users' data.
6. Capture authenticated production HAR/trace before declaring the earlier performance incident resolved. Separate a proven Render cold start from warm samples.

Rollback frontend first and then backend code as needed. Retain the additive column and all records; never reset tables or restore an old backup over new work as an automatic rollback. Older code ignores the new field and uses the legacy demo allowlist, so new demo accounts may temporarily lose simulation availability. Any emergency production flag change also needs approval. No data-destruction step is needed to revert these application changes.

## 9. Signature experiences added after the handoff checkpoint

- **Care Pulse** is immediately below the dashboard greeting. It reuses existing shared records and the existing appointment request, with no additional dashboard request or polling. Deterministic groups show overdue tasks, tasks due today, waiting acknowledgements, upcoming appointments/tasks and recent saved activity. Past appointments earlier today are excluded. New accounts get an actionable empty state. Dates/statuses drive the view, not a clinical score. Shortcuts open existing workflows and the planner.
- **AI Care Planner** extends AI Assist with a dedicated operation, permission-scoped saved context, three editable planning briefs, validated structured task proposals, individual edit/approve/dismiss and existing persistent drafts. Retrieved names/titles/contacts stay in the application; only the explicitly reviewed note is sent to Gemini after consent. Briefs copy counts and optionally a visit date/time, and distinguish unshared information from zero records. The server filters repeated/open task titles locally and checks again at approval, with PostgreSQL workspace row locking and the existing per-suggestion unique index. Exact normalized title comparison does not guarantee semantic deduplication across differently worded tasks. No automatic task creation, external context upload or sharing was added.
- **Care Coordination Story** replaces the existing handoff progress block with connected recorded steps, timestamps, next action, independent linked-task status and expandable chronological activity. The existing Timeline endpoint now accepts optional resource filters, applied after its normal workspace/permission/participant scope. Actual history identifies the authenticated actor and simulated events. Task completion is not inferred from handoff completion. Activity reloads after mutations while expanded, without polling.
- No new schema migration or dependency is needed for these experiences. The earlier additive demonstration-workspace column is still pending PostgreSQL staging verification.

Added/extended files: [Care Pulse component](../frontend/components/dashboard/CarePulse.tsx), [rules](../frontend/lib/care-pulse.ts), [Dashboard](../frontend/app/page.tsx), [Planner context](../frontend/components/ai/PlannerContext.tsx), [AI Assist](../frontend/app/ai-assist/page.tsx), [Story](../frontend/components/handoffs/CoordinationStory.tsx), [Handoffs](../frontend/app/handoffs/page.tsx), [API types](../frontend/lib/api.ts), [AI schemas](../backend/app/ai_schemas.py), [generation](../backend/app/services/ai_service.py), [AI router](../backend/app/routers/ai.py), [approval](../backend/app/services/ai_draft_service.py), [facts](../backend/app/routers/analytics.py), [Timeline](../backend/app/routers/timeline.py), [backend regressions](../backend/tests/test_signature_features.py), [rule tests](../frontend/tests/care-pulse.test.mjs), [browser regressions](../frontend/tests/browser/signature.spec.ts). Existing fixtures were extended, not replaced.

The [engineering handoff](CODEX-SESSION-HANDOFF.md) captures all tracked/untracked paths and historical results. The [final review](FINAL-PRODUCT-REVIEW.md), [release checklist](DEPLOYMENT-CHECKLIST.md) and [judge walkthrough](JUDGE-DEMO-CHECKLIST.md) are the current release-review companions. Older root-level reports and FINAL-SUBMISSION-STATUS.md contain historical counts/capabilities and were preserved; do not treat them as the latest state.
