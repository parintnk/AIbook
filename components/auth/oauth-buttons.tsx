"use client";

import type { Provider } from "@supabase/supabase-js";
import { oauthSignInAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/**
 * Social provider buttons. Each is a tiny `<form>` posting to a server action
 * (progressive enhancement — works without client JS). Apple ships here but
 * errors until its provider is configured in Supabase (Story 1.3 Task 1).
 */
export function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ProviderButton
        provider="google"
        label="Continue with Google"
        next={next}
      />
      <ProviderButton
        provider="apple"
        label="Continue with Apple"
        next={next}
      />
    </div>
  );
}

function ProviderButton({
  provider,
  label,
  next,
}: {
  provider: Provider;
  label: string;
  next?: string;
}) {
  return (
    <form action={oauthSignInAction}>
      <input type="hidden" name="provider" value={provider} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button type="submit" variant="outline" size="lg" className="h-11 w-full">
        {label}
      </Button>
    </form>
  );
}
