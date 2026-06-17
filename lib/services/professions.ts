import "server-only";
import { cache } from "react";
import { houseRulesSchema } from "@/lib/profession-rules";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Professions domain/service layer (DR-1). The only place profession SQL lives.
 * Story 1.5 shipped reads + the moderator check; Story 6.2 adds the member
 * join/leave + the moderator roster for the profession landing page. Community
 * FEEDS (hot/new/top) + mod tooling stay Epic 7.
 */

export type Profession = Tables<"professions">;

/** Per-profession role (`member` | `verified_pro` | `moderator`). */
export type ProfessionRole = Tables<"profession_members">["role"];

export type MembershipResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "not_found" | "db_error" };

/** A moderator / verified-pro of a profession, for the community rail's Mods card. */
export type ProfessionMod = {
  profileId: string;
  role: ProfessionRole;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/** All professions, ordered by name — for the profile picker + landing lists. */
export const listProfessions = cache(async (): Promise<Profession[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professions")
    .select("*")
    .order("name", { ascending: true });
  return data ?? [];
});

/** A single profession by its slug, or null. `cache()`-wrapped so a page + its
 * `generateMetadata` (Story 6.2) share one query. */
export const getProfessionBySlug = cache(
  async (slug: string): Promise<Profession | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("professions")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return data ?? null;
  },
);

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
  if (error) {
    // Fail closed, but surface the failure so a transient error isn't silently
    // indistinguishable from a real "not a moderator" denial (load-bearing in 7.3).
    console.error("is_profession_moderator RPC failed:", error.message);
    return false;
  }
  return data === true;
}

/**
 * The current user's membership in `professionId`, or null (signed-out / not a member).
 * Read server-side and passed down as `isMember` so the Join control renders without a
 * client probe (profession_members is public-select, so prefer not widening that surface).
 */
export async function getMyMembership(
  professionId: string,
): Promise<{ role: ProfessionRole } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profession_members")
    .select("role")
    .eq("profile_id", user.id)
    .eq("profession_id", professionId)
    .maybeSingle();
  return data ? { role: (data as { role: ProfessionRole }).role } : null;
}

/**
 * Join a profession as a plain `member` (Story 6.2 / FR18). A direct RLS-bound insert —
 * the self-join policy (`auth.uid() = profile_id and role = 'member'`) is the guard, and
 * the `sync_member_count()` trigger maintains `member_count` (never written here). A
 * `23505` (already a member) is a no-op success (idempotent), matching the conflict-code
 * convention used elsewhere.
 */
