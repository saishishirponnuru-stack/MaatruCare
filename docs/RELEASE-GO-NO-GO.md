# MaatruCare — production release decision

## Current authorized release — safety gates satisfied without Docker

The owner reauthorized continuation after Vercel login and explicitly excluded Docker as a requirement. Fresh authenticated checks now confirm the existing Vercel project `prj_4fAVVvQjduzPorGlfCFB9oB975hF`, root frontend, Next.js/Node24, and exact Production API/Supabase URLs and simulation flag. Existing Render service access also succeeds; no replacement project was created.

Official EDB PostgreSQL18.6 portable binaries were downloaded over HTTPS and verified against the vendor SHA256. A full custom-format production backup was created under a restricted current-user/SYSTEM folder outside Git. The backup SHA256 is `11c993316a1bef2c6ffc64b77f5303ece8dc50575167ffb00ff1608180feccdd` (79,901 bytes). An exported READ ONLY snapshot tied the dump to all 21 table fingerprints. Full pg_restore into a private loopback-only native PostgreSQL18.6 instance matched every table's original record hashes. The actual app migration ran twice there; all original record hashes and patient IDs were retained, with the sole pending column `patients.is_demo_workspace` default false/not nullable. Existing production data was not changed during backup/rehearsal.

Synthetic PostgreSQL task/handoff lifecycle and protected-route checks passed. Concurrent approvals from separate planner drafts returned201/409 and persisted exactly one task. No external model was called during that rehearsal. Fresh local gates passed again:141 backend/3 reset skipped,34 Node,21 browser; lint and explicit TypeScript exit0; the fresh optimized browser build succeeded.

**GO for the authorized controlled backend-first deployment.** Live Google/inbox/Gemini acceptance remains to be reported honestly after deployment; optional email remains unavailable with secure-link fallback. Use a separate release branch and explicit Render commit deploy before Vercel Production build/promotion. Main must not be pushed automatically. The earlier NO-GO/paused findings below are retained as historical checkpoints, not current blockers.

## Earlier authorized release attempt — paused at predeployment access

The owner subsequently authorized commit/push/backend-first production deployment **only after the documented safety gates pass**. On recheck, Render service access succeeds (HTTP200, auto-deploy enabled), but the existing Vercel project request still returns HTTP403 `forbidden` and its browser settings page remains at login. Release execution is paused before branch/commit/push/migration/deployment. No production records or settings changed. The verified local browser last-run remains passed and Git whitespace checks pass; full test suites were not rerun during this blocked attempt. Local HEAD remains main/11b885c with all existing work preserved.

Requested owner actions: run `npx.cmd vercel@latest login` using the account that can access the existing project; then confirm login. Also start Docker Desktop with Linux containers for an isolated PostgreSQL18 backup/restore rehearsal, or identify an existing verified backup and approved staging target. No credentials should be pasted into chat. Render's current documented Free PostgreSQL offering has no built-in recovery; a verified logical backup/recovery path is still required before any schema change. No paid upgrade or database reset is authorized or needed to satisfy this request.

The release authorization persists. Once authentication and recovery gates are resolved, resume this authorized sequence without asking again for the same deployment permission.

8 November 2026, read-only production verification at approximately 09:43–09:50 IST. **NO-GO for immediate production promotion. GO for release review/preparation.** No feature or cosmetic work was performed in this pass. No commit, push, deployment, provider configuration change, authentication bypass or application-data write was performed.

## Current source and evidence

- Local branch main, HEAD `11b885cad5c198ebb428a3c5283818ae5da0dd62`. The tested candidate remains uncommitted; its source is preserved. Staging area was empty when checked.
- [Engineering handoff](CODEX-SESSION-HANDOFF.md) inventories the working tree. All 89 existing tracked/untracked paths at the beginning of this release-preparation pass were retained. This report is an additional documentation file, not a release commit.
- Accepted local evidence is unchanged: **141 backend passed / 3 reset tests skipped; 21 optimized-build Edge browser workflows passed; 34 Node tests passed; TypeScript, ESLint and production build passed**. Browser last-run metadata still reports passed, with no failed tests. The full suite was not needlessly rerun because no application code changed in this pass.
- [Final product review](FINAL-PRODUCT-REVIEW.md) records methods, corrected failures, screenshots and limitations. These are local disposable SQLite/JWT tests, with external Gemini/logout doubles, not live Google/mailbox/PostgreSQL acceptance.

