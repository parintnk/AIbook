import { z } from "zod";

/**
 * Workflow draft metadata (Story 2.1). The DB FK is the real guard that
 * profession_id references a real profession; this checks shape + lengths.
 */
export const workflowDraftSchema = z.object({
  title: z.string().trim().min(1, "Required").max(120, "Max 120 characters"),
  summary: z.string().trim().max(280, "Max 280 characters"),
  profession_id: z.uuid("Pick a profession"),
});

export type WorkflowDraftValues = z.infer<typeof workflowDraftSchema>;

/** State returned by the workflow draft actions (mirrors the profile form). */
export type WorkflowFormState = {
  error?: string;
  success?: boolean;
};
