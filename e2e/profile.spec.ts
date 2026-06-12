import { expect, test } from "@playwright/test";

test("unknown handle returns 404", async ({ page }) => {
  const res = await page.goto("/u/zzz_does_not_exist_999");
  expect(res?.status()).toBe(404);
});

test("an existing public profile renders read-only (anonymous)", async ({
  page,
}) => {
  // `parintnk` was backfilled from the seeded auth user (migration 1.4).
  await page.goto("/u/parintnk");
  await expect(page.getByText("@parintnk")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "AI Stack" }),
  ).toBeVisible();
});

test("editing requires auth — /settings/profile redirects to sign-in", async ({
  page,
}) => {
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fprofile/);
});
