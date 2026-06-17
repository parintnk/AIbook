import { z } from "zod";

/**
 * Board input validation (Story 8.1 / FR4). Client-safe — NO `server-only` / `next/*` imports —
 * so the picker dialog (client) and the Server Action (server) share one schema.
 */

export const MAX_BOARD_NAME = 60;

export const boardNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a board name.")
  .max(MAX_BOARD_NAME, `Keep it under ${MAX_BOARD_NAME} characters.`);

export const createBoardSchema = z.object({
  name: boardNameSchema,
  isPublic: z.boolean(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

/** Story 8.2 — rename a board (name only; visibility toggles via its own action). */
export const renameBoardSchema = z.object({ name: boardNameSchema });

/** Story 8.2 — drag-reorder: the new order of a board's items, as workflow ids. */
export const reorderBoardItemsSchema = z.array(z.string().uuid());
