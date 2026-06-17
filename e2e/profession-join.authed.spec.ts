import { expect, test } from "@playwright/test";

// chromium-authed — the signed-in test user is not a seeded member of any profession
// (only the founder + the feed-author fixtures d1/d2/d3 have memberships), so
// graphic-designer (founder-only) is a clean Join target. The test leaves at the end so
// it's idempotent across runs (the membership row would otherwise persist locally).
test("a signed-in user can join and then leave a profession", async ({
  page,
}) => {
  await page.goto("/communities/graphic-designer");

  // Idempotent start: a residual membership from a prior run would show "Joined" → leave first.
  const residual = page.getByRole("button", { name: "Joined", exact: true });
  if (await residual.isVisible().catch(() => false)) {
    await residual.click();
    await page.waitForLoadState("networkidle");
  }

  const joinBtn = page.getByRole("button", { name: "Join", exact: true });
  await expect(joinBtn).toBeVisible();
  await joinBtn.click();

  // Optimistic flip → "Joined" (the membership insert + member_count trigger are the truth).
  const joinedBtn = page.getByRole("button", { name: "Joined", exact: true });
  await expect(joinedBtn).toBeVisible();

  // Leave — reverts to "Join" AND cleans up the seeded-DB row for the next run. Wait for the
  // Server Action's revalidation to settle so the DELETE is committed before teardown (the
  // optimistic flip is instant; the server write trails it).
  await joinedBtn.click();
  await expect(
    page.getByRole("button", { name: "Join", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
});
