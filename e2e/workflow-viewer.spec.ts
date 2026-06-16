import { expect, test } from "@playwright/test";

// Public workflow viewer (Story 3.1 + 3.2 / FR6) — SIGNED-OUT (the `chromium`
// project, no storageState). Drives the seeded published workflow fixture (seed.sql):
// id …00aa, owned by parintnk, 2 covered nodes (ChatGPT → Midjourney), 1 edge.
const PUBLISHED_ID = "00000000-0000-0000-0000-0000000000aa";

// React-Flow-only marker (the canvas renders Controls); the connector text is
// list-only. Used to prove which view is active without colliding with the app-shell
// nav lists. Tool names use { exact: true } because the list's sr-only step summary
// ("Step 1 of 2: ChatGPT, …") also contains the tool name (Playwright getByText is a
// substring match by default).
const CANVAS_MARKER = ".react-flow__controls";

test("desktop defaults to the canvas; a node expands; toggling to List shows the ordered steps", async ({
  page,
}) => {
  await page.goto(`/workflows/${PUBLISHED_ID}`);

  // Header is server-rendered (SEO/anon).
  await expect(
    page.getByRole("heading", { name: "Coffee shop brand kit" }),
  ).toBeVisible();

  // Trust row (Story 3.3) — read-only signals, SSR'd in the header. The seed fixture
  // has 0 votes / 0 forks / no parent → zero-states: neutral outcome, "Original by
  // creator", a neutral "Last verified … ago", and NO fork stat.
  await expect(page.getByText("Original by creator")).toBeVisible();
  // Seed sets last_verified_at = 14 days ago → deterministic, neutral (< 90d).
  await expect(page.getByText(/last verified 2 weeks ago/i)).toBeVisible();
  await expect(page.getByText(/be the first to try this/i)).toBeVisible();
  // The fork STAT ("Forked 230×") is omitted at 0 — scope to the number form so it
  // doesn't match the app-shell "Forked" nav link.
  await expect(page.getByText(/forked \d/i)).toHaveCount(0);
  await expect(page.getByText(/tools change fast/i)).toHaveCount(0);

  // Outcome vote (Story 4.1) — anon sees the control + a sign-in affordance and the
  // segments are disabled (voting is auth-gated).
  await expect(page.getByText(/did this work for you/i)).toBeVisible();
  await expect(page.getByText(/sign in to vote/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /tried & worked/i }),
  ).toBeDisabled();

  // ≥md (Playwright default 1280×720) promotes to the canvas after mount; the lazy
  // React Flow chunk renders both recipe-card nodes.
  await expect(page.locator(CANVAS_MARKER)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("ChatGPT", { exact: true })).toBeVisible();
  await expect(page.getByText("Midjourney", { exact: true })).toBeVisible();

  // Click the first node → its full card expands (AC2): purpose + the creator's real
  // sample output (the seeded text).
  await page.getByText("ChatGPT", { exact: true }).click();
  await expect(page.getByText("Set the visual direction first")).toBeVisible();
  await expect(
    page.getByText("Brand direction: warm, artisanal, minimalist."),
  ).toBeVisible();

  // Toggle to the list (the a11y primary view): the ordered step-list renders with
  // the source→target connector, and the canvas is gone.
  await page.getByRole("button", { name: "View as list" }).click();
  await expect(page.getByText(/leads to step 2/i)).toBeVisible();
  await expect(page.getByText("ChatGPT", { exact: true })).toBeVisible();
  await expect(page.getByText("Midjourney", { exact: true })).toBeVisible();
  await expect(page.locator(CANVAS_MARKER)).toHaveCount(0);
});

test("a phone defaults to the linear step-list, with a 'View as canvas' toggle (UX-DR25 / AC2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/workflows/${PUBLISHED_ID}`);

  // List is the default on phones — no canvas finger-trap. The step-list renders both
  // steps and the edge connector (AC1); the canvas is NOT auto-shown.
  await expect(page.getByText(/leads to step 2/i)).toBeVisible();
  await expect(page.getByText("ChatGPT", { exact: true })).toBeVisible();
  await expect(page.getByText("Midjourney", { exact: true })).toBeVisible();
  await expect(page.locator(CANVAS_MARKER)).toHaveCount(0);

  // The "View as canvas" toggle is present; switching opts into the spatial view.
  await page.getByRole("button", { name: "View as canvas" }).click();
  await expect(page.locator(CANVAS_MARKER)).toBeVisible({ timeout: 15_000 });
});

test("a nonexistent / draft workflow shows the graceful not-found state (AC3)", async ({
  page,
}) => {
  await page.goto("/workflows/11111111-1111-1111-1111-111111111111");
  await expect(page.getByText("This workflow isn’t available")).toBeVisible();
});
