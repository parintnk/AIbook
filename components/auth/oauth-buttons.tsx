"use client";

import type { Provider } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { oauthSignInAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.56c2.08-1.92 3.27-4.74 3.27-8.04z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.26 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

/**
 * Social provider button(s). A tiny `<form>` posting to a server action
 * (progressive enhancement — works without client JS). Google only.
 */
export function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ProviderButton
        provider="google"
        label="Continue with Google"
        icon={<GoogleIcon />}
        next={next}
      />
    </div>
  );
}

function ProviderButton({
  provider,
  label,
  icon,
  next,
}: {
  provider: Provider;
  label: string;
  icon: ReactNode;
  next?: string;
}) {
  return (
    <form action={oauthSignInAction}>
      <input type="hidden" name="provider" value={provider} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="h-11 w-full gap-2.5 font-medium"
      >
        {icon}
        {label}
      </Button>
    </form>
  );
}
