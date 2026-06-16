import { expect, test } from "@playwright/test";

// chromium-authed (the saved e2e session). Forks the …00ee published fixture ("Prompt chaining
// starter"), then opens /forked and verifies the fork appears with its "Forked from @x" lineage
// LINK + an Edit action (it's a draft fork); clicking the lineage link lands on the parent's
// detail. Forks …00ee — NOT …00aa (whose zero-fork the viewer spec asserts). Re-forking is allowed
// → the spec asserts the fork is PRESENT (not an exact count).
const SRC = "00000000-0000-0000-0000-0000000000ee";

test("a forked workflow appears on /forked with a 'Forked from @x' link + Edit", async ({
  page,
}) => {
  // Create a fork via the detail-page Fork button.
  await page.goto(`/workflows/${SRC}`);
  await page.getByRole("button", { name: /^fork$/i }).click();
  await page.waitForURL(/\/workflows\/[0-9a-f-]+\/edit/, { timeout: 15_000 });

  // My forks lists it.
  await page.goto("/forked");
  await expect(page.getByRole("heading", { name: /my forks/i })).toBeVisible();
  const card = page
    .getByRole("listitem")
    .filter({ hasText: "Prompt chaining starter" })
    .first();
  await expect(card).toBeVisible();
  // A draft fork → an Edit action.
  await expect(card.getByRole("link", { name: /^edit$/i })).toBeVisible();
  // The "Forked from @x" lineage link navigates to the parent (…00ee).
  const lineage = card.getByRole("link", { name: /forked from @/i });
  await expect(lineage).toBeVisible();
  await lineage.click();
  await expect(page).toHaveURL(new RegExp(SRC));
  await expect(
    page.getByRole("heading", { name: "Prompt chaining starter" }),
  ).toBeVisible();
});
