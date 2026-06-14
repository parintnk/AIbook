import { expect, test } from "@playwright/test";

// Recipe-card node lifecycle (create draft → add a node → it renders as a card →
// edit a field persists on reload → delete removes it) against the local Supabase,
// using the seeded session from auth.setup.ts. The `.authed.spec.ts` suffix routes
// this to the chromium-authed project (see playwright.config.ts).
test("add, edit, and delete a recipe-card node", async ({ page }) => {
  // Accept the delete confirm() dialog when it fires.
  page.on("dialog", (d) => d.accept());

  const stepTitle = `E2E step ${Date.now()}`;
  const edited = `${stepTitle} (edited)`;

  // Create a draft to hold the node.
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(`E2E nodes draft ${Date.now()}`);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  // Open the draft's editor.
  await page
    .locator("li")
    .filter({ hasText: "E2E nodes draft" })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/);

  // Add a step (the form opens in a Sheet).
  await page.getByRole("button", { name: "+ Add step" }).first().click();
  await page.getByLabel("Step title").fill(stepTitle);
  await page.getByLabel("Tool *").fill("ChatGPT");
  await page.getByLabel("Prompt *").fill("Initial prompt");
  await page.getByLabel("Purpose *").fill("Initial purpose");
  await page.getByRole("button", { name: "Add step", exact: true }).click();

  // The recipe card renders (step 1, tool chip, title).
  await expect(page.getByText("ChatGPT")).toBeVisible();
  await expect(page.getByText(stepTitle)).toBeVisible();

  // Edit the step title — double-click the card opens the editor prefilled.
  await page.getByRole("button", { name: /ChatGPT/ }).dblclick();
  await page.getByLabel("Step title").fill(edited);
  await page.getByRole("button", { name: "Save step", exact: true }).click();

  // Persists across a reload.
  await page.reload();
  await expect(page.getByText(edited)).toBeVisible();

  // Select the card (reveals Edit / Delete), then delete it.
  await page.getByRole("button", { name: /ChatGPT/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(edited)).toHaveCount(0);
});