## Actual production checks performed now

### Render and PostgreSQL — verified

- Render API authenticated GETs succeeded. Existing service `srv-db9s61m1egvs738ecrj0` is Virginia, Free plan, branch main, root backend. Latest deploy `dep-dbnns8vf3r2c7395u5bg` is live at commit **11b885c**. Automatic deployments are enabled.
- Build `pip install -r requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; health path `/api/health`. No explicit PYTHON_VERSION or WEB_CONCURRENCY environment override was present. The current PostgreSQL-backed deployment already starts with its installed driver; the current candidate explicitly includes psycopg[binary]. Runtime compatibility of new startup/migration work remains a staging gate.
- `MAATRUCARE_ENV=production`. JWKS URL and issuer match Supabase project `qvbwpcnjshkrwvdcecmc`, audience authenticated. No legacy shared JWT secret is set; JWKS verification is intended.
- CORS is exactly `https://maatru-care.vercel.app`; authenticated-request preflight returned **200** with this allowed origin.
- `MAATRUCARE_DEMO_CAREGIVERS_ENABLED=true`, `MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS=1`; reset, seeding and test-auth compatibility are **false**.
- Gemini key exists server-side, model `gemini-3.1-flash-lite`. No live provider generation was requested. Public application URL is correct.
- DATABASE_URL points to internal managed PostgreSQL, expected database name. Service and database are both Virginia; retain the internal URL for Render. Never put it in Vercel public variables.
- Render lists **one** database: production maatrucare-db, PG18, available, Free, expires **7 December 2026 at 16:57 UTC**. No separate staging database was listed.
- An external TLS connection using the existing Render connection information succeeded with raw psycopg. The first SQL statement made the transaction **READ ONLY**, confirmed on the server; no application module/startup/migration was imported. Server **18.6**, timezone UTC, all 11 checked core tables exist, and existing AI task/handoff unique indexes exist. The connection was rolled back/closed. No record values or secrets were printed.
- **The new `patients.is_demo_workspace` column does not exist in production.** Deployment will need the reviewed additive migration. Current production was not migrated.
- Landing HTTP **200**. First parallel backend probes timed out at 30 seconds; one controlled repeat succeeded: health **200** / status ok, anonymous auth/me **401**, CORS **200**, OpenAPI **200**. The cause of the transient delay was not proven; do not label it a resolved cold-start incident. Current published OpenAPI does **not** include `care_plan`, confirming the new backend contract is not deployed.

### Vercel — access currently blocked

- Public frontend loads and Care Circle correctly redirects an unauthenticated browser to sign-in. No signed-in application session was available, so no production records were created or edited.
- Saved Vercel CLI credential receives **403 forbidden**, including `/v2/user`. Browser access to project settings redirects to Vercel login. Current private project settings, active frontend revision and Production variable values **could not be freshly verified**.
- Last prior successful inspection recorded root frontend, Node24, API base `https://maatrucare.onrender.com`, Supabase URL for the same project, and build-time demo flag true. These remain historical findings, not a substitute for current verification after reauthentication.
- Local root/frontend `.vercel/project.json` linkage was not present. Future CLI deployment must link the existing project explicitly from a clean checkout; do not create a different project or upload the dirty working tree/backups.

### Supabase and email — partially verified, action needed

