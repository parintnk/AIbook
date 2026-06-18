import { expect, test } from "@playwright/test";

// Workflow Doctor (Story 11.3): create a draft → seed steps with the AI Skeleton → "Review before
// publish" → an ADVISORY per-node pass/flag review renders. Uses the seeded session (chromium-authed;
// the `.authed.spec.ts` suffix routes it there). Robust to stub (CI, no key) OR real Gemini (local,
// .env.local): the skeleton nodes have no sample output, so the deterministic FR10 `missing_output`
// req-flag fires on EVERY node regardless of what the AI returns → the review is always non-empty.
// Critically asserts the Doctor is advisory ONLY — it never blocks publish (only the FR10 gate does).
test("reviews a draft advisory-only and never blocks publish", async ({
  page,
}) => {
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(`E2E doctor draft ${Date.now()}`);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  await page
    .locator("li")
    .filter({ hasText: "E2E doctor draft" })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/, { timeout: 15_000 });

  // Seed ≥1 step via the AI Skeleton so the Doctor has nodes to review.
  await page.getByPlaceholder(/one sentence/).fill("a launch announcement");
  await page.getByRole("button", { name: /generate skeleton/i }).click();
  await expect(page.getByText(/still need a sample output/i)).toBeVisible({
    timeout: 20_000,
  });

  // Run the advisory review.
  await page.getByRole("button", { name: /review before publish/i }).click();

  // The review resolved (the score announces "reviewed just now"; the trigger re-labels).
  await expect(page.getByText(/reviewed just now/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: /re-run review/i }),
  ).toBeVisible();

  // Per-node verdicts render: every skeleton node lacks a sample → the deterministic FR10 req-flag
  // appears, each linking to its node. (Stub or real Gemini, this always holds.)
  await expect(
    page.getByText(/Missing required output/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /jump to node/i }).first(),
  ).toBeVisible();

  // Advisory ONLY: the footer states the contract, and the FR10 publish gate is INDEPENDENT — it
  // remains the only block (its "still need a sample output" hint persists; the Doctor adds none).
  await expect(page.getByText(/Advisory only/i)).toBeVisible();
  await expect(page.getByText(/still need a sample output/i)).toBeVisible();
});
