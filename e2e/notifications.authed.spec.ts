import { expect, test } from "@playwright/test";

// chromium-authed (the seeded @e2e session). The notifications bell opens its realtime panel
// (header + Live badge + settings footer) end-to-end for a signed-in user. Mark-read +
// route-to-source + the column-locked RLS are covered by the unit suite + notifications_mark_read_rls.sql;
// realtime delivery is best-effort in a browser test (the mocked channel-lifecycle unit test is the
// reliable AC1 guard) — this asserts the panel renders against a real Next + Supabase stack.

test("the notifications bell opens its panel", async ({ page }) => {
  await page.goto("/explore");

  await page.getByRole("button", { name: /notifications/i }).click();

  await expect(
    page.getByRole("heading", { name: "Notifications" }),
  ).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /notification settings/i }),
  ).toBeVisible();
});
