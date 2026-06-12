import { expect, test } from "@playwright/test";

// The founder profile (`parintnk`) has primary_profession = AI Automation (set
// during Story 1.5). The public profile renders it as a chip.
test("public profile renders the primary-profession chip", async ({ page }) => {
  await page.goto("/u/parintnk");
  await expect(page.getByText("AI Automation")).toBeVisible();
});
