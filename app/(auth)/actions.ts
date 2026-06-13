"use server";

import type { Provider } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import {
  type AuthFormState,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

// Don't leak which field/account was wrong (email-enumeration / credential
// probing) — sign-in AND sign-up both return a non-distinguishing message.
const GENERIC_CREDENTIALS_ERROR =
  "Incorrect email or password. Please try again.";
const GENERIC_SIGNUP_ERROR = "Could not create your account. Please try again.";

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

export async function signInWithEmail(
  values: { email: string; password: string },
  next?: string,
  captchaToken?: string,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { error: GENERIC_CREDENTIALS_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken },
  });
  if (error) return { error: GENERIC_CREDENTIALS_ERROR };

  revalidatePath("/", "layout");
  redirect(sanitizeNext(next));
}

export async function signUpWithEmail(
  values: { email: string; password: string; confirmPassword: string },
  next?: string,
  captchaToken?: string,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error: "Enter a valid email and a password that meets the requirements.",
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const safeNext = sanitizeNext(next);
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      captchaToken,
    },
  });
  // Generic message — Supabase's raw error (e.g. "User already registered")
  // would enable email enumeration.
  if (error) return { error: GENERIC_SIGNUP_ERROR };

  // Email-confirmation ON → no session yet; prompt the user to check inbox.
  // (For an already-registered email Supabase also returns no session and no
  // error, so the confirmation copy links back to sign-in.)
  if (!data.session) return { needsEmailConfirmation: true };

  revalidatePath("/", "layout");
  redirect(safeNext);
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
