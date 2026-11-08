# Existing-account invitations — diagnosis and safe implementation boundary

8 November 2026. Based on deployed release4a36db6 and isolated reproductions on `fix/stabilize-ai-2026-11-08`. **Multiple Care Circles are not currently supported. This investigation does not implement or claim multi-membership acceptance.** No production account, invitation or record was accessed or changed for these tests.

## Exact reason Pending persists

Three cooperating behaviors in release4a36db6 explain the reproduced scenario. The safe frontend corrections below address misleading navigation/success, but do not change the single-membership architecture:

1. **Backend architectural restriction.** [Account](../backend/app/models.py) has a unique Supabase subject and only one `patient_id`, `caregiver_id` and global role. A Caregiver row is one relationship to one patient. There is no Account-to-Care-Circle membership table, active workspace API or safe selection mechanism. Invitation creation permits an email already registered elsewhere, but [direct acceptance](../backend/app/routers/auth.py) rejects any already-linked account with **HTTP409: Account is already linked**, before consuming the token. The invitation therefore correctly remains Pending according to that current restriction.
2. **Released frontend redirect discarded the join intent.** It redirected linked accounts from onboarding to Dashboard, even with a valid invitation. The OAuth callback itself preserved the sanitized invitation; the subsequent destination policy discarded it. The stabilization helper now preserves explicit valid invitation intent for review.
3. **Released onboarding could appear successful without acceptance.** An existing account submitting an invitation called bootstrap. Bootstrap returns the existing Account as **HTTP201** without processing that invitation. The old page navigated to the existing dashboard. A browser reproduction captured this response and a fresh owner GET still said Pending. Stabilized onboarding now calls the existing explicit acceptance endpoint for linked accounts instead, and displays its rejection without navigating away.

This is a **single-workspace architecture limitation plus misleading routing/bootstrap behavior**, not merely a stale React permission list or proof that email authentication failed. The private production invitation was not inspected; the exact supplied A/B/existing-C scenario was reproduced with synthetic identities.

An owner page on another device also does not automatically refetch invitations after another user acts: the current Care Circle page loads them on mount. That can leave a stale visible list after a supported new-account acceptance until reload/navigation. However, in the existing-account reproduction the backend itself remained Pending after a fresh GET, so refresh alone cannot fix this case.

## Current architecture and security findings

- **A — Multiple memberships:** unsupported. There is one current/legacy binding per Account.
- **B — Single workspace:** supported APIs keep an existing account bound to its existing workspace. Profile updates do not transfer it.
- **C — Acceptance:** an eligible unlinked verified identity becomes one Account and one real Caregiver relationship. Five sharing categories start disabled. No old caregiver grants are copied.
- **D — Existing accounts:** all linked accounts are still rejected by direct acceptance, including an owner of their own workspace and a caregiver of another workspace. The global email alone is not used to merge authentication identities.
- **E — Stale state:** possible across devices, but not the cause of the reproduced backend Pending state.
- **F — Wrong account:** accepting email is checked against the invitation case-insensitively. Creation trims/lowercases addresses; Gmail dot/plus aliases are not treated as automatically identical. Wrong-account requests were rejected in isolated tests.
- **G — Explicit action:** new-account onboarding consumes a valid invitation only after submission. Opening a link or signing in is not acceptance. Stabilized existing-account routing now retains the review and an explicit Accept invitation action. There is still no dedicated recipient preview/decline API.

The [access service](../backend/app/services/access_service.py) and [auth actor binding](../backend/app/services/auth_service.py) resolve the actor from the authenticated Account's persisted caregiver/workspace, overriding arbitrary frontend actor IDs. `require_patient_caregiver` rejects another patient ID. Owner authority also depends on Account's role and binding. Merely adding a second Caregiver row or changing Account.patient_id would respectively fail those checks or discard/downgrade existing access. Neither is a safe fix.

## Isolated reproduction and actual coverage

[Backend diagnosis tests](../backend/tests/test_invitation_membership_limits.py) use conftest's disposable SQLite database and valid synthetic JWTs. [Browser reproduction](../frontend/tests/browser/invitation-limits.spec.ts) uses the actual frontend/API in the isolated harness. [OAuth routing test](../frontend/tests/invitation-limits.test.mjs) uses the real callback/destination functions with SDK doubles.

