# Product sprint handoff

## Deployment checkpoint — 7 November 2026

This checkpoint supersedes the older infrastructure-access statements below.

- Repository: https://github.com/saishishirponnuru-stack/MaatruCare . Verified production branch: `main`.
- Release branch: `release/submission-2026-11-07`; application commit `2f40126`. Source was explicitly staged and scanned for local credentials; no environment files, databases, backups, virtual environments or build output were committed.
- Vercel project `maatru-care` uses root `frontend`, Next.js and Node 24. The release built successfully: https://maatru-care-8bgxks8m0-shishir15.vercel.app . This preview requires Vercel authentication; its application UI was not smoke-tested publicly.
- Production and Preview now have the correct Render API URL and existing Supabase public URL/key configured. No service-role key was uploaded.
- Existing public production domains remain https://maatru-care.vercel.app and https://maatrucare.onrender.com . Both respond, but still run the older production revision. The release was deliberately not pushed to `main` or promoted.
- Render service `srv-db9s61m1egvs738ecrj0` automatically deploys `main`, uses root `backend`, build `pip install -r requirements.txt`, and start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Verified blocker:** Render is on the Free plan with no attached disk and no `DATABASE_URL`. It uses ephemeral SQLite. No Render PostgreSQL database is provisioned in this workspace. Restarting/deploying before preserving its data risks losing it; the new application also rejects ephemeral SQLite on Render.
- Supabase public settings confirm email/password and Google are enabled, signups are enabled, confirmation is required, and the project's ES256 JWKS is reachable. Dashboard redirect/SMTP settings and real authenticated participation remain unverified.
- Validation: backend `121 passed, 3 skipped`; frontend auth `23 passed`; TypeScript, ESLint and local production build passed. After the onboarding Suspense deployment fix, TypeScript/ESLint passed again and the Vercel cloud production build reached Ready.

### Required before production cutover

1. Preserve the running Render SQLite database using an existing verified backup or provider-assisted retrieval. Free web services do not offer SSH/Shell access. Do not restart, redeploy or upgrade the running service merely to obtain a backup; that can itself discard ephemeral files. A PostgreSQL connection does not migrate existing SQLite rows.
2. Provision durable PostgreSQL through an approved provider, or use the existing Supabase project's PostgreSQL connection from its **Connect** dialog with the actual database password. Configure the real connection securely in Render as `DATABASE_URL`; do not paste credentials into chat or commit them. No paid service was purchased and no password was reset here.
3. Import and verify retained records and relationships before switching traffic. Existing schema migrations are additive; they do not transfer SQLite data to PostgreSQL. If no backup can be recovered, stop for the owner's explicit decision rather than silently starting with an empty database.
4. Configure these Render environment values together once the backup/migration is ready:

   ```dotenv
   MAATRUCARE_ENV=production
   SUPABASE_ISSUER=https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1
   SUPABASE_JWKS_URL=https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/.well-known/jwks.json
   SUPABASE_AUDIENCE=authenticated
   CORS_ORIGINS=https://maatru-care.vercel.app
   MAATRUCARE_TEST_AUTH_COMPAT=false
   MAATRUCARE_DEMO_RESET_ENABLED=false
   MAATRUCARE_SEED_DEMO_DATA=false
   MAATRUCARE_PUBLIC_APP_URL=https://maatru-care.vercel.app
   ```

   Keep the existing backend Gemini credentials. Configure health check `/api/health`. Invitations retain the secure link fallback unless a verified sender/provider is configured. Keep simulation separately controlled.
5. Run the read-only production preflight against the prepared environment; then fast-forward the verified production `main` branch to the tested release (never force-push). Verify Render's deployment/health, then Vercel Production and the real signed-in acceptance journey using an authorized account. Do not promote the frontend against the older incompatible backend.

No production write/read persistence test, real sign-in journey, email delivery, database migration or production cutover is claimed by this checkpoint. Production remains blocked on verified backup and durable database configuration.

## Run locally (PowerShell, separate terminals)

From the project root:

```powershell
cd C:\Users\saish\MaatruCare\maatrucare\backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
cd C:\Users\saish\MaatruCare\maatrucare\frontend
npm.cmd ci
npm.cmd run dev
```

Restart an already-running backend to load the new schema and routes. Existing local data is preserved. SQLite upgrades are additive and repeatable; new tables and indexes are created without dropping existing tables. Back up important databases before applying upgrades. Appointments retain the local date/time entered by the care team. Analytics use `MAATRUCARE_TIMEZONE` (default `Asia/Kolkata`); audit timestamps are UTC and displayed locally.

