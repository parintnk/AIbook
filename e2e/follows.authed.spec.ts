import { expect, test } from "@playwright/test";

// chromium-authed (the seeded @e2e session). Visits another user's profile (@devjun, not self) and
// toggles Follow optimistically; the follow persists across a reload. The count math + RLS are
// covered by the unit suite + follows_rls.sql — this asserts the UI toggle + persistence.

test("follow then unfollow a user, persisting across reload", async ({
  page,
}) => {
  await page.goto("/u/devjun");
  await expect(page.getByRole("heading", { name: "Jun" })).toBeVisible();

  const following = page.getByRole("button", { name: /^following$/i });
  const follow = page.getByRole("button", { name: /^follow$/i });

  // Normalize any leftover Following state from an interrupted prior run.
  if (await following.count()) {
    await following.first().click();
    await expect(follow.first()).toBeVisible();
  }

  await follow.first().click();
  await expect(following.first()).toBeVisible();

  // Persists across a reload (server truth, not just optimistic state).
  await page.reload();
  await expect(following.first()).toBeVisible();

  // Unfollow → back to Follow.
  await following.first().click();
  await expect(follow.first()).toBeVisible();
});

test("the Followers dialog lists the seeded followers", async ({ page }) => {
  await page.goto("/u/devjun");
  await page.getByRole("button", { name: /followers/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Followers", { exact: true })).toBeVisible();
  await expect(dialog.getByText("@priya")).toBeVisible();
});
