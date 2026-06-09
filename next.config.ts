import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
