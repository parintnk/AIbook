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

// ── Workflow Doctor (Story 11.3 / FR12) ─────────────────────────────────────
// The advisory pre-publish review. These client-safe types + labels back the
// `.doctor` panel; the review itself is produced server-side (Gemini, the 11.2
// pattern) by `lib/services/ai/doctor.ts`. Advisory only — never gates publish.

/** The 4 advisory dimensions the Doctor scores per node (FR12). */
export type DoctorCheck =
  | "thin_context"
  | "tool_mismatch"
  | "single_point_of_failure"
  | "output_quality";

/** The bold lead for each AI check (the `.dn-flag b` label; the message follows). */
export const DOCTOR_CHECK_LABELS: Record<DoctorCheck, string> = {
  thin_context: "Step context is thin",
  tool_mismatch: "Tool doesn't fit the step",
  single_point_of_failure: "No fallback if this step fails",
  output_quality: "Output quality concern",
};

/**
 * One advisory flag on a node. `check` is one of the 4 AI dimensions OR the
 * deterministic `missing_output` (the FR10 real-output rule, merged from the
 * publish-gate data — `required`, NOT an AI verdict).
 */
export type DoctorFlag = {
  check: DoctorCheck | "missing_output";
  message: string;
  required?: boolean;
};

/** The bold lead for any flag kind (the 4 AI checks + the deterministic req-flag). */
export function flagLabel(check: DoctorFlag["check"]): string {
  return check === "missing_output"
    ? "Missing required output"
    : DOCTOR_CHECK_LABELS[check];
}

/** Per-node advisory verdict, keyed back to the canvas node via `nodeId`. */
export type DoctorNodeVerdict = {
  nodeId: string;
  idx: number;
  stepTitle: string | null;
  status: "pass" | "flag";
  flags: DoctorFlag[];
};

/** A full advisory review (transient — returned to the client, never persisted). */
export type DoctorReview = {
  nodes: DoctorNodeVerdict[];
  pass: number;
  flag: number;
};

/** Count pass/flag across verdicts (the `.doc-score` pills). Pure — shared by the service + tests. */
export function summarizeVerdicts(nodes: Pick<DoctorNodeVerdict, "status">[]): {
  pass: number;
  flag: number;
} {
  let pass = 0;
  let flag = 0;
  for (const n of nodes) {
    if (n.status === "flag") flag += 1;
    else pass += 1;
  }
  return { pass, flag };
}

/** The `reviewWorkflowAction` result (advisory; rate-limit-aware, the 11.2 shape). */
export type DoctorActionState =
  | { ok: true; review: DoctorReview }
  | {
      ok: false;
      rateLimited?: boolean;
      used?: number;
      limit?: number;
      error?: string;
    };
