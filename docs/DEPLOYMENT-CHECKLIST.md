# MaatruCare — controlled release checklist

8 November 2026. **Preparation only. Do not execute Git writes, provider changes or deployment without explicit approval.** Current main HEAD remains 11b885c; the reviewed candidate is still uncommitted.

**Current release-preparation decision: NO-GO for immediate production promotion.** See [fresh production checks, exact commands and remaining gates](RELEASE-GO-NO-GO.md). Render/managed PG connectivity and CORS are verified read-only; the new column is absent; isolated PG staging is unavailable; Vercel API/browser access and Supabase Dashboard require reauthentication. Local green gates below remain valid. Do not push main before agreeing the backend-first sequence: linked automatic deployments can race that order.

## Local review gates

- [x] Preserve and inventory all uncommitted work in [session handoff](CODEX-SESSION-HANDOFF.md).
- [x] Backend isolated suite: 141 passed / 3 intentionally skipped reset cases.
- [x] Node suites: 34 passed; TypeScript, lint and optimized production build succeed.
- [x] Final optimized-build browser outcome: **21 passed / 0 failed**. Inspect [final review](FINAL-PRODUCT-REVIEW.md) before release approval.
- [ ] Review the complete intended diff, including new tests/components and additive migration. Historical root reports, scratch files (`cls`, `how --stat d2e9619`), context backups and browser_fixture.py were preserved and must not be blindly staged.
- [ ] Stage explicit reviewed paths only after approval. Exclude real environment files, credentials, databases, backups, virtualenvs, node_modules, generated builds and browser test results. Documentation screenshots contain only fictional test data.
- [ ] Recheck `git status --short`, current branch, configured remote/upstream and staged diff. No force push, automatic main reset or replacement of unrelated work.

## Database gate — before backend promotion

- [ ] Obtain approval for a disposable PostgreSQL staging database and backup/restore procedure. Never use the production database as a migration test fixture.
- [ ] Verify psycopg[binary] installs on the actual Render Python runtime and the managed connection resolves using the existing normalized SQLAlchemy URL.
- [ ] Apply the existing create-table/additive migration path to disposable staging. Verify `patients.is_demo_workspace` has false server default, existing records remain readable/counts retained, and a second migration run is idempotent.
- [ ] Verify owner/caregiver identity, consent revocation and planner approval duplicate guards on staging. The planner uses a workspace row lock on PostgreSQL; test concurrent approvals if multiple requests/workers are used.
- [ ] Do not run application imports against production merely to inspect configuration: startup initializes tables/migrations.
- [ ] Verify approved backup restoration separately. Never reset production tables or delete local SQLite/backups. Record the managed Free database expiry, December 7, 2026, and approve an ongoing persistence plan.

## Backend environment checklist

Keep secrets server-side and preserve existing values. The read-only [configuration script](../backend/scripts/check_production_config.py) checks setting names without opening/migrating a database; run it only in the intended environment, not by copying production secrets into output.

- Managed `DATABASE_URL`; Render service and PostgreSQL are both Virginia, so use the internal URL on Render. External URL is for specifically authorized external access, not frontend configuration.
- `MAATRUCARE_ENV=production`, correct Supabase issuer/JWKS/audience and exact HTTPS `CORS_ORIGINS`.
- `MAATRUCARE_TEST_AUTH_COMPAT=false`, `MAATRUCARE_DEMO_RESET_ENABLED=false`, `MAATRUCARE_SEED_DEMO_DATA=false`.
- Existing simulation controls `MAATRUCARE_DEMO_CAREGIVERS_ENABLED=true`, `MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS=1`. Review the candidate's explicit new-account fictional-workspace opt-in policy before promotion; no conversion of existing workspaces.
- Backend-only Gemini key/model if generation is required; one worker while rate limiting remains in memory.
- Optional invitation delivery only after separate approved configuration: enabled flag, server-only Resend sending key, verified-domain sender and `MAATRUCARE_PUBLIC_APP_URL=https://maatru-care.vercel.app`. Otherwise retain secure-link fallback and do not claim email delivery.

## Authentication gate

- [ ] Supabase project `qvbwpcnjshkrwvdcecmc` for both frontend and backend. Keep email confirmation enabled and the existing Google provider.
- [ ] Verify Site URL `https://maatru-care.vercel.app`; production/local `/auth/callback` redirects and required recovery/invitation variants; retain legacy reset links.
- [ ] Google provider callback `https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/callback`; verify Google Cloud authorized configuration separately from the application's callback.
- [ ] Verify Supabase custom SMTP/sender and `{{ .ConfirmationURL }}` templates. Test signup → inbox confirmation → onboarding → signout → sign-in → retained workspace, and recovery, with authorized test mailboxes.
- [ ] Test a genuine invited caregiver with matching verified email, withdrawal/expiry, permission revocation and unrelated-account denial. No simulation counts as real authenticated participation.

## Approved deployment order

1. After approval, commit explicit reviewed source/config/tests/docs, push the verified intended branch and integrate without overwriting unrelated changes. Re-run gates if integration changes code.
2. Deploy backend first to existing Render service MaatruCare (`srv-db9s61m1egvs738ecrj0`), root backend, requirements from backend/requirements.txt, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Monitor actual startup logs, revision and managed DB connectivity; build success/health alone is insufficient.
3. Verify authenticated saved reads, membership/permissions and one explicitly authorized synthetic write/read/refresh in an isolated demonstration workspace. Preserve all existing records and history.
4. Rebuild Vercel Production from the same reviewed revision, root frontend, API base `https://maatrucare.onrender.com`, same Supabase URL/public key and build-time `NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED=true`. Never copy the fixture localhost build to production.
5. Confirm aliases and revisions at `https://maatru-care.vercel.app` and `https://maatrucare.onrender.com`. Complete the [judge workflow](JUDGE-DEMO-CHECKLIST.md) and live auth/mailbox checks. Capture console/network errors and an authenticated HAR before declaring the earlier performance incident fixed.

## Rollback

Restore the previous frontend deployment, then previous backend code if needed. Retain the additive column and every record; older code ignores the new field. Newly opted-in demo accounts may temporarily lose simulation availability under older code; workspace 1 retains its legacy allowlist. Do not automatically restore an old database over new writes, reset data, rotate keys or change production flags. Escalate any data-recovery/provider changes for explicit approval.
