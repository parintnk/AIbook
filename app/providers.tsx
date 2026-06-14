"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { type ReactNode, useEffect } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";

// TanStack Query (DR-5) — server/async cache + optimistic updates for the Story
// 2.3 canvas. A fresh client per server request; one reused client in the browser
// (the standard App Router singleton guard). staleTime keeps RSC-seeded data from
// refetching immediately.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  });
}
let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

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
        <QueryClientProvider client={getQueryClient()}>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </QueryClientProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
