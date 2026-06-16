import { expect, test } from "@playwright/test";

// Outcome vote (Story 4.1 / FR11) — AUTHED (chromium-authed). Uses a DEDICATED
// published fixture (…00dd) so casting a vote doesn't pollute the …00aa anon-viewer
// zero-state assertions. Starts from 0 votes (db reset before the run).
const VOTE_ID = "00000000-0000-0000-0000-0000000000dd";

test("cast, persist, and change an outcome vote", async ({ page }) => {
  await page.goto(`/workflows/${VOTE_ID}`);
  await expect(page.getByText(/did this work for you/i)).toBeVisible();

  // Cast ✅ → the segment activates and its count ticks to 1 (optimistic → recompute).
  const worked = page.getByRole("button", { name: /tried & worked/i });
  await worked.click();
  await expect(worked).toHaveAttribute("aria-pressed", "true");
  await expect(worked).toContainText("1");

  // Persists across reload (getMyOutcomeVote restores the active segment).
  await page.reload();
  await expect(
    page.getByRole("button", { name: /tried & worked/i }),
  ).toHaveAttribute("aria-pressed", "true");

  // Change to ❌ → the new segment activates and ✅ deactivates (one changeable vote).
  const failed = page.getByRole("button", { name: /didn't work/i });
  await failed.click();
  await expect(failed).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /tried & worked/i }),
  ).toHaveAttribute("aria-pressed", "false");
});
