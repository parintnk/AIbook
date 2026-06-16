import { expect, test } from "@playwright/test";

// Runs in the "chromium-authed" project (the saved e2e session). Forks the …00ee published
// fixture ("Prompt chaining starter") into a new draft owned by the e2e user and lands in its
// editor. Forks …00ee — NOT …00aa, whose zero-fork trust state workflow-viewer.spec asserts.
// Re-forking is allowed (no one-fork guard), so the spec asserts the JUST-CREATED fork's editor,
// not a global count.
const SRC = "00000000-0000-0000-0000-0000000000ee";

test("fork a published workflow → land in the new draft's editor with the copied nodes", async ({
  page,
}) => {
  await page.goto(`/workflows/${SRC}`);
  await expect(
    page.getByRole("heading", { name: "Prompt chaining starter" }),
  ).toBeVisible();

  // Fork is a primary button, NOT optimistic — it waits for the server copy, then navigates
  // into the editor for the new draft.
  await page.getByRole("button", { name: /^fork$/i }).click();
  await page.waitForURL(/\/workflows\/[0-9a-f-]+\/edit/, { timeout: 15_000 });

  // A NEW draft id (not the source) → my own editable copy.
  expect(page.url()).not.toContain(SRC);

  // The copied node renders in the editor (proves the nodes/edges/outputs were cloned).
  await expect(page.getByText("ChatGPT", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
});
