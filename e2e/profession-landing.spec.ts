import { expect, test } from "@playwright/test";

// chromium (anon) — /communities/[slug] is public (RLS-only published reads). Uses the
// seeded web-developer community: 3 published workflows (…0c0001 landing-page+copywriting,
// …0c0007 landing-page+pricing, …0c0013 design).
const SAAS_CARD = "00000000-0000-0000-0000-0000000c0001";

test("the community landing renders the hero, rail and feed (anon)", async ({
  page,
}) => {
  await page.goto("/communities/web-developer");

  // Hero — the profession name + a member-count pill.
  await expect(
    page.getByRole("heading", { name: "Web Developer", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/members?$/i).first()).toBeVisible();

  // Rail context cards (the 2-column "home").
  await expect(page.getByText("Mods")).toBeVisible();
  await expect(page.getByText("House rules")).toBeVisible();

  // Feed — the profession's published workflows (reuses the 6.1 card → detail link).
  const feed = page.getByTestId("trending-feed");
  const card = feed.getByRole("link", {
    name: /SaaS landing page from a one-line brief/i,
  });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", `/workflows/${SAAS_CARD}`);
});

test("a tag chip filters the feed via a shareable URL", async ({ page }) => {
  await page.goto("/communities/web-developer");

  // The tag-filter row (exact → the chip, not a card that mentions the word).
  await page
    .getByRole("navigation", { name: /filter by tag/i })
    .getByRole("link", { name: "Landing page", exact: true })
    .click();
  await expect(page).toHaveURL(/tag=landing-page/);

  const feed = page.getByTestId("trending-feed");
  // Landing-page-tagged work stays; the design-only "Component library audit" is gone.
  await expect(
    feed.getByRole("link", { name: /SaaS landing page/i }),
  ).toBeVisible();
  await expect(
    feed.getByRole("link", { name: /Component library audit/i }),
  ).toHaveCount(0);
});

test("an anon visitor's Join routes to sign-in", async ({ page }) => {
  await page.goto("/communities/web-developer");
  await expect(
    page.getByRole("link", { name: "Join", exact: true }),
  ).toHaveAttribute("href", "/sign-in?next=/communities/web-developer");
});

test("the Top sort tab re-ranks the feed via a shareable URL (Story 7.1)", async ({
  page,
}) => {
  await page.goto("/communities/web-developer");

  // Hot is the default active sort.
  await expect(
    page.getByRole("link", { name: "Hot", exact: true }),
  ).toHaveAttribute("aria-current", "true");

  // Switch to Top → the sort lands in the URL and the active tab moves off Hot.
  await page.getByRole("link", { name: "Top", exact: true }).click();
  await expect(page).toHaveURL(/sort=top/);
  await expect(
    page.getByRole("link", { name: "Top", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("link", { name: "Hot", exact: true }),
  ).not.toHaveAttribute("aria-current", "true");

  // The feed still renders the profession's published cards.
  await expect(
    page.getByTestId("trending-feed").locator("a[href^='/workflows/']").first(),
  ).toBeVisible();
});

test("an unknown profession slug 404s", async ({ page }) => {
  const res = await page.goto("/communities/not-a-real-profession");
  expect(res?.status()).toBe(404);
});

test("the communities index lists the professions", async ({ page }) => {
  await page.goto("/communities");
  await expect(
    page.getByRole("heading", { name: "Communities", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Web Developer/i }),
  ).toHaveAttribute("href", "/communities/web-developer");
});
