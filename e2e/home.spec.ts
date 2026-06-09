import { expect, test } from "@playwright/test";

test("home page renders the placeholder hero and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A cookbook for AI workflows" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Coming soon" })).toBeVisible();
});
