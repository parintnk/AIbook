import "server-only";
import { AI_FEATURE_CAPS, type AiFeature } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The per-user AI rate-limit primitive (Story 11.1). 11.2 (Skeleton) / 11.3 (Doctor) call
 * `checkAndConsumeQuota` before a generation and proceed only when `allowed`; a denied result drives
 * the UX-DR21 disabled state (NOT an error). `getAiUsageToday` reads the caller's own count for "used
 * N of M" displays. The increment runs through the service-role-only `consume_ai_quota` RPC (atomic,
 * race-free) via the 10.1 admin client; the user identity comes from the RLS client (the 10.2 split).
 */

export type QuotaResult = {
  allowed: boolean;
  used: number;
  limit: number;
  error?: "not_authenticated" | "db_error";
};

/** UTC day "YYYY-MM-DD" — aligns with the RPC's Postgres current_date (Supabase+Vercel run UTC). */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically check + consume one unit of the caller's daily quota for `feature`. Consume-on-attempt
 * (v1): the increment happens up front, so a later provider error still costs a run (refund-on-failure
 * is a deferred nicety). Unauthenticated → `{ allowed:false, error:"not_authenticated" }`.
 */
export async function checkAndConsumeQuota(opts: {
  feature: AiFeature;
}): Promise<QuotaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, used: 0, limit: 0, error: "not_authenticated" };
  }

  const limit = AI_FEATURE_CAPS[opts.feature];
  // A cap of 0 = "not user-metered in v1" (export = v1.1; embed = system-run). Treat as UNCAPPED —
  // never touch the RPC (whose INSERT path would otherwise write count=1, then lock forever at 0).
  if (limit <= 0) return { allowed: true, used: 0, limit };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_ai_quota", {
    p_profile_id: user.id,
    p_feature: opts.feature,
    p_limit: limit,
  });
  if (error || !data || data.length === 0) {
    return { allowed: false, used: 0, limit, error: "db_error" };
  }
  const row = data[0];
  return { allowed: row.allowed, used: row.used, limit: row.quota };
}

/**
 * The caller's own usage count for `feature` TODAY (for "used N of M" before a trigger). Read via the
 * RLS client (the own-row SELECT policy) — NOT the admin RPC. 0 if no row yet / unauthenticated.
 */
export async function getAiUsageToday(feature: AiFeature): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("profile_id", user.id)
    .eq("feature", feature)
    .eq("day", todayUtc())
    .maybeSingle();
  return data?.count ?? 0;
}