- Public auth settings returned **200**: Google enabled, email/password enabled, signups enabled, email confirmation required (`mailer_autoconfirm=false`). No verification bypass was introduced.
- Supabase Dashboard URL Configuration redirects to its sign-in page. No management token was configured locally. Exact Site URL/allowed redirects/SMTP/templates and Google Cloud configuration **remain unverified**.
- No authorized live app account/mailbox was supplied. Actual Google callback, confirmed email signup/sign-in/recovery, account restoration, live invitation acceptance and sign-out are not claimed verified in production.
- Render invitation delivery flag is **unset**; Resend key and invitation sender are **absent**. Public app URL exists. This is the exact missing configuration for caregiver email; secure-link invitations remain the supported fallback. No email was sent or delivery claimed.
- Supabase signup/recovery SMTP is a separate provider configuration and remains unknown; Render's Resend variables cannot establish it.

## PostgreSQL staging gate

No isolated staging URL exists in the checked process/project environment. Render exposes only production PostgreSQL. No local PostgreSQL service/psql was found, and Docker's daemon is unavailable. No database was provisioned and no purchase/hosting change was made.

Therefore the migration and approval row locking **have not been tested against staging PostgreSQL**. Successful read-only production connectivity is not migration compatibility evidence. Required approved staging work:

1. Provision an isolated PG18 target or provide an existing authorized staging URL securely. Do not paste credentials into chat/reports.
2. Rehearse initialization of an empty staging schema; separately test an old-schema fixture with fictional retained records, the additive migration and a second idempotent migration run.
3. Confirm false default on `patients.is_demo_workspace`, retained rows/relationships/indexes and existing account restoration. Test concurrent planner approvals, consent revocation and cross-account reads there.
4. Verify a production backup exists in approved secure storage and its restore procedure works on a separately authorized target. Do not keep a data backup in Git, upload it with the frontend, or overwrite the live database. A schema-only staging rehearsal must not be represented as a full backup restore test.

## Exact owner actions required

1. **Reauthenticate Vercel** using its dashboard or `npx.cmd vercel@latest login`. Confirm existing project maatru-care under shishir15, root frontend, Node24 and Production target. Verify, preserving working values:
   - `NEXT_PUBLIC_API_BASE_URL=https://maatrucare.onrender.com`
   - `NEXT_PUBLIC_SUPABASE_URL=https://qvbwpcnjshkrwvdcecmc.supabase.co`
   - existing public/publishable Supabase key for that same project (do not expose it here)
   - `NEXT_PUBLIC_DEMO_CAREGIVERS_ENABLED=true` at build time.
   Ensure service-role, Gemini, Resend and database credentials are not exposed as NEXT_PUBLIC variables.
