import type { Database } from "@/lib/supabase/database.types";

/**
 * Client-safe AI types + copy + caps (Story 11.1). Like `lib/search.ts`/`lib/explore.ts`, these live
 * OUTSIDE the `server-only` `lib/services/ai/*` layer so client components (the rate-limited disabled
 * state, and the 11.2 Skeleton / 11.3 Doctor triggers) can import the caps + copy without pulling a
 * server module. The cap VALUES are the source of truth here (passed as `p_limit` at the call site).
 */

/** The AI features metered per user (architecture.md:133 — the `ai_feature` enum). */
export type AiFeature = Database["public"]["Enums"]["ai_feature"];

/**
 * Per-user DAILY caps (v1 free tier — No13). skeleton 5 (FR8) · doctor 10 (a cheaper Gemini call,
 * re-runnable per UX-DR13). `export` = v1.1 and `embed` = system-run (the 10.1 Cron has no user
 * session), so both are 0 = "not user-capped in v1" — the enum carries them for AR6 fidelity / future.
 */
export const AI_FEATURE_CAPS: Record<AiFeature, number> = {
  skeleton: 5,
  doctor: 10,
  export: 0,
  embed: 0,
};

/** Human label for a feature, used in the rate-limited copy + the UI. */
export function featureLabel(feature: AiFeature): string {
  switch (feature) {
    case "skeleton":
      return "skeleton";
    case "doctor":
      return "Doctor";
    case "export":
      return "export";
    case "embed":
      return "embedding";
  }
}

/**
 * The UX-DR21 rate-limited copy (EXPERIENCE.md:137, verbatim): a soft disabled-state line, NOT an
 * error. "Resets at midnight" = UTC (the counter's `day` is the DB `current_date`; Supabase+Vercel
 * both run UTC — the 6.3 alignment note).
 */
export function rateLimitCopy(opts: {
  feature: AiFeature;
  limit: number;
}): string {
  return `You've used today's ${opts.limit} ${featureLabel(opts.feature)} runs. Resets at midnight.`;
}