## Validation

From `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

From `frontend`:

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

Three reset-mutation tests intentionally require explicit opt-in; leave them skipped. No reset was executed in this sprint. The production-configuration tests are read-only and do not connect to PostgreSQL.

## Critical demonstration

1. Sign in with Google; save your name and optional journey phase. Check `Welcome, {firstName}` after reload.
2. Create a caregiver invitation, share its secure link directly, accept it using the invited email in a separate browser profile, and enable selected sharing categories as the Care Circle owner. Optional email delivery is available only with a verified-domain Resend configuration; otherwise create/copy/share the secure link. Invitations expire in seven days and can be withdrawn before acceptance.
3. Create a task with an assignee, note and due date; move it to In progress, then Completed. Export the filtered task list if useful.
4. Prepare and send a handoff. The authenticated recipient acknowledges and completes it. The Care Circle owner cannot impersonate a real recipient. Separately enabled simulated participants use explicitly labeled simulations and audited transitions.
5. Log water and a personal goal; enter overnight sleep, optional quality and a duration goal. Correct a weight measurement for the same date. Create a 30-minute routine and record 25 minutes with a user-selected status. Record a meal and optional personal-goal adherence. Reload each view.
6. In AI Assist, enter a fictional coordination note, confirm Gemini processing, extract tasks, review/edit a suggestion and explicitly approve its creation. Open Tasks to verify it. Draft handoffs remain Prepared until sent normally. Care updates are copied, never delivered automatically. Saved-record questions use authorized backend facts without sending records to Gemini.
7. Switch to another care workspace account and verify a separate workspace. Revoke a caregiver category, reload their page, and verify access is denied. Check Timeline for real and simulated transitions.

Browser QA uses `backend/tests/browser_fixture.py --mock-ai`, a loopback-only helper with an isolated temporary SQLite database and test-only JWTs. It is not a deployment entrypoint or an authentication bypass in the application. The deterministic browser AI fixture is separate from the successful live Gemini fictional-note check. Real Google account consent/login and email delivery were not automated.

## Production configuration and persistence

Backend settings: `DATABASE_URL`, `MAATRUCARE_ENV=production`, `SUPABASE_ISSUER`, `SUPABASE_AUDIENCE=authenticated`, and either `SUPABASE_JWKS_URL` for current project signing keys or the actual legacy `SUPABASE_JWT_SECRET` for HS256. Set exact HTTPS `CORS_ORIGINS`. Gemini generation needs backend-only `GEMINI_API_KEY` and a supported `GEMINI_MODEL`. Optional settings: `AI_TIMEOUT_SECONDS`, `AI_RATE_LIMIT`, `MAATRUCARE_TIMEZONE`.

Frontend build settings: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key is public; the JWT secret and Gemini key must never be frontend variables. Supabase URL configuration must allow the actual frontend `/auth/callback` and `/reset-password` URLs. Use matching frontend/backend synthetic-participant flags only in an intentional fictional demo environment. Keep seed, reset and test-auth flags false in production.

```powershell
# Read-only environment validation, from backend; does not open or migrate a database.
.\.venv\Scripts\python.exe scripts/check_production_config.py
```

Render filesystems are ephemeral unless the relevant path is backed by an attached persistent disk: https://render.com/docs/disks . Actual deployed database, disk and backups were not accessible or verified. Code now supports PostgreSQL through psycopg 3 and rejects production/Render SQLite unless persistent `/var/data` configuration is explicit. That flag does not provision or verify a disk.

Before deployment, choose a durable managed PostgreSQL database or verify an attached disk at `/var/data`. Do not change `DATABASE_URL` and assume existing SQLite rows moved: export/back up the source, import into the new database during an approved migration, verify counts/relationships and restore ability, then change configuration. No remote data migration was performed. Use a single backend worker while AI rate limiting remains in memory. Database migrations are additive, not a substitute for a backup/restore or retention policy.

External AI is restricted to fictional or de-identified logistics with explicit processing consent. Keyword/identifier screening is not a guarantee of de-identification. Vendor terms, retention, privacy obligations and real-health-data security are not validated by this sprint. English/Hindi/Telugu apply to reviewable AI narrative output, not a fully translated interface.

## Release only after approval

Review `git status --short` and `git diff --check`; stage an explicit list of reviewed canonical source/test/config files. Do not use `git add .` or stage backup folders, databases, build output or `.env` files. Review `git diff --cached --stat` and `git diff --cached` before a commit. Then, only after authorization:

```powershell
git commit -m "Complete coordinated care workflows and reviewed AI assistance"
git push
```

From `frontend`, deployment to the already-linked Vercel project can use `npx.cmd vercel --prod` after approval and production environment verification. Trigger the existing Render service's approved deployment workflow after durable-storage migration/configuration; no service ID, deploy hook or infrastructure credentials were supplied here. Do not invent a deployment command for an unknown service.

Verify the public backend `/api/health`, frontend callback origins, genuine owner/caregiver sign-ins, denied cross-patient requests, persisted records after a controlled service restart, and the approved AI-task journey using fictional data. No commit, push or deployment was executed.

## Pilot measurement

A proposed 60?90-day pilot can measure baseline coordination in weeks 1?2, run a small consented caregiver workflow in weeks 3?8, then review completion rates, overdue responsibilities, acknowledgement rate/time, caregiver participation and usability in weeks 9?12. Define eligible records and missing data consistently. These operational measures do not establish clinical benefit.

## Session validation (7 November 2026)

- Backend: 99 passed, 0 failed, 3 intentionally skipped reset tests. Legacy datetime/FastAPI lifecycle warnings remain.
- Frontend: TypeScript, ESLint and optimized production build passed.
- Browser: isolated patient/caregiver records exercised permissions (including keyboard toggles), withdrawal, tasks, simulated and real-recipient handoffs, lifestyle persistence, profile editing, appointment create/edit, and AI approval into Tasks. Fourteen routes were checked at 375/768/1024/1440 pixels without page errors or horizontal overflow. These use fixture JWTs, not a completed genuine Google OAuth login.
- A live Gemini fictional-note request returned schema-validated suggestions after correcting the SDK JSON-schema transport. Deterministic browser AI output was separately labeled and tested through the actual persistence/approval endpoints.
- Read-only production preflight correctly rejected local SQLite/local-mode/CORS settings. No remote persistence, migration or deployment was claimed.

## Core workflow repair (7 November 2026)

- Workspace ownership now comes from the persisted authenticated account binding, independent of the legacy principal relationship name or its self-permission rows. Caregiver permissions remain enforced.
- Handoffs retain authenticated actor IDs, subject, simulation markers and timestamps. Cancel drafts/active handoffs or archive completed ones after confirmation; history is retained and removed records are excluded from active counts and analytics.
- Add simulated caregiver is visible beside Invite caregiver only when both simulation flags permit it. The creation form explicitly enables task/handoff sharing for fictional participants; other categories start off and all sharing remains editable.
- Timeline uses a connected vertical spine, server-side filters, stable time/ID ordering and pagination. Real caregivers only see their own handoff events. Completed task titles use persisted status for strikethrough and restore on reopening. Normal UI language uses care workspace and Care Circle owner.

Optional invitation email configuration (backend only): `MAATRUCARE_INVITATION_EMAIL_ENABLED=true`, `RESEND_API_KEY`, `MAATRUCARE_INVITATION_FROM` using a provider-verified custom domain, and `MAATRUCARE_PUBLIC_APP_URL` using the public HTTPS frontend origin. Local HTTP loopback is allowed only outside production. Do not use a personal Gmail/Outlook sender. A provider acceptance ID records acceptance for delivery, not inbox receipt. Unavailable, timed-out or rejected sends retain a valid pending invitation link and show a clear fallback. No real invitation email was sent during implementation.

Current core browser checks used isolated JWT accounts and temporary SQLite: mother with disabled self-permissions completed the simulated lifecycle; authenticated recipient completed a real-role fixture handoff; cancellation/archive, refresh, invitation withdrawal/link fallback, keyboard permission switches, cross-page sharing, task completion/reopening, filtered timeline and account switching passed. Handoffs, Timeline, Tasks and Care Circle had no horizontal overflow at 375/768/1024/1440 pixels. Real Google OAuth and live email delivery still require manual verification. Restart the local backend to load the additive schema changes; do not reset the database.

Final core validation: `python -m pytest tests -q` from the backend virtual environment: **119 passed, 0 failed, 3 intentionally skipped reset tests**. `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and the standard `npm.cmd run build` passed. The final frontend build uses the normal local API configuration, not the isolated browser fixture. Existing FastAPI/datetime deprecation warnings remain. No database reset, staging, commit, push or deployment was performed.