2. **Sign into Supabase Dashboard.** Under Authentication → URL Configuration, verify Site URL `https://maatru-care.vercel.app`. Check the narrowly scoped entries `https://maatru-care.vercel.app/auth/callback**` and `http://localhost:3000/auth/callback**` so the application's next/recovery/invitation query strings are supported; retain `https://maatru-care.vercel.app/reset-password` and `http://localhost:3000/reset-password` for old links. Add equivalent 127.0.0.1 entries only if that development origin is actually used. No wildcard production domains. See [application auth findings](AUTHENTICATION-REPAIR.md) and [Supabase's redirect matching documentation](https://supabase.com/docs/guides/auth/redirect-urls). These are intended entries to verify after login, not claims about currently saved values.
3. Under Sign In/Providers verify Google remains enabled. Google Cloud's authorized provider callback is `https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/callback`, distinct from the app's `/auth/callback`. Do not rotate working credentials. Verify confirmation/recovery templates preserve `{{ .ConfirmationURL }}` and custom SMTP/verified sender for intended public recipients. Complete one authorized actual Google and confirmed-email/recovery acceptance.
4. **Provide isolated PostgreSQL staging and backup verification** as above.
5. **If email delivery is required:** verify an owned sender domain/DNS in Resend; after approval configure backend `MAATRUCARE_INVITATION_EMAIL_ENABLED=true`, `RESEND_API_KEY` and `MAATRUCARE_INVITATION_FROM` using that verified sender. Keep `MAATRUCARE_PUBLIC_APP_URL=https://maatru-care.vercel.app`. Test provider acceptance and inbox receipt separately with an authorized mailbox. Otherwise explicitly accept link-only invitations for this release.
6. Review/approve the candidate, the opt-in new fictional-workspace policy and deployment actions. Plan durable operation beyond the PG Free expiry; no paid service or infrastructure change was made here.

## Product journey evidence

- Google: provider enabled now; local browser proves PKCE/same-origin callback construction. **Actual production authentication remains unverified.**
- Onboarding/Care Circle: local browser covers new empty opt-in workspace, real matching-email invitation acceptance, simulated caregiver create/edit/persistence. Backend covers ownership and repeat bootstrap. No production write test performed.
- Tasks/handoffs/Timeline/Care Pulse/Story: real local APIs cover task create/assign/complete/reopen, real-recipient and explicitly simulated handoff lifecycle, recorded actor/timestamps, timeline history, linked task independence and refreshed Pulse/Story.
- Planner: structured local provider double → explicit individual approval → persisted actual task/draft → refreshed context/Pulse. Local backend covers duplicate rejection, permission revocation, provider failure, unsupported facts and no pre-approval task. **Live Gemini not tested.**
- Lifestyle/consent/signout/account isolation: local browser/API tests cover all five trackers, retained records, sharing changes, signout and separate accounts; backend covers unauthorized/cross-workspace denial. **Not claimed verified on the public candidate**, which is not deployed.

## Backend-first deployment sequence — only after approval

**Do not push the candidate directly to main before sequencing is agreed.** Render auto-deploy is enabled, and the Vercel Git integration may automatically promote main. Use a reviewed release branch and explicit commit deployment so production frontend cannot precede the backend. A branch push may build a preview; that is not production promotion.

1. Commit only explicit reviewed source/config/test/doc files after approval, preserving excluded untracked reports/scratch/backups/secrets/databases. Push the reviewed **release branch**. Record the immutable SHA. Do not blindly stage all 90 paths or force-push main.
2. Verify backup and staging gates. Deploy that SHA explicitly to existing Render. The following PowerShell is a **future execution template**, not executed here; `RENDER_API_KEY` must be supplied securely through the authorized operator environment, never committed or printed:

```powershell
$releaseSha = (git rev-parse HEAD).Trim() # Reviewed, committed, pushed release SHA only
$renderHeaders = @{ Authorization = "Bearer $env:RENDER_API_KEY" }
$renderBody = @{ commitId = $releaseSha; clearCache = "do_not_clear" } | ConvertTo-Json
$renderDeployment = Invoke-RestMethod -Method Post `
  -Uri 'https://api.render.com/v1/services/srv-db9s61m1egvs738ecrj0/deploys' `
  -Headers $renderHeaders -ContentType 'application/json' -Body $renderBody
$renderDeployment.id
```

Render documents [specific-commit deployment](https://api-docs.render.com/reference/create-deploy). It does not disable subsequent auto-deploys: prevent unrelated main pushes during the release window. Check that the deployment ID becomes live, its SHA matches, startup/migration logs contain no errors, and database-backed authenticated reads work before proceeding.

3. Health and CORS probes (these GET/OPTIONS commands alone do not prove authentication or database-backed writes):

```powershell
curl.exe --fail --show-error https://maatrucare.onrender.com/api/health
curl.exe -i https://maatrucare.onrender.com/api/auth/me
curl.exe -i -X OPTIONS https://maatrucare.onrender.com/api/tasks `
  -H 'Origin: https://maatru-care.vercel.app' `
  -H 'Access-Control-Request-Method: GET' `
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

Expect health200, anonymous auth401, CORS200 with the exact production origin. Then use the authorized browser for saved reads/permission enforcement and explicitly approved fictional write/read/refresh acceptance. Never substitute a privileged database insert for that acceptance.

4. Deploy frontend from a **clean checkout of the reviewed release SHA**, not this dirty workspace. This avoids uploading unrelated untracked context backups/scratch. Example setup after approval:

```powershell
$releaseDirectory = Join-Path $env:TEMP ("maatrucare-release-" + $releaseSha.Substring(0,12))
git clone --no-checkout https://github.com/saishishirponnuru-stack/MaatruCare.git $releaseDirectory
git -C $releaseDirectory checkout --detach $releaseSha
Set-Location $releaseDirectory
npx.cmd vercel@latest link --yes --project maatru-care --scope shishir15
npx.cmd vercel@latest deploy --prod --skip-domain --force --scope shishir15
```

Verify the linked existing project ID is `prj_4fAVVvQjduzPorGlfCFB9oB975hF` and its Root Directory is frontend before the deploy command. Stop if the identity/root differs; do not create a replacement project. The --prod build uses Production variables, --force rebuilds, and --skip-domain holds the live alias. If Git/CLI authentication or the target directory is unavailable, stop; do not overwrite anything to proceed.

5. Inspect the deployment URL returned by the CLI, complete protected deployment smoke checks with authorized access, then promote that exact deployment:

```powershell
npx.cmd vercel@latest inspect <NEW_DEPLOYMENT_URL> --wait --scope shishir15
npx.cmd vercel@latest promote <NEW_DEPLOYMENT_URL> --scope shishir15
curl.exe --fail --show-error https://maatru-care.vercel.app/
```

`<NEW_DEPLOYMENT_URL>` is the future CLI result, not an existing preview. [Vercel documents staged production builds and promotion](https://vercel.com/docs/cli/deploying-from-cli). Confirm both public aliases/revisions and the full authorized journey before calling production accepted. Merge the already deployed/tested release to main only in the agreed window; expect linked auto-builds/redeploys and verify their revisions too.

## Downtime and migration risk

- The pending column/default is additive; no table drop or data reset is required. PostgreSQL ALTER TABLE still needs a table lock. Startup also runs existing idempotent owner/audit corrections and index checks; this is not a zero-write/no-lock migration.
- Existing old code can ignore the new column, permitting a backend-first rollout, but actual startup duration/lock contention has not been rehearsed on PG18 staging. Use one backend worker and avoid concurrent schema initialization or long transactions during promotion.
- Render normally routes to a newly healthy deployment, but the health endpoint does not query the DB. Neither rolling deploy mechanics nor frontend alias switching guarantees uninterrupted business routes during DDL or Free-plan wake-up. The initial observed 30-second timeouts must be reflected in recording/release expectations. No exact outage estimate or zero-downtime guarantee is justified before staging.

## Rollback

1. Before promotion record the current production frontend deployment ID/URL after Vercel reauthentication. The last previously known deployment was `dpl_CBBv3xrYmzXpD3ivNpEV91c3X9st`; verify it still represents the intended rollback version before using it.
2. If the new frontend fails, promote the recorded prior frontend deployment using Vercel's supported rollback/promotion controls. Keep data intact.
3. If the backend fails, redeploy previously healthy **11b885cad5c198ebb428a3c5283818ae5da0dd62** through Render's specific-commit operation. Record the current new-deployment failure before retrying unchanged code.
4. Retain the additive column/indexes and every record. Do not run a down migration, reset tables, delete new accounts or automatically restore an old data snapshot over newer writes. Newly opted-in fictional accounts may lose simulation availability on old code; the legacy workspace1 allowlist remains.
5. Any data recovery, credential rotation, provider setting change or database restoration needs separate explicit approval.

## Final decision

**NO-GO now:** Vercel deployment access/current configuration cannot be verified; Supabase redirect/SMTP settings and actual Google/mailbox journeys are inaccessible; staging migration/concurrency and backup restore are unverified. Optional invitation email is unconfigured; it can be an explicitly accepted link-only limitation rather than a mandatory blocker.

Change to GO only after the required access, staging/backup and live authentication checks are satisfied and the reviewed immutable release receives deployment approval. Existing production remains intact and currently responds; the new candidate has not been published.
