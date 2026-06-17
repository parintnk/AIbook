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

// Story 8.2 — the public board permalink + follow surface. Seeded boards (seed.sql): a public
// "Brand kit starters" + a private "Private drafts", both owned by the founder (not the e2e user).
const PUBLIC_BOARD = "00000000-0000-0000-0000-0000000b0001";
const PRIVATE_BOARD = "00000000-0000-0000-0000-0000000b0002";

test("a public board is readable by anon; Follow routes to sign-in", async ({
  page,
}) => {
  await page.goto(`/boards/${PUBLIC_BOARD}`);
  await expect(page.getByText("Brand kit starters")).toBeVisible();
  // The board's saved items render as read-only feed cards.
  await expect(
    page.getByText("Cohesive 24-icon set in one style pass"),
  ).toBeVisible();
  // Follow is a link to sign-in for anon — no follow happens until they return.
  await page.getByRole("link", { name: /^follow$/i }).click();
  await page.waitForURL(/\/sign-in/, { timeout: 15000 });
});

test("a private board is not found for a non-owner", async ({ page }) => {
  const res = await page.goto(`/boards/${PRIVATE_BOARD}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Private drafts")).toHaveCount(0);
});
