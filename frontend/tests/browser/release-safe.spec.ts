import {test, expect} from "./fixtures";
import {createOwner, installSession, open} from "./helpers";

test("unshared records are unavailable rather than a fabricated empty journey", async ({page}) => {
  const owner = await createOwner(page);
  const session = await (await page.request.get("http://127.0.0.1:18010/__fixture/session?fresh=true")).json();
  const invitation = await page.request.post("http://127.0.0.1:18010/api/auth/invitations", {
    headers: {Authorization: `Bearer ${owner.session.access_token}`}, data: {email: session.user.email},
  });
  expect(invitation.status()).toBe(201);
  const token = (await invitation.json()).token;
  const accepted = await page.request.post(`http://127.0.0.1:18010/api/auth/invitations/${token}/accept`, {
    headers: {Authorization: `Bearer ${session.access_token}`},
  });
  expect(accepted.status()).toBe(200);
  await installSession(page, session);
  await open(page, "/dashboard");
  const pulse = page.getByRole("region", {name: "Care Pulse", exact: true});
  await expect(pulse.getByRole("alert")).toHaveText("Tasks are unavailable or not shared.");
  await expect(pulse.getByTestId("pulse-overdue")).toHaveCount(0);
  await expect(pulse.getByTestId("pulse-waiting")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Your care journey starts here");
  await page.reload();
  await expect(pulse.getByRole("alert")).toHaveText("Tasks are unavailable or not shared.");
  await expect(pulse.getByTestId("pulse-overdue")).toHaveCount(0);
  await expect(pulse.getByTestId("pulse-waiting")).toHaveCount(0);
});

test("Care Circle refresh reloads current invitations without creating records", async ({page}) => {
  const owner = await createOwner(page);
  await installSession(page, owner.session);
  await open(page, "/care-circle");
  await expect(page.getByText("No pending invitations.", {exact: true})).toBeVisible();
  const created = await page.request.post("http://127.0.0.1:18010/api/auth/invitations", {
    headers: {Authorization: `Bearer ${owner.session.access_token}`},
    data: {email: "fictional-refresh@example.test", name: "Fictional Refresh Recipient"},
  });
  expect(created.status()).toBe(201);
  let writes = 0;
  page.on("request", request => {if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/")) writes++;});
  await page.getByRole("button", {name: "Refresh Care Circle", exact: true}).click();
  await expect(page.getByText("Fictional Refresh Recipient", {exact: true})).toBeVisible();
  await expect(page.getByRole("status").filter({hasText: "Care Circle refreshed"})).toBeVisible();
  expect(writes).toBe(0);
});
