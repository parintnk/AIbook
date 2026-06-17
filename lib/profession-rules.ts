import { z } from "zod";

/**
 * Story 7.3 — the house-rules editor's validation, shared by the client form (RHF) and the server
 * action / service (the action is the trust boundary — the 4.2 lesson). Client-safe (zod only, NO
 * `server-only`) so both sides import the SAME schema. Closes the 7.2 review defer #3 (empty-string
 * titles, no cap): each rule's `title`/`body` must be non-empty after `trim()`, and the list is
 * capped. `parseHouseRules` (server, read side) still falls back to the universal defaults.
 */
export const MAX_HOUSE_RULES = 8;

export const houseRuleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Add a short title")
    .max(80, "Keep the title under 80 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Add a short description")
    .max(200, "Keep it under 200 characters"),
});

export const houseRulesSchema = z
  .array(houseRuleSchema)
  .min(1, "Add at least one rule")
  .max(MAX_HOUSE_RULES, `At most ${MAX_HOUSE_RULES} rules`);

export type HouseRuleInput = z.infer<typeof houseRuleSchema>;
