"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Consent, getConsent, setConsent } from "@/lib/consent";

/**
 * Analytics opt-in/out control (Settings → Privacy) — reads/writes the same consent the cookie
 * banner uses. Changing it fires the consent event the analytics provider listens for, so PostHog
 * turns on/off without a reload.
 */
export function AnalyticsConsent() {
  const [consent, setLocal] = useState<Consent | null | "loading">("loading");

  useEffect(() => {
    setLocal(getConsent());
  }, []);

  if (consent === "loading") return null;

  function choose(value: Consent) {
    setConsent(value);
    setLocal(value);
  }

  const on = consent === "accepted";
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-medium text-foreground text-sm">Product analytics</p>
        <p className="mt-1 text-muted-foreground text-xs">
          {on
            ? "On — a privacy-friendly cookie helps us see how the cookbook is used."
            : "Off — no analytics cookie is set."}
        </p>
      </div>
      <Button
        type="button"
        variant={on ? "outline" : "default"}
        size="sm"
        onClick={() => choose(on ? "declined" : "accepted")}
      >
        {on ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}
