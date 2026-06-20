"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { type ReactNode, useEffect, useState } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { CookieConsent } from "@/components/consent/cookie-consent";
import { Toaster } from "@/components/ui/sonner";
import { CONSENT_EVENT, type Consent, getConsent } from "@/lib/consent";

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
 * Client-side analytics. DOUBLE-gated: with no `NEXT_PUBLIC_POSTHOG_KEY` it's a transparent
 * pass-through, and even with a key PostHog stays OFF until the visitor accepts cookies (the
 * CookieConsent banner). Consent is read on mount + listened for, so Accept turns it on without
 * a reload; Decline / no-choice means no PostHog and no network.
 */
function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<Consent | null>(null);

  useEffect(() => {
    setConsentState(getConsent());
    const onChange = (e: Event) =>
      setConsentState((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const enabled = Boolean(POSTHOG_KEY) && consent === "accepted";
  useEffect(() => {
    if (!enabled || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY as string, {
      api_host: POSTHOG_HOST,
      // Modern preset: history-based pageview capture for App Router soft navs.
      defaults: "2025-05-24",
    });
  }, [enabled]);

  const body = enabled ? (
    <PHProvider client={posthog}>{children}</PHProvider>
  ) : (
    children
  );
  return (
    <>
      {body}
      <CookieConsent />
    </>
  );
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
