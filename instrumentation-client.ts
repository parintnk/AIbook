import * as Sentry from "@sentry/nextjs";

// Env-gated: with no DSN, init is skipped and Sentry is a no-op (local dev).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
