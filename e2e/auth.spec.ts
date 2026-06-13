import { expect, test } from "@playwright/test";

test("unauthenticated /account redirects to /sign-in with a next param", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
});

test("/sign-in renders the email form and provider buttons", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toBeVisible();
  // exact: the password field, not the "Show password" toggle button
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with apple/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});
