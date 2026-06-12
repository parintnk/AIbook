import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Professions domain/service layer (DR-1). The only place profession SQL lives.
 * Community join/leave + feeds are Epic 7; this story ships reads + the
 * moderator check (the RLS seam later epics' mod actions reuse).
 */

export type Profession = Tables<"professions">;

/** All professions, ordered by name — for the profile picker + landing lists. */
export const listProfessions = cache(async (): Promise<Profession[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professions")
    .select("*")
    .order("name", { ascending: true });
  return data ?? [];
});

/** A single profession by its slug, or null. */
export async function getProfessionBySlug(
  slug: string,
): Promise<Profession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}

/**
 * Whether the current user is a moderator of `professionId` (via the
 * `is_profession_moderator` SQL helper that RLS policies also use). Used by
 * tests now and moderator tooling later (Story 7.3).
 */
export async function isProfessionModerator(
  professionId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc("is_profession_moderator", {
    uid: user.id,
    prof_id: professionId,
  });
  if (error) return false;
  return data === true;
}
