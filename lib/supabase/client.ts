import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase client for Client Components (browser runtime).
 *
 * Throws if the public env is missing so a misconfiguration surfaces clearly at
 * the call site instead of failing opaquely on the first auth request.
 * (Deferred from the Story 1.2 review.)
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase browser client: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.",
    );
  }
  return createBrowserClient<Database>(url, key);
}
