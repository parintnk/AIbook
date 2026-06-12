"use client";

import { ThemeProvider } from "next-themes";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { type ReactNode, useEffect } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Client-side analytics. Env-gated: with no `NEXT_PUBLIC_POSTHOG_KEY` it is a
 * transparent pass-through (no PostHog, no network).
 */
function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Modern preset: history-based pageview capture for App Router soft navs.
      defaults: "2025-05-24",
    });
  }, []);

  if (!POSTHOG_KEY) return children;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}

/**
 * App-wide client providers: theme (next-themes, system default + persisted
 * toggle) composed with analytics.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <AnalyticsProvider>{children}</AnalyticsProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
