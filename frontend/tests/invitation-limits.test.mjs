// Diagnosis of existing policy. These assertions do not claim multi-Circle support.
import {test} from "node:test";
import assert from "node:assert/strict";
import {authDestination, callbackUrl, resolveAuthLink} from "../lib/auth-flow.ts";

test("OAuth and linked-account routing preserve an explicit invitation for review", async () => {
  const next = "/onboarding?role=caregiver&invitation=fictional-valid-token";
  const callback = new URL(callbackUrl("http://localhost:3100", next));
  callback.searchParams.set("code", "fictional-pkce-code");
  const session = {user: {id: "existing-fictional-subject", email: "fictional@example.test"}};
  const result = await resolveAuthLink({
    exchangeCodeForSession: async () => ({data: {session}, error: null}),
    getUser: async () => ({data: {user: session.user}, error: null}),
  }, callback.toString());
  assert.equal(result.next, next);
  assert.equal(authDestination(false, result.next), next);
  assert.equal(authDestination(true, result.next), next);
});

test("linked accounts still skip ordinary onboarding and reject malformed invitation intent", () => {
  assert.equal(authDestination(true, "/onboarding"), "/dashboard");
  assert.equal(authDestination(true, "/onboarding?role=caregiver&invitation=bad%2Ftoken"), "/dashboard");
  assert.equal(authDestination(true, "https://other.example.test/onboarding?invitation=token"), "/dashboard");
});
