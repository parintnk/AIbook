"use server";

import type { Provider } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// OAuth providers the app actually supports — `provider` arrives from untrusted
// FormData, so it is allow-listed before reaching Supabase.
const SUPPORTED_OAUTH_PROVIDERS = ["google"] as const;
type SupportedProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Absolute origin for building OAuth/email redirect URLs (server-side). Prefers
 * the request's `origin`/`host`; falls back to `NEXT_PUBLIC_SITE_URL` for
 * header-less contexts so the redirect target is never a relative URL (Supabase
 * requires an absolute one).
 */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export async function signInWithOAuth(
  provider: Provider,
  next?: string,
): Promise<void> {
  const supabase = await createClient();
  const origin = await getOrigin();
  const safeNext = sanitizeNext(next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });
  if (error || !data?.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message ?? "oauth")}`);
  }
  redirect(data.url);
}

/**
 * Form-action wrapper for the provider buttons (works without client JS).
 * Reads provider + next from the submitted FormData; `provider` is allow-listed.
 */
export async function oauthSignInAction(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "");
  if (!isSupportedProvider(provider)) {
    redirect("/sign-in?error=oauth");
  }
  const next = formData.get("next");
  await signInWithOAuth(provider, typeof next === "string" ? next : undefined);
}