Verified current behavior:

- Owner A creates Circle A; owner B creates Circle B; account C accepts an A invitation as a real authenticated caregiver relationship and receives an explicit A task grant.
- B creates a valid invitation for the same C email. Direct acceptance returns409; B's fresh GET remains Pending; B gets no additional relationship or permissions.
- C still resolves to A, retains its existing authorized A task access, and cannot access B with forged patient/actor parameters.
- The initial browser reproduction captured old onboarding returning C's A binding without accepting B. After the safe frontend correction, the browser verifies an actual acceptance request returns409, an understandable unsupported-membership error remains on the invitation page, no bootstrap request is sent, B stays Pending and C stays in A.
- An existing owner is not rebound/downgraded by another Circle's invitation.
- New, unlinked recipients accept successfully, see Accepted after refresh, and begin with five disabled categories. Duplicate invitation creation for an existing active member is rejected.
- Invalid/expired/withdrawn/wrong-email tokens do not create relationships or grants.
- Two concurrent new-recipient accept requests produce exactly one Account and one relationship; only one succeeds. Repeated redemption currently returns404/409 rather than an idempotent successful acknowledgement. It does not create a duplicate membership.
- OAuth callback and stabilized linked-account routing both preserve a valid invitation for explicit review. Ordinary onboarding still redirects linked users to Dashboard, and malformed/external destinations remain rejected.

**Not verified or supported:** C successfully joining B while retaining A; selection between A/B; per-Circle privileges for that same account; idempotent successful repeat acknowledgement; recipient decline/preview. Green diagnostic tests prove the present restriction and preserved safety, not completion of the requested new capability. Future membership implementation must replace these limitation expectations with positive multi-Circle acceptance tests.

## Safe frontend correction included — no architectural workaround

- [authDestination](../frontend/lib/auth-flow.ts) preserves only already-sanitized invitation destinations for linked and new accounts; generic onboarding behavior and external-redirect rejection remain unchanged.
- [Onboarding](../frontend/app/onboarding/page.tsx) waits until authentication resolves, labels the join submission Accept invitation, and uses [the existing explicit acceptance API](../frontend/lib/api.ts) for already-linked accounts. It never rebinds an account or treats idempotent bootstrap as joining another Circle.
- The existing409 is explained clearly: additional Circles are not supported yet; the invitation was not accepted and existing access is unchanged. Wrong-email, expired, withdrawn and invalid-token responses remain backend-enforced and are surfaced normally.
- New unlinked users retain the existing name/onboarding bootstrap and real invitation acceptance flow. No backend runtime code, schema, invitation status, membership or grant was changed. Recipient preview/decline and positive multi-Circle support remain deferred.

## Why this is outside the stabilization release

The minimum correct change crosses persistent identity, every patient-scoped authorization path, ownership, audit attribution, metrics, AuthContext, all scoped API calls, browser storage and the new in-flight read coordinator. Account-global patient/role assumptions are present in AI drafts, Lifestyle, Tasks, Handoffs, Consent, invitations and analytics. Adding a selector alone would risk cross-Circle record disclosure or owner privilege escalation.

**No membership schema, binding rewrite or authorization workaround is included in the stabilization commit.** It contains the verified AI/performance/UI fixes and this diagnosis/regression evidence. No additional database migration or backend runtime deployment is required for that safe scope. Existing-account cross-Circle joining remains an explicit functional limitation requiring separately reviewed architecture work.

## Minimum safe follow-up design — review before implementation

### Identity and explicit membership

1. Preserve Account.id and its unique Supabase subject as the global identity. Do not create duplicate Supabase accounts or merge by email.
2. Add `CareCircleMembership`: account_id, patient_id, caregiver_id, per-Circle role(owner/caregiver), active/revoked state and timestamps; unique(account_id,patient_id). A relationship belongs to the same patient; a simulated participant may never acquire an authenticated membership.
3. Backfill memberships only from unambiguous existing Account bindings, retaining all IDs, caregiver records, permissions and audit history. Detect inconsistent/orphaned bindings and stop/quarantine for review rather than guessing from names/emails. Existing single-Circle users must retain their current behavior.
4. Keep legacy Account patient/caregiver fields as a compatibility/default binding during rollout, never overwrite them when adding a second Circle. Owner role for an action must come from the selected membership, not the Account's legacy global owner role.

