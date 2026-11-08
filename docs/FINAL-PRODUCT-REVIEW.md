# MaatruCare — final local product review

8 November 2026. Branch main, base commit 11b885cad5c198ebb428a3c5283818ae5da0dd62. All current engineering work remains uncommitted. **Ready for local review; external acceptance and PostgreSQL staging gates still apply before production approval.** No deployment, production settings/data changes, reset or account deletion occurred.

## Implemented and verified locally

- **Care Pulse:** a daily dashboard overview directly after the greeting, using saved tasks/handoffs/appointments/activity. Overdue, due-today and coming-up rules are date/status based and exclude closed handoffs and past visits. Working setup/coordination/lifestyle/planner links. No extra dashboard fetching or polling. Task changes and AI approvals appear through the existing shared refresh and navigation; no cross-account retained state.
- **AI Care Planner:** an integrated AI Assist tool with authorized saved context, weekly/visit/handoff planning briefs, editable note, explicit external-model consent, structured source-validated task proposals and individual approval/rejection. Approval persists a normal task, draft review and activity, then refreshes the shared workspace. Duplicate proposals/open titles are filtered locally and rechecked before creation; same-draft retries reuse the existing task. No task exists before approval.
- **Care Coordination Story:** connected handoff steps, actual timestamps, clear next action, linked task with independent status and expandable ordered recorded activity. Shows actual actor and simulation distinctions. New Timeline resource filters retain category/participant/workspace restrictions. Acknowledgement/completion refresh the story/history; reload preserves them.
- **Core flows preserved:** real invitation creation/withdrawal/matching-account acceptance; caregiver sharing/revocation; task assign/edit/complete/reopen/export; real-recipient and explicitly simulated handoffs/archive; all five lifestyle trackers; profile/journey/theme/session/account switching.
- **Reliability:** worker-thread JWT/account verification with request-context isolation; constant task/handoff/analytics query counts; no duplicate journey refresh; subject-scoped preferences on public callbacks; reduced-motion fallback; browser-storage feedback; safe saved-write/failed-reload recovery; dialog focus containment/restoration.
- **UI:** existing dark palette, serif hierarchy, surfaces and responsive layout retained. Care Pulse moved above the fold; duplicated planner heading removed; dashboard compact metrics use a dark-mode-compatible surface. Mobile story remains a readable vertical flow. No broad redesign or additional navigation page.

## Validation evidence

Commands executed from their respective directories:

```powershell
# backend
.\.venv\Scripts\python.exe -m pytest tests -q --disable-warnings
# frontend
npm.cmd run test:auth
node --test tests/auth-flow.test.mjs tests/demo-caregiver-visibility.test.mjs tests/care-pulse.test.mjs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run test:browser
```

- Full backend: **141 passed, 3 skipped, 0 failed**, 2155 warnings, 13.23 seconds. Reset-execution cases require explicit approval and were not enabled. Databases are isolated fixtures.
- Node suites combined: **34 passed, 0 failed, 0 skipped**: 23 authentication, 6 simulated-caregiver rendering, 5 Care Pulse rules. Standalone test:auth also passed earlier in this review.
- Explicit TypeScript: **exit 0**, no errors.
- ESLint: **exit 0**, no errors.
- Production build: **exit 0**, Next 16.4.5, 23 generated pages. Executed with `MAATRUCARE_BUILD_DIR=.next-qa` to protect the user's running development build, production Render API URL and build-time simulation flag true. The separate browser build uses disposable loopback fixture URLs.
- Full optimized-build Edge browser suite: **21 passed, 0 failed, 0 skipped, 1.1 minutes**, final fresh build, exit **0**. Tests fail on uncaught JS/React hydration errors and unexpected HTTP 5xx; deliberate failure cases allow only the expected endpoint.
- Six signature backend cases verify proposal deduplication, explicit approval/retry/persistence, category revocation/cross-workspace rejection, failure/consent/source validation, ordered scoped story history and excluding an earlier appointment today. Five Care Pulse rule tests cover counts/dates/closed records/refresh/empty input.
- Initial new-browser run had 19 passes and two failures: duplicate planner headings and an incomplete simulated-caregiver test payload. The heading was corrected and the fixture now supplies required actor/role fields. The focused rerun passed both. These were not ignored or marked skipped.
- Previous production dependency audit: zero vulnerabilities; full development audit retained eight moderate lint-chain advisories. Current package/security updates are included in the uncommitted candidate.

