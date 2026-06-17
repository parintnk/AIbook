import { expect, test } from "@playwright/test";

// chromium (anon). Saving is auth-gated — every Save affordance routes a signed-out visitor to
// sign-in, and /boards (the Story 8.2 management page) is a protected route.
const SRC = "00000000-0000-0000-0000-0000000000ee";

test("the detail Save affordance links anon to sign-in", async ({ page }) => {
  await page.goto(`/workflows/${SRC}`);
  await expect(
    page.getByRole("heading", { name: "Prompt chaining starter" }),
  ).toBeVisible();
  // Anon → Save is a link to sign-in (with a next back to this workflow), not the picker.
  await expect(page.getByRole("link", { name: /^save$/i })).toHaveAttribute(
    "href",
    `/sign-in?next=/workflows/${SRC}`,
  );
});

test("a feed-card savemark links anon to sign-in", async ({ page }) => {
  await page.goto("/explore");
  const feed = page.getByTestId("trending-feed");
  await feed
    .getByRole("link", { name: /sign in to save/i })
    .first()
    .click();
  await page.waitForURL(/\/sign-in/, { timeout: 15000 });
});

test("/boards is protected — anon is redirected to sign-in", async ({
  page,
}) => {
  await page.goto("/boards");
  await page.waitForURL(/\/sign-in/, { timeout: 15000 });
});
