import { expect, test } from "@playwright/test";

// AI Skeleton generator (Story 11.2): create a draft → enter a one-sentence goal → Generate → a 3–5
// node chain drops onto the draft. Uses the seeded session (chromium-authed; the `.authed.spec.ts`
// suffix routes it there). The intake is always visible in the editor surface (above the list/canvas
// toggle), so this never depends on the canvas. The assertion is generic (the publish gate now reports
// steps lacking a sample output) so it holds whether the stub (CI, no key) or real Gemini (local) ran.
test("generates a skeleton onto a draft", async ({ page }) => {
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(`E2E skeleton draft ${Date.now()}`);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  await page
    .locator("li")
    .filter({ hasText: "E2E skeleton draft" })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/, { timeout: 15_000 });

  // Enter a goal in the AI Skeleton intake + generate.
  await page.getByPlaceholder(/one sentence/).fill("a launch announcement");
  await page.getByRole("button", { name: /generate skeleton/i }).click();

  // The skeleton appended a multi-step chain → the FR10 publish gate now reports the new steps
  // (each generated node lacks a sample output). A fresh draft had 0 steps, so this confirms the drop.
  await expect(page.getByText(/still need a sample output/i)).toBeVisible({
    timeout: 20_000,
  });
});
