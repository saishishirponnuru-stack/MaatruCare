# Authentication repair - 7 November 2026

## Findings verified without changing accounts or provider settings

The configured frontend Supabase project is `qvbwpcnjshkrwvdcecmc`. Its public settings endpoint accepts the configured public key. Email/password and Google are enabled, signups are enabled, and email confirmation is required (`mailer_autoconfirm=false`). The backend issuer and JWKS URL match that frontend project. No service-role key was found in frontend or backend configuration.

The old verification banner was a persistent URL flag, not evidence that email was delivered or an account confirmed. Supabase's `invalid_credentials` response cannot establish the affected account's confirmation state or whether it has a password. A Google-only account may need password recovery to establish a password. No affected mailbox or administrator access was supplied, so those account-specific facts and SMTP delivery remain unverified.

Fixed code defects: confirmation was labeled as Google-only; callbacks could silently reuse an older session instead of exchanging a new code; recovery lacked explicit code/error handling; registration lacked password confirmation; signed-in users could remain on sign-in; verification notices survived failed attempts. Registration now stays pending until confirmation, passwords are validated and never persisted by application code, and onboarding retains signup names and caregiver invitation links.

## Required Supabase Dashboard settings

In this same project:

1. **Authentication > Sign In / Providers > Email**: enable email/password sign-in; keep **Confirm email** enabled. Configure password strength to match your intended production policy (the application requires 8-128 characters; Supabase remains authoritative).
2. **Authentication > URL Configuration > Site URL**: `https://maatru-care.vercel.app` for the existing production domain. For a separate development project, use `http://localhost:3000`. Do not change production settings to localhost just to test.
3. **Redirect URLs**: allow `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/callback**` (the narrow suffix permits onboarding/invitation/recovery query parameters). Allow `https://maatru-care.vercel.app/auth/callback` and its callback query URLs. Retain `http://localhost:3000/reset-password` and `https://maatru-care.vercel.app/reset-password` for previously issued recovery links. Add equivalent `127.0.0.1:3000` entries only if using that origin. Avoid unrestricted production wildcard domains.
4. **Authentication > Email > Templates**: confirmation and reset-password buttons should use Supabase's `{{ .ConfirmationURL }}`. A naked Site URL is not a verification link. Application-generated callbacks use `/auth/callback?next=...`; recovery also sets `type=recovery`. Both are handled explicitly. Previously issued implicit-token links remain supported. PKCE email links should be opened in the initiating browser; after confirming in another browser, sign in using the registered password if code exchange cannot finish.
5. **Authentication > Email / SMTP Settings**: configure custom SMTP with a verified sender/domain for public production signup and recovery. The default Supabase mailer is restricted to authorized organization addresses and tightly rate-limited. This SMTP setting is separate from the optional backend caregiver-invitation email provider. No SMTP configuration or inbox delivery was verified or changed here.
6. **Authentication > Providers > Google**: keep Google enabled with its existing client ID/secret. In Google Cloud, the OAuth authorized redirect URI must be `https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/callback`; the app origin belongs in the authorized JavaScript origins if that integration uses it. Do not use the application's callback as Google's provider callback. Existing accounts remain keyed by Supabase user ID; no email-only identity merge was added.

The public provider settings and local project alignment are verified. Site URL, redirect allowlist, email templates, custom SMTP and Google Cloud credentials cannot be inspected through the public settings endpoint and require Dashboard verification; no changes to those values are claimed.

## Validation and acceptance

From frontend: `npm.cmd run test:auth`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`. The auth unit tests use Supabase method doubles; they do not send email, create real accounts or inject application sessions. Node 22.18+ or the installed Node 24 runs these TypeScript tests without a new test dependency.

From backend: `.\.venv\Scripts\python.exe -m pytest tests -q`. Tests use isolated SQLite/JWT fixtures and cover preserved workspaces, repeated onboarding, unrelated subjects with matching email, authorization and caregiver invitations. They do not alter development records.

Manual acceptance still required with an authorized mailbox: register with matching passwords; receive and open confirmation; sign in with those exact credentials; save onboarding; create a fictional task; sign out; sign back in and reload the same saved workspace. Then request recovery, change the password, and verify the new password. In a separate browser profile, accept a real caregiver invitation using the invited email. Google sign-in must retain its same saved workspace. Verify failed/expired links show an error and another account cannot see the first account's records.

No production credentials/settings, existing authentication accounts, development records, or database schema were changed by this authentication repair. No commit, push, deployment or reset was performed.

Validated results: 23 frontend auth unit tests passed; backend suite 121 passed, 0 failed, 3 intentionally skipped reset tests. Browser checks passed for registration mismatch, password visibility, invalid credentials via an intercepted rejection response, stale verification notice removal, unauthenticated recovery rejection and sanitized callback errors. No real registration/sign-in/confirmation/recovery email journey was claimed. Final `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build` all passed.