export async function joinProfession(
  professionId: string,
): Promise<MembershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.from("profession_members").insert({
    profile_id: user.id,
    profession_id: professionId,
    role: "member",
  });
  if (error) {
    if (error.code === "23505") return { ok: true }; // already a member — idempotent
    return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/**
 * Leave a profession (self-leave). The RLS policy only permits deleting your OWN
 * `member` row — a moderator / verified_pro can't self-leave, so their delete matches
 * zero rows (no error). `.select().maybeSingle()` turns that zero-row delete into a
 * typed `not_found` so the UI never shows a false "Left" (the deleteDraft pattern).
 */
export async function leaveProfession(
  professionId: string,
): Promise<MembershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("profession_members")
    .delete()
    .eq("profile_id", user.id)
    .eq("profession_id", professionId)
    .select("profile_id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * A profession's moderators + verified pros (public read) for the community rail's
 * Mods card. The founder is a moderator of every profession (the 1.5 seed), so this is
 * non-empty for all professions in v1. Ordered moderators first, then verified pros.
 */
export async function listProfessionMods(
  professionId: string,
): Promise<ProfessionMod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profession_members")
    .select(
      "profile_id, role, profile:profiles!profession_members_profile_id_fkey(handle, display_name, avatar_url)",
    )
    .eq("profession_id", professionId)
    .in("role", ["moderator", "verified_pro"])
    // Enum sorts by definition order (member < verified_pro < moderator), so DESC
    // lists moderators first; joined_at is the stable tiebreak.
    .order("role", { ascending: false })
    .order("joined_at", { ascending: true });
  const rows = (data ?? []) as Array<{
    profile_id: string;
    role: ProfessionRole;
    profile: {
      handle: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
  return rows.map((r) => ({
    profileId: r.profile_id,
    role: r.role,
    handle: r.profile?.handle ?? null,
    displayName: r.profile?.display_name ?? null,
    avatarUrl: r.profile?.avatar_url ?? null,
  }));
}

// ── Story 7.2 — house rules + pinned canon ──────────────────────────────────

/** A pinned "Start here" canon entry (Story 7.2) — the workflow id + title for the rail. */
export type ProfessionPin = { id: string; title: string };

/**
 * A profession's mod-curated "Start here" pinned canon (Story 7.2 / FR17), ordered by `position`.
 * RLS-only public read (no auth gate, like `listProfessionMods`). The workflow embed re-asserts
 * `status = 'published'` via an INNER join, so a pinned draft / deleted / unpublished workflow is
 * SKIPPED (never a broken rail link — the 6.3 defensive pattern). Replaces the 6.2 interim
 * most-forked proxy; an empty result → the rail omits the "Start here" card (no empty stub).
 */
export async function listProfessionPins(
  professionId: string,
): Promise<ProfessionPin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profession_pins")
    .select(
      "position, created_at, workflow:workflows!profession_pins_workflow_id_fkey!inner(id, title, status)",
    )
    .eq("profession_id", professionId)
    .eq("workflow.status", "published")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    // Final deterministic tiebreak: `position` is non-unique and same-transaction
    // pins share an identical (txn-fixed) `created_at`, so the pin `id` keeps the
    // numbered "Start here" order stable across requests (matches the migration's
    // "ties break by id" contract).
    .order("id", { ascending: true });
  const rows = (data ?? []) as Array<{
    workflow: { id: string; title: string; status: string } | null;
  }>;
  return (
    rows
      .map((r) => r.workflow)
      .filter(
        (w): w is { id: string; title: string; status: string } => w != null,
      )
      // Defense-in-depth (7.3): published-ness is enforced by the `!inner` embed + the `.eq` above;
      // re-assert it in JS so a future refactor that drops `!inner` can't silently leak drafts.
      .filter((w) => w.status === "published")
      .map((w) => ({ id: w.id, title: w.title }))
  );
}

/** A community house rule (Story 7.2) — a short titled norm rendered in the rail. */
export type HouseRule = { title: string; body: string };

/** The 3 universal platform norms (DESIGN.md) — the fallback when a profession sets no `rules`. */
export const DEFAULT_HOUSE_RULES: HouseRule[] = [
  {
    title: "Show real output.",
    body: "Every recipe needs a sample to publish.",
  },
  { title: "Credit your fork.", body: "Keep lineage intact when you remix." },
  {
    title: "Vote honestly.",
    body: "Worked / tweaks / didn't — it helps everyone.",
  },
];

/**
 * Parse a profession's `rules` jsonb (Story 7.2) into renderable house rules. Returns the
 * per-profession rules when present + well-formed, else the 3 universal defaults (so every
 * community home always shows house rules). Defensive: `rules` is `Json`, so it validates each
 * element is `{ title, body }` strings; an empty array / null / malformed shape → defaults.
 */
export function parseHouseRules(rules: Profession["rules"]): HouseRule[] {
  if (!Array.isArray(rules)) return DEFAULT_HOUSE_RULES;
  const parsed = rules.filter(
    (r): r is HouseRule =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as Record<string, unknown>).title === "string" &&
      typeof (r as Record<string, unknown>).body === "string",
  );
  return parsed.length > 0 ? parsed : DEFAULT_HOUSE_RULES;
}

// ── Story 7.3 — moderator mutations (RLS-gated; called by the rail's mod UI via Server Actions) ──
// Every write is gated by the EXISTING mod RLS (`is_profession_moderator`): the 7.2 profession_pins
// insert/update/delete policies + column-lock (after 7.3 harden: insert(profession_id,workflow_id,
// position) / update(position) only) and the 1.5 professions mod-UPDATE policy + grant(rules). The
// Server Action ALSO re-checks `isProfessionModerator` (defense-in-depth) — RLS is the real boundary.

/**
 * Pin a published workflow to a profession's "Start here" canon (Story 7.3 / FR18). New pin lands at
 * the end of the ordered list (`position` = current max + 1). RLS gates the insert to moderators; the
 * `enforce_pin_target` trigger additionally rejects a non-published or cross-profession target (one
 * generic error → `db_error` here). A `23505` (UNIQUE — already pinned) is an idempotent success
 * (the `joinProfession` convention).
 */
export async function pinWorkflow(
  professionId: string,
  workflowId: string,
): Promise<MembershipResult> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("profession_pins")
    .select("position")
    .eq("profession_id", professionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position: number } | null)?.position ?? -1) + 1;
  const { error } = await supabase
    .from("profession_pins")
    .insert({ profession_id: professionId, workflow_id: workflowId, position });
  if (error) {
    if (error.code === "23505") return { ok: true }; // already pinned — idempotent
    return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/**
 * Unpin a workflow from a profession's canon (Story 7.3). RLS gates the delete to moderators; a
 * zero-row delete (not a moderator / not pinned) → `not_found` via `.select().maybeSingle()` (the
 * `leaveProfession` deleteDraft pattern — never a false "Unpinned").
 */
export async function unpinWorkflow(
  professionId: string,
  workflowId: string,
): Promise<MembershipResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profession_pins")
    .delete()
    .eq("profession_id", professionId)
    .eq("workflow_id", workflowId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Reorder a profession's pinned canon (Story 7.3). Persists each workflow's new `position` = its
 * index in `orderedWorkflowIds` (only `position` is client-updatable after the 7.3 harden — a pin's
 * `workflow_id` can't be re-pointed). Sequential per-row updates (the founder-curated list is small;
 * no atomic RPC). RLS gates each update to moderators. Any failure → `db_error`.
 */
export async function reorderPins(
  professionId: string,
  orderedWorkflowIds: string[],
): Promise<MembershipResult> {
  const supabase = await createClient();
  for (let i = 0; i < orderedWorkflowIds.length; i++) {
    const { error } = await supabase
      .from("profession_pins")
      .update({ position: i })
      .eq("profession_id", professionId)
      .eq("workflow_id", orderedWorkflowIds[i] as string);
    if (error) return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/**
 * Replace a profession's house rules (Story 7.3). Re-validates server-side with `houseRulesSchema`
 * (the action is the trust boundary — the 4.2 lesson; closes 7.2 defer #3) before the RLS-gated
 * `update` (mod-gated policy + `grant update(rules)`, both since Story 1.5). Invalid input →
 * `db_error` (the client form validates with the SAME schema). `parseHouseRules` still guards the read.
 */
export async function updateHouseRules(
  professionId: string,
  rules: HouseRule[],
): Promise<MembershipResult> {
  const parsed = houseRulesSchema.safeParse(rules);
  if (!parsed.success) return { ok: false, error: "db_error" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("professions")
    .update({ rules: parsed.data })
    .eq("id", professionId);
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}

/**
 * Published workflows of a profession a moderator can pin (Story 7.3 pin picker). RLS-only public
 * read (published workflows are public). Returns `{ id, title }` for the dialog's select list; the
 * caller excludes already-pinned ids client-side, and a re-pin is a no-op anyway (UNIQUE → 23505 →
 * idempotent).
 */
export async function listPinnableWorkflows(
  professionId: string,
): Promise<ProfessionPin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflows")
    .select("id, title")
    .eq("profession_id", professionId)
    .eq("status", "published")
    .order("title", { ascending: true });
  return (data ?? []) as ProfessionPin[];
}
