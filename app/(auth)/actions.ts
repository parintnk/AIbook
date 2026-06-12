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

// Don't leak which field was wrong (email-enumeration / credential probing).
const GENERIC_CREDENTIALS_ERROR =
  "Incorrect email or password. Please try again.";

/** Absolute origin for building OAuth/email redirect URLs (server-side). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  return host ? `https://${host}` : "";
}

export async function signInWithEmail(
  values: { email: string; password: string },
  next?: string,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { error: GENERIC_CREDENTIALS_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: GENERIC_CREDENTIALS_ERROR };

  revalidatePath("/", "layout");
  redirect(sanitizeNext(next));
}

export async function signUpWithEmail(
  values: { email: string; password: string },
  next?: string,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error: "Enter a valid email and a password of at least 8 characters.",
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
    },
  });
  if (error) return { error: error.message };

  // Email-confirmation ON → no session yet; prompt the user to check inbox.
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
 * Reads provider + next from the submitted FormData.
 */
export async function oauthSignInAction(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  const next = formData.get("next");
  await signInWithOAuth(provider, typeof next === "string" ? next : undefined);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