### Selection and request isolation

5. Return authorized memberships and a selected/default Circle in auth responses. Introduce an explicit validated membership/Circle selector and visible active Circle label.
6. Every patient-scoped request carries its selected membership; the backend resolves it against the authenticated subject and active relationship before any query or mutation. Use a request-scoped access object; do not mutate the global Account ORM row as a workspace switch.
7. Headerless legacy clients continue using their unchanged legacy default Circle, never another tab's last-selected Circle. New clients explicitly send scope. This avoids server-global active-workspace races between tabs/devices.
8. Include membership scope in all private request-coalescing/cache keys, capture/check scope on response, invalidate on switch and remount/reset identity-scoped providers. Subject/token/path alone is insufficient once one subject has multiple memberships. Browser care preferences must also distinguish personal settings from Circle-specific settings.
9. Audit every router, including Lifestyle, AI draft list/review/approval, analytics genuine-participation counts and handoff participant checks. Grant permissions per relationship and Circle; do not inherit another Circle's grants or owner powers.

### Invitation transaction and UX

10. Add authenticated recipient preview of the inviting Circle and relationship, with minimum necessary information and no public medical records. Preserve the token through Google/email callbacks for both existing and new accounts.
11. Validate the token hash, expiry, withdrawal, target Circle and current verified recipient email. Review stored-profile email staleness when Supabase email changes; do not trust a caller-supplied email or silently identify accounts by email alone.
12. Accept in one transaction using a conditional token claim/row lock plus membership uniqueness. Create or reuse the authorized relationship; new membership permissions start disabled. Record accepted_by_account/membership and actual actor. Repeat requests by that exact accepted identity return the same membership; another identity cannot redeem an accepted token. Concurrent accept/withdraw must have one winner.
13. Same-Circle duplicate invitations should acknowledge the existing active membership safely, without duplicate relationships, inherited privileges or automatic reactivation of revoked access. Define re-invitation/reactivation policy explicitly and retain history.
14. Add explicit Accept/Decline and structured already-member/expired/withdrawn/wrong-account/unavailable errors. Decline requires a recipient-bound status/timestamp, not an owner withdrawal impersonating the recipient. Do not mark accepted on link open. Show confirmation only after backend acceptance; then offer entry to the new Circle. Refresh owner invitation state on explicit refresh/return; do not claim real-time updates unless implemented.

### Additive rollout, tests and rollback

15. Use additive tables/columns/indexes, including accepted-by provenance and decline fields as needed. Backfill on isolated PostgreSQL18 with a verified backup/restore rehearsal. Old accepted links without provable accepted-by identity must stay non-redeemable; do not reconstruct authority solely from an email match.
16. Cover A-owner/B-owner/C-caregiver and owner-in-A/caregiver-in-B; new/existing/same-member invitations; expired/withdrawn/wrong-account tokens; concurrent acceptance/withdrawal; revoked membership; every permission category; all module reads/mutations; switching with pending requests and multiple tabs; real versus simulated participants.
17. Roll out membership-aware backend compatibility behind a feature flag, then the matching frontend. Enable only after the full scope/security matrix passes in isolated staging and an authorized synthetic canary. Do not use real production users as destructive test fixtures.
18. Roll back code/feature flags while preserving all additive data. Legacy default-circle access can remain available; new additional memberships may be temporarily inaccessible. Do not drop membership tables, rewrite existing Account bindings or restore an old data backup over new activity.

## Release decision

**AI/performance stabilization:** safe for reviewed commit and later explicit deployment authorization; no production action performed.

**Existing-account joining another Circle:** reproduced, diagnosed, **not fixed**. A verified multi-membership implementation is further architectural work. Do not describe this release as supporting it, convert another account, delete the recipient's original workspace, or mark the invitation Accepted to make a demonstration appear successful.
