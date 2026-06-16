import { expect, test } from "@playwright/test";

// Runs in the "chromium-authed" project (the saved session from auth.setup.ts, which also
// makes the e2e user a moderator of ai-automation). Reports the …00ee fixture workflow, then
// reviews + resolves it in the /admin/reports queue. Idempotent across re-runs (a prior open
// report surfaces the "already reported" toast; the Resolve at the end clears the queue row).
const WF_ID = "00000000-0000-0000-0000-0000000000ee";

test("report a workflow, then review and resolve it in the moderator queue", async ({
  page,
}) => {
  await page.goto(`/workflows/${WF_ID}`);
  await expect(
    page.getByRole("heading", { name: "Prompt chaining starter" }),
  ).toBeVisible();

  // Open the workflow overflow (•••) in the header → Report.
  await page
    .getByRole("button", { name: /more actions/i })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /report/i }).click();

  // The report dialog: pick a reason, submit.
  await expect(page.getByText(/report this workflow/i)).toBeVisible();
  await page.getByRole("radio", { name: "Spam or self-promo" }).check();
  await page.getByRole("button", { name: /submit report/i }).click();

  // A fresh confirmation, or the "already reported" soft-success on a re-run.
  await expect(
    page.getByText(/moderator will review|already reported/i),
  ).toBeVisible();

  // The moderator queue shows the report; resolve it (Dismiss).
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: /^reports$/i })).toBeVisible();
  const card = page
    .getByRole("listitem")
    .filter({ hasText: "Prompt chaining starter" })
    .first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /^resolve$/i }).click();
  await expect(page.getByText(/report resolved/i)).toBeVisible();
});
