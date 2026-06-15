import { expect, test } from "@playwright/test";

// Publish gate (Story 2.5, FR9/FR10 MOAT) against local Supabase, using the
// seeded session. Drives the linear List path (the canvas is the ≥md default) and
// adds a TEXT output (deterministic — avoids file-fixture flakiness). Asserts the
// client gate (disabled Publish + amber affordance) flips once every step has an
// output, then a real publish redirects to /workflows and the draft leaves the list.

test("blocks publish until every step has a sample output, then publishes", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());

  const draftTitle = `E2E publish draft ${Date.now()}`;
  const stepTitle = `E2E publish step ${Date.now()}`;

  // Create the draft.
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(draftTitle);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  // Open it and switch to the list surface.
  await page
    .locator("li")
    .filter({ hasText: draftTitle })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  // Generous timeout: the /edit route's first compile under parallel-worker load
  // can exceed the 5s default.
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/, { timeout: 15_000 });

  const publishBtn = page.getByRole("button", { name: "Publish", exact: true });

  // Zero nodes → Publish disabled with the "Add a step" hint.
  await expect(publishBtn).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Add a step to publish")).toBeVisible();

  await page.getByRole("button", { name: "List" }).click();

  // Add one step WITHOUT an output.
  await page.getByRole("button", { name: "+ Add step" }).first().click();
  await page.getByLabel("Step title").fill(stepTitle);
  await page.getByLabel("Tool *").fill("ChatGPT");
  await page.getByLabel("Prompt *").fill("Initial prompt");
  await page.getByLabel("Purpose *").fill("Initial purpose");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await expect(page.getByText(stepTitle)).toBeVisible();

  // One uncovered node → Publish still disabled + the amber card affordance shows.
  await expect(publishBtn).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Add a sample output to publish")).toBeVisible();
  await expect(
    page.getByText("1 step still needs a sample output"),
  ).toBeVisible();

  // Add a TEXT output via the NodeForm sheet.
  await page.getByRole("button", { name: /ChatGPT/ }).dblclick();
  await expect(page.getByText("Sample output", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /paste text instead/i }).click();
  await page
    .getByPlaceholder("Paste the text this step produced.")
    .fill("This is the produced sample output.");
  await page.getByRole("button", { name: "Save text", exact: true }).click();
  await expect(page.getByText("Sample output saved.")).toBeVisible();

  // Close the sheet (it overlays the header Publish button as a modal). Saving the
  // output already triggered a router.refresh, so the gate has reconverged.
  await page.keyboard.press("Escape");

  // The gate clears: the amber affordance is gone and Publish enables.
  await expect(page.getByText("Add a sample output to publish")).toHaveCount(0);
  await expect(publishBtn).toHaveAttribute("aria-disabled", "false");

  // Publish → redirect to /workflows + the "Published." flash + the draft is gone.
  await publishBtn.click();
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(page.getByText("Published.")).toBeVisible();
  await expect(page.locator("li").filter({ hasText: draftTitle })).toHaveCount(
    0,
  );
});
