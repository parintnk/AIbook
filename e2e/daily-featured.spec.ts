import { expect, test } from "@playwright/test";

// chromium (anon) — the Workflow of the Day hero (Story 6.3 / FR5). The seed curates a
// feature for current_date across a few professions; the hero shows the most recent on
// /explore and the profession's own on its community page. Assertions are scoped to the
// hero region (aria-label) so they never collide with the trending-grid card links.

test("the Workflow of the Day hero renders on Explore and opens the workflow (anon)", async ({
  page,
}) => {
  await page.goto("/explore");

  const hero = page.getByRole("region", { name: /workflow of the day/i });
  await expect(hero).toBeVisible();
  await expect(hero.getByText(/workflow of the day/i)).toBeVisible();

  const open = hero.getByRole("link", { name: /open workflow/i });
  await expect(open).toBeVisible();
  await expect(open).toHaveAttribute("href", /^\/workflows\//);
  await open.click();
  await page.waitForURL(/\/workflows\//, { timeout: 15000 });
});

test("a profession community page shows its Workflow of the Day (anon)", async ({
  page,
}) => {
  // graphic-designer carries a seeded current_date feature.
  await page.goto("/communities/graphic-designer");

  const hero = page.getByRole("region", { name: /workflow of the day/i });
  await expect(hero).toBeVisible();
  await expect(
    hero.getByRole("link", { name: /open workflow/i }),
  ).toBeVisible();
});
