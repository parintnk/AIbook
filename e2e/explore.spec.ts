import { expect, test } from "@playwright/test";

// chromium (anon) — /explore is public (RLS-only published reads). Uses the seeded
// multi-profession feed (…0c0001 = "SaaS landing page", the top-forked card).
// NOTE: the top/newest cards also appear in the global "New this week" rail, so card
// assertions are scoped to the Trending grid (data-testid="trending-feed").
const TOP_CARD = "00000000-0000-0000-0000-0000000c0001";

test("the trending feed renders and a card opens its detail (anon)", async ({
  page,
}) => {
  await page.goto("/explore");

  await expect(
    page.getByRole("heading", { name: /trending across professions/i }),
  ).toBeVisible();

  const feed = page.getByTestId("trending-feed");
  const card = feed.getByRole("link", {
    name: /SaaS landing page from a one-line brief/i,
  });
  await expect(card).toBeVisible();
  // The WHOLE card is the click target → the workflow detail (UX-DR15).
  await expect(card).toHaveAttribute("href", `/workflows/${TOP_CARD}`);
  await card.click();
  await page.waitForURL(new RegExp(`/workflows/${TOP_CARD}`), {
    timeout: 15000,
  });
});

test("a profession chip filters the trending grid via a shareable URL", async ({
  page,
}) => {
  await page.goto("/explore");

  // exact: true → the chip, not the cards that mention "Web Developer".
  await page.getByRole("link", { name: "Web Developer", exact: true }).click();
  await expect(page).toHaveURL(/profession=web-developer/);

  // Within the trending grid: a web-developer workflow stays; a video one is gone.
  const feed = page.getByTestId("trending-feed");
  await expect(
    feed.getByRole("link", { name: /SaaS landing page/i }),
  ).toBeVisible();
  await expect(
    feed.getByRole("link", { name: /YouTube short from a blog post/i }),
  ).toHaveCount(0);
});

test("Load more appends the rest and reaches 'all caught up'", async ({
  page,
}) => {
  await page.goto("/explore");

  const feed = page.getByTestId("trending-feed");
  // A low-fork, older workflow sits on page 2 (not in the first 12, not in the rail).
  const page2Card = feed.getByRole("link", {
    name: /Case study from a customer interview/i,
  });
  await expect(page2Card).toHaveCount(0);

  const loadMore = page.getByRole("button", { name: /load more/i });
  await expect(loadMore).toBeVisible();
  await loadMore.click();

  await expect(page2Card).toBeVisible();
  await expect(page.getByText(/you're all caught up/i)).toBeVisible();
});

test("the New this week rail renders with a 'See all' link", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: /new this week/i }),
  ).toBeVisible();
  // "See all →" on the rail points at the full recency feed.
  await expect(
    page.getByRole("link", { name: /see all/i }).last(),
  ).toHaveAttribute("href", "/explore?sort=new");
});
