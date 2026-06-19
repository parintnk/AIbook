import { NextResponse } from "next/server";
import { sanitizeNext } from "@/lib/auth/redirect";
import { persistPrimaryProfession } from "@/lib/onboarding-persist";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation callback (PKCE code flow). The provider redirects
 * here with a `?code=…`; we exchange it for a session (cookies set via
 * `@supabase/ssr`) and forward the user to their intended `next` destination.
 *
 * Resolves the deferred 1.2 note: this handler must run the session exchange
 * before any redirect logic. The middleware never redirects `/auth/*`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  // Provider returned an error (user cancelled consent, access_denied, …) —
  // surface its code rather than collapsing to the generic exchange failure.
  const providerError = searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(providerError)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Story 12.2: carry the pre-auth onboarding pick (`?profession=` in `next`) onto the new
      // profile. Best-effort + first-set-wins — never blocks the redirect.
      await persistPrimaryProfession(supabase, next);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed — bounce back to sign-in with an error flag.
  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
