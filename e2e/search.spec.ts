import { expect, test } from "@playwright/test";

// chromium (anon) — /search is public (FR2). Semantic ranking runs over the seeded stub embeddings
// (every published workflow is embedded in seed.sql, so a query returns the full set ranked by the
// id tiebreak). These assert the PLUMBING — query echo + aria-live count + ranked cards + a profession
// chip narrowing via a shareable URL — NOT semantic quality (the stub is deterministic, not semantic;
// real ranking validates once the prod Cron embeds with the real key).

test("a goal search renders ranked results with an announced count (anon)", async ({
  page,
}) => {
  await page.goto("/search?q=brand+kit");

  // the query echoes in the results header
  await expect(page.getByText("Workflows to")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "brand kit", exact: true }),
  ).toBeVisible();

  // the result count is announced (aria-live, FR2 / UX-DR10)
  await expect(page.getByText(/\d+ workflows? match this goal/)).toBeVisible();

  // ranked result cards render in the grid
  const results = page.getByTestId("search-results");
  await expect(results.getByRole("link").first()).toBeVisible();
});

test("a profession chip narrows the search via a shareable URL (anon)", async ({
  page,
}) => {
  await page.goto("/search?q=brand+kit");

  // exact: true → the filter chip, not a result card that names the profession.
  await page.getByRole("link", { name: "Web Developer", exact: true }).click();

  await expect(page).toHaveURL(/profession=web-developer/);
  await expect(page).toHaveURL(/q=brand\+kit/);
  // still a results surface (narrowed), never a dead end
  await expect(page.getByText(/workflows? match this goal/)).toBeVisible();
});
