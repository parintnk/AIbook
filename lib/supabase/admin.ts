import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client — BYPASSES RLS. SERVER-ONLY (the secret key must never reach the
 * browser; `server-only` makes a client import a build error). Used exclusively by the Story 10.1
 * embeddings background job, which writes `workflow_embeddings` for ALL published workflows with no
 * user session (so the RLS-bound `server.ts`/`client.ts` can't reach it). Never call this from a
 * request path that serves a user — it has unrestricted DB access.
 *
 * Throws if the env is missing so a misconfiguration surfaces at the call site (the Story 1.2 pattern).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
