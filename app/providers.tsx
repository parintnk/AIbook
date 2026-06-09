"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { type ReactNode, useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Client-side analytics provider. Env-gated: with no `NEXT_PUBLIC_POSTHOG_KEY`
 * the provider is a transparent pass-through (no PostHog, no network).
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Modern preset: enables history-based pageview capture so App Router
      // soft navigations are tracked (not just full page loads).
      defaults: "2025-05-24",
    });
  }, []);

  if (!POSTHOG_KEY) return children;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
