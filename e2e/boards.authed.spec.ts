import { expect, test } from "@playwright/test";

// chromium-authed (the seeded e2e session). The …00ee published fixture ("Prompt chaining starter").
// Save is auth-gated; signed in, the affordance opens the board picker. Re-runs accumulate boards
// (names aren't unique) — the assertions don't depend on a clean board count.
const SRC = "00000000-0000-0000-0000-0000000000ee";

test("save a published workflow into a new board from the detail header", async ({
  page,
}) => {
  await page.goto(`/workflows/${SRC}`);
  await expect(
    page.getByRole("heading", { name: "Prompt chaining starter" }),
  ).toBeVisible();

  // The Save button is a ghost button beside Fork — signed in, it opens the picker (not a link).
  await page.getByRole("button", { name: /^saved?$/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Save to board", { exact: true }),
  ).toBeVisible();

  // Create a new board → it is saved into immediately (createBoardAndSave).
  await dialog.getByRole("button", { name: /create new board/i }).click();
  await dialog.getByPlaceholder("Board name").fill("My test board");
  await dialog.getByRole("button", { name: /create & save/i }).click();

  // The toast confirms the save; closing the picker leaves the Save button filled ("Saved").
  await expect(page.getByText(/saved to my test board/i)).toBeVisible();
  await dialog.getByRole("button", { name: /^done$/i }).click();
  await expect(page.getByRole("button", { name: /^saved$/i })).toBeVisible();
});

test("a feed-card savemark opens the board picker without navigating", async ({
  page,
}) => {
  await page.goto("/explore");
  const feed = page.getByTestId("trending-feed");
  await expect(feed).toBeVisible();

  // The savemark is a SIBLING overlay of the card's whole-card link → it must open the picker
  // and NOT navigate to the workflow detail.
  await feed
    .getByRole("button", { name: /save to board|saved — edit boards/i })
    .first()
    .click();

  await expect(
    page.getByRole("dialog").getByText("Save to board", { exact: true }),
  ).toBeVisible();
  expect(page.url()).toContain("/explore");
});
