import { expect, test } from "@playwright/test";

// Public workflow viewer (Story 3.1 / FR6) — SIGNED-OUT (the `chromium` project, no
// storageState). Drives the seeded published workflow fixture (seed.sql):
// id …00aa, owned by parintnk, 2 covered nodes (ChatGPT → Midjourney), 1 edge.
const PUBLISHED_ID = "00000000-0000-0000-0000-0000000000aa";

test("an anonymous visitor reads a published workflow on the canvas", async ({
  page,
}) => {
  await page.goto(`/workflows/${PUBLISHED_ID}`);

  // Header is server-rendered (SEO/anon).
  await expect(
    page.getByRole("heading", { name: "Coffee shop brand kit" }),
  ).toBeVisible();

  // The read-only canvas hydrates (dynamic ssr:false) and renders both recipe-card
  // nodes. Generous timeout for the lazy React Flow chunk.
  await expect(page.getByText("ChatGPT")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Midjourney")).toBeVisible();

  // Click the first node → its full card expands (AC2): the purpose AND the
  // creator's real sample output (the seeded text) both appear.
  await page.getByText("ChatGPT").click();
  await expect(page.getByText("Set the visual direction first")).toBeVisible();
  await expect(
    page.getByText("Brand direction: warm, artisanal, minimalist."),
  ).toBeVisible();
});

test("a nonexistent / draft workflow shows the graceful not-found state (AC3)", async ({
  page,
}) => {
  await page.goto("/workflows/11111111-1111-1111-1111-111111111111");
  await expect(page.getByText("This workflow isn’t available")).toBeVisible();
});
