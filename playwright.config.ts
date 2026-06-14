import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// e2e runs against a LOCAL Supabase (`pnpm supabase start`). Load web/.env.test
// into process.env (overriding web/.env.local's remote values) so the dev server
// + tests hit the local stack — auth works without captcha and never touches
// real data. The dev server runs on a dedicated port + build dir so it can't
// clash with a `pnpm dev` you already have open on :3000.
const envTest = path.resolve(__dirname, ".env.test");
if (fs.existsSync(envTest)) {
  for (const line of fs.readFileSync(envTest, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const storageState = path.resolve(__dirname, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cap workers so the single Next dev server isn't swamped compiling the heavy
  // React Flow editor route on-demand under parallel load (Story 2.3).
  workers: process.env.CI ? 1 : 2,
  // The canvas route is heavy to compile on first hit — give specs headroom.
  timeout: 45_000,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    // Signs in a seeded test user once and saves the session.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Public / signed-out specs (the default suite).
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /\.authed\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    // Signed-in specs — reuse the saved session.
    {
      name: "chromium-authed",
      testMatch: /\.authed\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Isolated build dir so this server doesn't fight a separate `pnpm dev`.
    env: { ...process.env, NEXT_DIST_DIR: ".next-e2e" },
  },
});
