import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * A cookie-free, session-less Supabase client for PUBLIC reads (RLS `using(true)` seed
 * data — professions, tags). Unlike the SSR `createClient()` it never touches `cookies()`,
 * so it is SAFE to call inside `unstable_cache`/`use cache` (which forbid request data).
 * Anon publishable key → RLS-enforced, anon-visible rows only. Never use it for per-user
 * or write paths — those need the cookie-bound SSR client.
 */
export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  );
}
