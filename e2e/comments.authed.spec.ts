import { expect, test } from "@playwright/test";

// Threaded comments (Story 4.2 / FR19) — AUTHED (chromium-authed). Uses a DEDICATED
// published fixture (…00ee) so comment volume doesn't pollute the …00aa (3.3) / …00dd
// (4.1) zero-state assertions. The thread starts empty (db reset before the run).
const CMT_ID = "00000000-0000-0000-0000-0000000000ee";

test("post a comment, reply one level, and like", async ({ page }) => {
  await page.goto(`/workflows/${CMT_ID}`);
  await expect(page.getByRole("heading", { name: /comments/i })).toBeVisible();

  // Post a top-level comment → it appears (optimistic → reconciled).
  const body = `Worked great — e2e ${Date.now()}`;
  await page.getByPlaceholder(/share what worked/i).fill(body);
  await page.getByRole("button", { name: /post/i }).click();
  await expect(page.getByText(body)).toBeVisible();

  // Reply to it → nests one level under the comment.
  const reply = `Nice, thanks — ${Date.now()}`;
  await page
    .getByRole("button", { name: /^reply$/i })
    .first()
    .click();
  await page.getByPlaceholder(/write a reply/i).fill(reply);
  await page.getByRole("button", { name: /post/i }).last().click();
  await expect(page.getByText(reply)).toBeVisible();

  // Like the comment → the segment flips to "Unlike" (aria-pressed) + the count shows.
  await page
    .getByRole("button", { name: /like comment/i })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /unlike comment/i }).first(),
  ).toBeVisible();
});
