import { expect, test } from "@playwright/test";

// Full draft lifecycle (create → list → edit → delete) against the local
// Supabase, using the seeded session from auth.setup.ts. The `.authed.spec.ts`
// suffix routes this to the chromium-authed project (see playwright.config.ts).
test("create, edit, and delete a workflow draft", async ({ page }) => {
  // Accept the delete confirm() dialog when it fires.
  page.on("dialog", (d) => d.accept());

  const title = `E2E draft ${Date.now()}`;
  const edited = `${title} (edited)`;

  // Create
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("Created by e2e.");
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();

  // Redirected to the workspace; the new draft is listed.
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // Edit its title.
  await page
    .locator("li", { hasText: title })
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/);
  await page.getByLabel("Title").fill(edited);
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByText(edited, { exact: true })).toBeVisible();

  // Delete it (confirm auto-accepted above).
  await page
    .locator("li", { hasText: edited })
    .getByRole("button", { name: /delete/i })
    .click();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
});
