import { listProfessions } from "@/lib/services/professions";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Persist the onboarding profession pick onto the user's profile at sign-up (Story 12.2 / AR3). The
 * selection rides in `next` as `?profession={slug}` (Story 12.1); resolve it to an id and set
 * `profiles.primary_profession_id` — but ONLY when it's still null (first-set-wins, so a returning
 * user re-logging in is never clobbered). Best-effort: a failed write must never strand a user
 * mid-login, so everything is swallowed.
 *
 * ponytail: a plain RLS-bound `.update()` is the whole mechanism — the column + the `authenticated`
 * column-grant + the `profiles_update_own` policy already exist (follows.sql / professions.sql), so
 * no RPC, no migration. The `.is(..., null)` filter is the first-set-wins guard (no read-then-write).
 */
export async function persistPrimaryProfession(
  supabase: ServerClient,
  next: string,
): Promise<void> {
  try {
    const slug = new URL(next, "http://x").searchParams.get("profession");
    if (!slug) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const id = (await listProfessions()).find((p) => p.slug === slug)?.id;
    if (!id) return;
    await supabase
      .from("profiles")
      .update({ primary_profession_id: id })
      .eq("id", user.id)
      .is("primary_profession_id", null);
  } catch {
    // ponytail: best-effort — persistence must never break the login redirect.
  }
}
