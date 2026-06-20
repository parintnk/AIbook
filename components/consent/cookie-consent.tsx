"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Consent, getConsent, setConsent } from "@/lib/consent";

/**
 * The cookie-consent banner. Shows only until the visitor chooses (persisted in localStorage);
 * "Accept" turns on PostHog via the consent event the analytics provider listens for, "Decline"
 * keeps analytics off. Rendered after mount to avoid an SSR hydration flash.
 */
export function CookieConsent() {
  const [choice, setChoice] = useState<Consent | null | "loading">("loading");

  useEffect(() => {
    setChoice(getConsent());
  }, []);

  if (choice === "loading" || choice !== null) return null;

  function decide(value: Consent) {
    setConsent(value);
    setChoice(value);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="glass flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-border p-4 shadow-lg sm:flex-row sm:items-center">
        <p className="flex-1 text-muted-foreground text-sm">
          We use a privacy-friendly analytics cookie to understand how the
          cookbook is used. See our{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => decide("declined")}
          >
            Decline
          </Button>
          <Button type="button" size="sm" onClick={() => decide("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
