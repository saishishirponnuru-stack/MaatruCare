# MaatruCare — final demo runbook

**Health-a-thon 2026 · Team MedTek · updated 7 November 2026**

This runbook describes the existing application only. Use fictional, non-identifying, non-clinical coordination information. Do not enter real patient or caregiver data. The demo permission model uses numeric actor IDs; it is not proof of a person's identity and is not suitable for real patient records.

## 1. Start a fresh local synthetic backend

From the repository root, open PowerShell and run:

```powershell
New-Item -ItemType Directory -Force .work\local-demo | Out-Null
$qaDb = Join-Path $PWD (".work\local-demo\demo-{0}.sqlite3" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$env:DATABASE_URL = "sqlite:///" + ($qaDb -replace '\\', '/')
$env:AI_PUBLIC_DEMO_MODE = 'false'
$env:DEMO_ACTOR_CAREGIVER_ID = '1'
Set-Location .\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The application creates and seeds this new SQLite file with fictional records. Keep the terminal open. Confirm `http://127.0.0.1:8000/api/health` reports `status: ok`. If you use a different backend URL, do not use the production database for this demo.

## 2. Start the frontend against that local backend

Open a second PowerShell terminal at the repository root:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8000'
$env:NEXT_PUBLIC_DEMO_ACTOR_CAREGIVER_ID = '1'
Set-Location .\frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. The frontend should display synthetic seeded content. The preview used for the attached screenshots was pointed explicitly at this local API and a fresh local SQLite file; it did not call Render or Vercel.

## 3. Recommended judge walkthrough

1. **Home (`/`)** — show the dashboard's coordination overview and explain that it is not a clinical assessment or risk score.
2. **Tasks (`/tasks`)** — create a clearly fictional item such as “Confirm pickup time,” select an available caregiver, save, then edit/reassign or mark it complete. Wait for the server response before describing the change as saved. The task-owner menu is limited to caregivers actually returned by the backend; patient ownership is handled separately by the task data model.
3. **Care Circle (`/care-circle`) and Consent (`/consent`)** — explain each permission before toggling it. Only an authorized patient controller can change grants. An existing grant can be repeated safely as a no-op; a missing grant can be created by an authorized controller. A denied request must remain denied until the controller explicitly grants access.
4. **Handoffs (`/handoffs`)** — use a fictional logistical reason (for example, “Confirm who will bring the visit folder”). Select sender and recipient, create the handoff, then acknowledge it as the receiving caregiver. A handoff requires the relevant `Care handoffs` permission; grant it through the controller's consent workflow first if needed. The backend, not the screen alone, determines whether the acknowledgement succeeds.
5. **AI Assist (`/ai-assist`)** — show a fictional, non-clinical note and explain that the generated text is a draft. Review/edit/reject it before any separate action. The current review buttons record local UI state only; they do not persist a review event, create tasks, or share information.
6. **Lifestyle (`/lifestyle`)** — demonstrate fictional hydration, sleep, weight, activity, and coordination records only. Explain that the page is not clinical advice or a validated maternal-health assessment. Use the browser's local date and show empty-goal states as “No goal,” not as a zero-percent health result.
7. **Reset (`/settings`)** — the reset control requires confirmation and only applies when the local backend is started with `MAATRUCARE_DEMO_RESET_ENABLED=true`. Use a newly created synthetic SQLite database only. The reset endpoint still checks the authorized controller and patient-scopes deletion; optional preferences reset is separately selected. After success, use the link to re-open Lifestyle and confirm records have reloaded. Never enable this for production patient data.

Useful example note for an authorized local AI demo: “Mira will confirm the shuttle pickup for Thursday's appointment; Dev will collect the visit folder after lunch.” Never submit identifiers or medical details.

## 4. Permission and AI requirements

`GET /api/caregivers` and `GET /api/tasks` require the acting caregiver to have the `Coordination tasks` permission. If either returns 403, do not switch IDs or hide the error: use the authorized controller's permission screen to grant the missing permission, or explain that access is not enabled. The production database was not inspected; its exact grant state is unknown.

The Lifestyle reset route is disabled by default. Do not change the production flag or deployment settings as part of a demo; use a disposable localhost SQLite database and explicitly set the opt-in only in that local backend process.

The AI public-demo route is disabled by default. An actual generated summary requires the backend process to have `AI_PUBLIC_DEMO_MODE=true` and a valid server-side `GEMINI_API_KEY`. Only enable this for a permitted synthetic demo; never put the key in a `NEXT_PUBLIC_*` variable, browser storage, a screenshot, or the repository. Tests use a mocked Gemini call. Identifier and clinical-word checks are heuristic and cannot guarantee that sensitive text is detected.

## 5. Expected visible outputs

- Dashboard, Tasks, Care Circle, Handoffs, and Lifestyle display the synthetic data returned by the local API.
- A successful task mutation updates the task state; a failed request must not be presented as saved.
- A successful permission action shows the resulting grant state; an unauthorized action shows an error, and a 403 remains an access denial.
- A successful handoff shows its backend status and, after recipient acknowledgement, the acknowledged state.
- AI Assist shows a draft with a human-review requirement. No AI output should be presented as medical advice or as already approved.
- A confirmed local Lifestyle reset reports deletion counts, preserves routines/recommendations and unrelated data, and the follow-up link loads the empty or remaining synthetic state from the backend. Reset remains unavailable unless explicitly enabled for that local process.

## 6. Backend recovery

If the local API is unavailable, check that the backend terminal is still running and that `http://127.0.0.1:8000/api/health` responds. Restart Uvicorn using the same `$qaDb` path so the synthetic records remain available. Keep the frontend pointed at `127.0.0.1:8000`; do not switch to production as a shortcut. Reload the page after the API is healthy. If a mutation returned an error, verify server state before retrying it.

## 7. Stop and cleanup

Stop each local process with `Ctrl+C`. The generated SQLite file is under `.work\local-demo`; keep it if needed for local inspection, or remove only the specific demo file after confirming both processes are stopped. Do not remove or alter any existing backup files or other databases.

## Known limitations

The production permission row has not been verified. The demo's numeric actor ID and role checks do not establish authenticated identity. Rate limiting is process-local and heuristic note screening is not a privacy guarantee. AI-provider requests were not performed during QA. No feature in this demo is clinically validated, a diagnosis, treatment recommendation, or substitute for a clinician.
