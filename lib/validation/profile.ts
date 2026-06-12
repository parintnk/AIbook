import { z } from "zod";

/** Handle: 3–30 chars, lowercase letters / digits / underscore. */
export const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

export const handleSchema = z
  .string()
  .regex(
    HANDLE_RE,
    "3–30 characters: lowercase letters, numbers, and underscores only",
  );

// Empty string (field left blank) or a valid URL — converted to null in the
// action before it reaches the DB (those columns are nullable).
const urlOrEmpty = z.union([z.literal(""), z.url("Enter a valid URL")]);

export const aiStackItemSchema = z.object({
  tool_name: z.string().trim().min(1, "Required").max(40, "Max 40 characters"),
  // Numbers throughout (the form registers the select with valueAsNumber) so
  // the schema's input type stays `number` and aligns with the RHF resolver.
  skill_level: z.number().int().min(1).max(5),
  sort_order: z.number().int().min(0),
});

export const profileFormSchema = z.object({
  handle: handleSchema,
  display_name: z.string().max(60, "Max 60 characters"),
  bio: z.string().max(280, "Max 280 characters"),
  avatar_url: urlOrEmpty,
  hire_me_url: urlOrEmpty,
  hire_me_visible: z.boolean(),
  ai_stack: z.array(aiStackItemSchema).max(30, "Up to 30 tools"),
});

export type AiStackItemValues = z.infer<typeof aiStackItemSchema>;
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** State returned by the profile update action (mirrors 1.3's auth form state). */
export type ProfileFormState = {
  error?: string;
  fieldError?: { field: "handle"; message: string };
  success?: boolean;
};
