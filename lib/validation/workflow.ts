import { z } from "zod";
import { urlOrEmpty } from "./url";

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

/**
 * A recipe-card node (Story 2.2 / FR6). `tool_name`, `prompt`, and `purpose` are
 * the required spine of a step; everything else is optional. `est_time`/`est_cost`
 * are free-text ("~5 min" / "$0.02"), never numeric. Optional text fields are
 * plain strings (the form supplies ""); the action trims "" -> null before the DB
 * write. `note_lang` carries the FR24 bilingual tag with no localization UI.
 */
export const workflowNodeSchema = z.object({
  step_title: z.string().trim().max(120, "Max 120 characters"),
  tool_name: z.string().trim().min(1, "Required").max(80, "Max 80 characters"),
  tool_version: z.string().trim().max(40, "Max 40 characters"),
  prompt: z.string().trim().min(1, "Required").max(4000, "Max 4000 characters"),
  purpose: z
    .string()
    .trim()
    .min(1, "Required")
    .max(4000, "Max 4000 characters"),
  est_time: z.string().trim().max(40, "Max 40 characters"),
  est_cost: z.string().trim().max(40, "Max 40 characters"),
  notes: z.string().trim().max(4000, "Max 4000 characters"),
  note_lang: z.string().trim().max(16, "Max 16 characters"),
  tool_url: urlOrEmpty,
});

export type WorkflowNodeValues = z.infer<typeof workflowNodeSchema>;

/** React Flow graph payloads (Story 2.3). The DB FKs + RPCs are the real guards;
 * these just check shape before the action calls the service. */
export const edgeEndpointsSchema = z.object({
  source: z.uuid(),
  target: z.uuid(),
});

export const nodePositionsSchema = z
  .array(
    z.object({
      id: z.uuid(),
      // .finite() rejects NaN/±Infinity so a malformed payload can't poison pos.
      pos_x: z.number().finite(),
      pos_y: z.number().finite(),
    }),
  )
  .max(1000);

export const nodeIdsSchema = z.array(z.uuid()).max(1000);

/** State returned by the workflow draft actions (mirrors the profile form).
 * `nodeId` is set by createNodeAction so the canvas can chain/splice the new node. */
export type WorkflowFormState = {
  error?: string;
  success?: boolean;
  nodeId?: string;
};
