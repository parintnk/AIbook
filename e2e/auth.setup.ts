import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Seeds a confirmed test user in the LOCAL Supabase, signs in through the real
// form, and saves the session so `*.authed.spec.ts` run authenticated. Runs
// against the local stack only (see .env.test / playwright.config.ts).
const TEST_EMAIL = "e2e@example.com";
// Meets the sign-up policy (len >= 8, upper, lower, digit).
const TEST_PASSWORD = "E2eTest1234";
const authFile = path.resolve(__dirname, ".auth/user.json");

setup("authenticate a seeded test user", async ({ page }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "e2e auth setup needs a local Supabase: run `pnpm supabase start` and create web/.env.test (see that file's header).",
    );
  }

  // Admin createUser bypasses captcha and confirms the email immediately, so the
  // setup is idempotent across runs (the profiles trigger also seeds a profile).
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error && !/already|registered|exists/i.test(error.message)) throw error;

  // Sign in through the real form so the @supabase/ssr cookies are written by
  // the app itself (no manual cookie construction). Local Supabase has no
  // captcha, so the form submits without a Turnstile token.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // A successful sign-in lands on the app shell with the account menu visible.
  await expect(
    page.getByRole("button", { name: /account menu/i }),
  ).toBeVisible();

  await page.context().storageState({ path: authFile });
});
