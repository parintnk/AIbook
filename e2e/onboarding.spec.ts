import { expect, test } from "@playwright/test";

// Choose-your-path onboarding (Story 12.1 / FR1): an ANONYMOUS visitor (this is a PUBLIC `.spec.ts` →
// the no-session `chromium` project, NOT `.authed`). `/` redirects them into the pre-auth 3-step flow;
// sign-up is offered ONLY after step 3. The preview cards depend on seeded published workflows for the
// profession, so the assertions key off the always-present chrome (headings, sign-up, persist hint).
test("anon visitor walks the 3-step onboarding, sign-up only after step 3", async ({
  page,
}) => {
  // `/` sends an anon visitor into onboarding.
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);

  // Step 1 — the real professions; NO sign-up yet.
  await expect(
    page.getByRole("heading", { name: /what kind of work do you do/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toHaveCount(0);

  // Pick a profession → step 2 (goals).
  await page.getByRole("link", { name: /Graphic Designer/ }).click();
  await expect(page).toHaveURL(/profession=graphic-designer/);
  await expect(
    page.getByRole("heading", { name: /what are you hoping to get done/i }),
  ).toBeVisible();

  // Pick a goal → step 3 (preview + sign-up).
  await page.getByRole("link", { name: /Deliver client work faster/ }).click();
  await expect(page).toHaveURL(/goal=deliver-faster/);
  await expect(
    page.getByRole("heading", { name: /reach for most/i }),
  ).toBeVisible();

  // Sign-up is offered HERE (value-first), with the persist hint + a browse-first escape.
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
  await expect(page.getByText(/We'll remember/)).toBeVisible();
  await expect(page.getByRole("link", { name: /browse first/i })).toBeVisible();
});
