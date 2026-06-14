import { expect, test } from "@playwright/test";

// `parintnk` (seeded by supabase/seed.sql for local e2e) has
// primary_profession = AI Automation; the public profile renders it as a chip.
test("public profile renders the primary-profession chip", async ({ page }) => {
  await page.goto("/u/parintnk");
  await expect(page.getByText("AI Automation")).toBeVisible();
});
