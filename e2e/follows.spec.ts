import { expect, test } from "@playwright/test";

// chromium (anon). Profiles are public (FR22) — the hero + the public follow graph render for anyone,
// but Follow is auth-gated. Seeded (seed.sql): @devjun ("Jun") has 3 followers (priya/maris/founder)
// and follows 2, so the counts are non-zero and the lists render.

test("a public profile renders the hero + follower/following counts for anon", async ({
  page,
}) => {
  await page.goto("/u/devjun");
  await expect(page.getByRole("heading", { name: "Jun" })).toBeVisible();
  await expect(page.getByRole("button", { name: /followers/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /following/i })).toBeVisible();
});

test("the Follow button links anon to sign-in", async ({ page }) => {
  await page.goto("/u/devjun");
  await page
    .getByRole("link", { name: /^follow$/i })
    .first()
    .click();
  await page.waitForURL(/\/sign-in/, { timeout: 15000 });
});

test("the Followers list is publicly readable; a row's Follow links to sign-in", async ({
  page,
}) => {
  await page.goto("/u/devjun");
  await page.getByRole("button", { name: /followers/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Followers", { exact: true })).toBeVisible();
  // A seeded follower (priya follows devjun) renders, read-only — Follow-back is a sign-in link for anon.
  await expect(dialog.getByText("@priya")).toBeVisible();
  await dialog
    .getByRole("link", { name: /^follow$/i })
    .first()
    .click();
  await page.waitForURL(/\/sign-in/, { timeout: 15000 });
});
