import { z } from "zod";

/**
 * Report input validation (Story 4.3) — the action is the trust boundary. The reason enum is
 * LOCKED (architecture.md:131); labels are from the UX-DR18 mockup (overlays-light.html). Lives
 * here (not in the `server-only` reports service) so the client report dialog can render the
 * reason options too.
 */
export const REPORT_REASONS = [
  { value: "fake_output", label: "Fake / stock output" },
  { value: "spam", label: "Spam or self-promo" },
  { value: "copyright", label: "Copyright violation" },
  { value: "harassment", label: "Harassment" },
  { value: "not_working", label: "Doesn't work / misleading" },
  { value: "other", label: "Other" },
] as const;

export type ReportReasonValue = (typeof REPORT_REASONS)[number]["value"];

export const reportSchema = z.object({
  targetType: z.enum(["workflow", "comment"]),
  // Any UUID-shaped id (incl. the version-0 seed fixtures, which strict z.uuid() rejects);
  // the DB before-insert trigger is the real target check (published-only + existence).
  targetId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  reason: z.enum([
    "fake_output",
    "spam",
    "copyright",
    "harassment",
    "not_working",
    "other",
  ]),
  detail: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => v || null),
});

export type ReportInput = z.infer<typeof reportSchema>;
