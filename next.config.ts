import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow an isolated build dir via env (e2e runs its own dev server in
  // parallel on a separate port so it can't clash with a local `pnpm dev`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default withSentryConfig(nextConfig, {
  // Source-map upload is env-driven: a no-op build-time unless SENTRY_ORG /
  // SENTRY_PROJECT / SENTRY_AUTH_TOKEN are set (in CI/Vercel).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Route Sentry events through our own domain to dodge ad-blockers.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
