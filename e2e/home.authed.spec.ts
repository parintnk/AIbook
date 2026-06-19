import { expect, test } from "@playwright/test";

// `/` now shows the placeholder splash ONLY to an AUTHENTICATED visitor — an anon
// visitor is redirected into the pre-auth onboarding (covered by onboarding.spec.ts,
// Story 12.1). This authed spec guards AC1's "authed `/` is unchanged + is never
// bounced to /welcome".
test("authenticated home stays on / and renders the placeholder hero + CTA", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "A cookbook for AI workflows" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Coming soon" })).toBeVisible();
});
