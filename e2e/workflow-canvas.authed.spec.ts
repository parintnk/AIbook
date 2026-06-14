import { expect, test } from "@playwright/test";

// React Flow editor lifecycle against the local Supabase + seeded session. Per the
// story's pragmatic strategy we drive mutations through the stable DOM form path
// (not flaky pixel handle-drags) and assert the canvas RENDERS + persists the graph.
// `.authed.spec.ts` → chromium-authed project.
test("canvas renders the graph; add + delete persist across reload", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept()); // delete confirm()

  const title = `E2E canvas ${Date.now()}`;

  // Create a draft.
  await page.goto("/workflows/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Profession").selectOption({ index: 1 });
  await page.getByRole("button", { name: /create draft/i }).click();
  await expect(page).toHaveURL(/\/workflows$/);

  // Open its editor.
  await page
    .locator("li")
    .filter({ hasText: title })
    .getByRole("link", { name: /edit/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/workflows\/.+\/edit/);

  // Add two steps via the List view (the stable DOM path).
  await page.getByRole("button", { name: "List" }).click();
  for (const tool of ["ChatGPT", "Midjourney"]) {
    await page.getByRole("button", { name: "+ Add step" }).first().click();
    await page.getByLabel("Tool *").fill(tool);
    await page.getByLabel("Prompt *").fill(`${tool} prompt`);
    await page.getByLabel("Purpose *").fill(`${tool} purpose`);
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await expect(page.getByText(tool, { exact: true })).toBeVisible();
  }

  // Switch to the canvas → both nodes render as React Flow nodes.
  await page.getByRole("button", { name: "Canvas" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  // Add a third step from the canvas (exercises the canvas add + chain + refresh).
  await page.getByRole("button", { name: "+ Add step" }).click();
  await page.getByLabel("Tool *").fill("Recraft");
  await page.getByLabel("Prompt *").fill("Recraft prompt");
  await page.getByLabel("Purpose *").fill("Recraft purpose");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  // Persists across a reload (canvas is the desktop default).
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  // Delete one via the List view, then the canvas reflects 2.
  await page.getByRole("button", { name: "List" }).click();
  await page
    .getByRole("button", { name: /Midjourney/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Midjourney", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Canvas" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});
