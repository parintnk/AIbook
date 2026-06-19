import "server-only";
import { cache } from "react";
import { createClient } from "./server";

/**
 * The current authenticated user, DEDUPLICATED PER REQUEST.
 *
 * `supabase.auth.getUser()` is a network round-trip to the Supabase Auth server on
 * every call (it validates the JWT). A single page renders several services that each
 * resolved the user independently → 3-5 redundant Auth round-trips per request. Wrapping
 * the call in React `cache()` collapses them to ONE round-trip per request (cache is
 * keyed by the function + args; same fn, no args → one shared result).
 *
 * READ paths should use this. Write actions can keep calling `getUser()` directly — a
 * single action makes one call, so there's nothing to dedupe. Returns null when signed out.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