The browser suite uses real application APIs/authentication authorization with synthetic signed JWTs and temporary SQLite. Gemini's external response and Supabase logout are local test doubles. It does **not** authenticate against live Google, confirm a mailbox, send an email, or prove production PostgreSQL behavior.

## Visual evidence

Screenshots contain fictional fixture records only:

- [Care Pulse desktop](review/care-pulse-desktop.png).
- [AI Care Planner desktop](review/ai-care-planner-desktop.png) and [mobile](review/ai-care-planner-mobile.png).
- [Coordination Story mobile](review/coordination-story-mobile.png).

Screenshots were rendered in headless Edge and visually inspected. Browser tests assert no horizontal overflow for the new mobile experiences; existing Care Circle smoke checks cover 375/768/1024/1440 widths. This is not a full assistive-technology/WCAG certification or an exhaustive visual audit of every page/state in both themes.

## Synchronization and performance

Shared mutation-triggered refresh remains authoritative; no WebSocket/live-real-time claim is made. Handoff acknowledgement does not silently complete a linked task. Story events are linked by stored resource IDs, never matched by title. Permissions and obsolete-account request guards remain server/client enforced.

The [latest local observation](performance/local-signature-final.json) retains **25 requests / 2 contextual prefetches / 9 API reads / 0 duplicate API reads**, compared with the original 55/22/9/0. One auth/me per document and one journey-save task refresh are asserted. Timings are machine-specific single observations; no production speed guarantee or fix for the unreproduced 3.8-minute incident is claimed. Read-only production findings remain in the [readiness report](PRODUCTION-READINESS-REPORT.md).

## Requires configuration or external verification

1. **Invitation email:** Render's optional delivery flag is off; Resend key and verified sender are absent. Secure invitation links work. An approved owned-domain/DNS/Resend setup is required before claiming emails are sent. Provider acceptance does not prove inbox receipt.
2. **Supabase email:** confirmation remains enabled. SMTP/site redirects/templates and an actual confirmation/recovery mailbox flow need authorized Dashboard/inbox verification. This is separate from caregiver invitation email.
3. **Live Google/session flow:** enabled provider and PKCE construction verified; actual consent screen/callback/sign-in/out/returning workspace must be verified using an authorized account.
4. **PostgreSQL staging:** test the earlier additive `patients.is_demo_workspace` migration and backup/restore before promotion. No new migration for the three signature features. Existing production PG Free expiration is December 7, 2026; ongoing persistence requires an approved plan.
5. **Live Gemini:** local positive output is a controlled provider double. Test one authorized fictional/de-identified note after approval, with provider credentials unchanged.
6. **Production candidate:** these changes are not committed or deployed. No production business-route write/refresh acceptance was performed in this local sprint.

## Deliberately limited

- Planner is a structured coordination workspace, not an autonomous agent or clinical chat service. It does not infer missing dates/assignees or transmit the entire workspace. Users must review the minimal brief and add de-identified responsibilities; useful missing-information responses are valid when no facts exist.
- Duplicate checks normalize exact task titles; differently worded tasks with the same meaning still need human review. Approval row-lock behavior on PostgreSQL is implemented but requires staging verification; SQLite regression covers sequential idempotence and conflict behavior.
- AI rate limiting is process-local; keep the existing single-worker deployment until a shared limiter is provisioned. Input screening is not a guarantee that arbitrary medical content is safe for an external vendor. No real health-information processing readiness or clinical validation is claimed.
- No reminder delivery, external messaging, clinician endorsement, adoption metrics or health outcomes are fabricated.

Use the [deployment checklist](DEPLOYMENT-CHECKLIST.md) and [judge checklist](JUDGE-DEMO-CHECKLIST.md) after review. No further feature work is required for this local acceptance scope.
