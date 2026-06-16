import { expect, test } from "@playwright/test";

// chromium (anon) — the lineage tree is public for a PUBLISHED workflow (Story 5.3 / FR16 / Q4).
// Uses the seeded deterministic lineage: …00fa (origin) → …00fb (pastel fork) → …00fc (matcha kit).
const ORIGIN = "00000000-0000-0000-0000-0000000000fa";
const GRANDCHILD = "00000000-0000-0000-0000-0000000000fc";

test("the lineage tree renders the fork family (anon · public)", async ({
  page,
}) => {
  await page.goto(`/workflows/${ORIGIN}/lineage`);

  // Public — no sign-in redirect for a published workflow's lineage.
  await expect(page).toHaveURL(new RegExp(`${ORIGIN}/lineage`));
  await expect(page.getByRole("heading", { name: /Lineage ·/i })).toBeVisible();

  // ≥md auto-promotes to the graph after mount; wait for that to settle, then switch to the
  // deterministic indented list (the SSR a11y primary) so the assertions aren't React-Flow-timing
  // dependent. (Clicking before the promote effect runs would be overridden back to graph.)
  await expect(page.getByRole("button", { name: "Graph" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "List" }).click();

  // The whole chain is visible, root tagged "Origin".
  await expect(
    page.getByRole("link", { name: "Brand kit — origin recipe" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Café rebrand — pastel fork" }),
  ).toBeVisible();
  const grandchild = page.getByRole("link", { name: "Matcha café kit" });
  await expect(grandchild).toBeVisible();
  // The root is tagged "Origin" (exact — avoid matching "1 origin" / "…origin recipe").
  await expect(page.getByText("Origin", { exact: true })).toBeVisible();

  // A node links through to its workflow detail.
  await grandchild.click();
  await expect(page).toHaveURL(new RegExp(GRANDCHILD));
});

test("the trust row 'View lineage' entry opens the tree", async ({ page }) => {
  await page.goto(`/workflows/${ORIGIN}`);
  await page.getByRole("link", { name: /view lineage/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ORIGIN}/lineage`));
});
