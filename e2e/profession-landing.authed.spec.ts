import { expect, test } from "@playwright/test";

// chromium-authed — e2e@example.com is seeded as a MODERATOR of ai-automation (auth.setup.ts, for the
// 4.3 reports queue). So the Story 7.3 role-gated mod affordances render on that community home, and
// ai-automation has 2 seeded pins → an editable, drag-reorderable "Start here". Members / anon get
// none of this (UX-DR21 — asserted in profession-landing.spec.ts).
test("a moderator sees the pin / edit / drag-reorder affordances (Story 7.3)", async ({
  page,
}) => {
  await page.goto("/communities/ai-automation");
  await expect(
    page.getByRole("heading", { name: /ai automation/i, level: 1 }),
  ).toBeVisible();

  // Mod-only curation affordances (the rail renders these only when isProfessionModerator).
  await expect(
    page.getByRole("button", { name: /pin a workflow/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /edit house rules/i }),
  ).toBeVisible();

  // The pinned canon is an editable sortable list → each row has a keyboard-operable drag handle.
  await expect(
    page.getByRole("button", { name: /^reorder/i }).first(),
  ).toBeVisible();
});
