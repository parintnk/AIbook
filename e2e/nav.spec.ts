import { expect, test } from "@playwright/test";

test("the app nav renders on home with the 4 primary links", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "idea — home" })).toBeVisible();
  for (const label of ["Explore", "Communities", "Forked", "Saved"]) {
    await expect(
      page.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  }
});

test("clicking Explore navigates to its stub", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
});

test("auth pages render without the app nav", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("link", { name: "idea — home" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore", exact: true }),
  ).toHaveCount(0);
});

test("phone viewport shows the bottom tab bar and hides desktop links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Communities", exact: true }),
  ).toBeHidden();
});
