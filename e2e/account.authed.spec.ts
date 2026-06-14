import { expect, test } from "@playwright/test";

// Runs in the "chromium-authed" project with the saved session from
// auth.setup.ts (see playwright.config.ts). Proves protected routes + the
// signed-in nav work — coverage that didn't exist before (deferred since 1.3).

test("reaches a protected route without redirecting to sign-in", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).not.toHaveURL(/\/sign-in/);
});

test("nav shows the account menu, not a Sign in button", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /account menu/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toHaveCount(0);
});
