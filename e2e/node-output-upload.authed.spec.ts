import path from "node:path";
import { expect, test } from "@playwright/test";

// Per-node sample-output upload (Story 2.4) against the local Supabase + storage,
// using the seeded session from auth.setup.ts. Requires `[storage] enabled = true`
// in supabase/config.toml and a running local stack (the upload route 500s without
// storage). Exercises: validate-and-store a real PNG (thumbnail renders + persists),
// remove, and a magic-byte reject (a .txt forced through the picker).
const FIXTURES = path.join(__dirname, "fixtures");

test("upload, persist, and remove a node sample output", async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  const stepTitle = `E2E output step ${Date.now()}`;

  // Draft + one node, via the linear list (the canvas is the desktop default).
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(`E2E output draft ${Date.now()}`);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  await page
    .locator("li")
    .filter({ hasText: "E2E output draft" })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  // Generous timeout: /edit's first compile under parallel-worker load can exceed 5s.
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/, { timeout: 15_000 });
  await page.getByRole("button", { name: "List" }).click();

  await page.getByRole("button", { name: "+ Add step" }).first().click();
  await page.getByLabel("Step title").fill(stepTitle);
  await page.getByLabel("Tool *").fill("ChatGPT");
  await page.getByLabel("Prompt *").fill("Initial prompt");
  await page.getByLabel("Purpose *").fill("Initial purpose");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await expect(page.getByText(stepTitle)).toBeVisible();

  // Open the step in edit mode → the OutputUploader is in the sheet. (`exact`:
  // the publish bar + the blocked-card affordance also contain "sample output".)
  await page.getByRole("button", { name: /ChatGPT/ }).dblclick();
  await expect(page.getByText("Sample output", { exact: true })).toBeVisible();

  // Upload the real PNG via the (hidden) dropzone input.
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(FIXTURES, "sample-output.png"));

  // The validated image renders as a thumbnail preview (proves store + signed URL).
  await expect(page.getByAltText("Sample output")).toBeVisible({
    timeout: 15_000,
  });

  // Persists: reload shows the card's "Image attached" indicator. (Reload resets the
  // surface to the canvas default on ≥md → switch back to the list explicitly.)
  await page.reload();
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByText("Image attached")).toBeVisible();

  // Remove it → the step is now publish-blocked, so the indicator shows the
  // amber "Sample output required" copy (Story 2.5 swapped the neutral text).
  await page.getByRole("button", { name: /ChatGPT/ }).dblclick();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByText("Sample output required")).toBeVisible();
});

test("rejects a file whose bytes aren't a supported type", async ({ page }) => {
  const stepTitle = `E2E reject step ${Date.now()}`;

  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(`E2E reject draft ${Date.now()}`);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  await page
    .locator("li")
    .filter({ hasText: "E2E reject draft" })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  await page.getByRole("button", { name: "List" }).click();

  await page.getByRole("button", { name: "+ Add step" }).first().click();
  await page.getByLabel("Step title").fill(stepTitle);
  await page.getByLabel("Tool *").fill("ChatGPT");
  await page.getByLabel("Prompt *").fill("Initial prompt");
  await page.getByLabel("Purpose *").fill("Initial purpose");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await expect(page.getByText(stepTitle)).toBeVisible();

  await page.getByRole("button", { name: /ChatGPT/ }).dblclick();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(FIXTURES, "not-an-image.txt"));

  // A typed reject toast appears and no output is stored.
  await expect(
    page.getByText(/isn't supported|couldn't read that file/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByAltText("Sample output")).toHaveCount(0);
});
