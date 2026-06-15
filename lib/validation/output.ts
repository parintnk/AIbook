import { z } from "zod";

/**
 * Node sample-output validation (Story 2.4). The binary upload pipeline (magic-byte
 * sniff + size caps + scan) is the real gate — these schemas only shape the small
 * text/kind payloads. `outputErrorMessage` is the single source of reject copy,
 * reused by the Route Handler JSON and the OutputUploader toast.
 */

/** Binary upload kinds (text is inline, not a file upload). */
export const mediaKindSchema = z.enum(["image", "video", "file"]);
export type MediaKindValue = z.infer<typeof mediaKindSchema>;

/** Inline text output. */
export const textOutputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Required")
    .max(10_000, "Max 10000 characters"),
});

/** Every error key the upload/text/delete flows can surface. */
export type OutputError =
  // media-pipeline (AC1)
  | "too_large"
  | "unreadable_type"
  | "unsupported_type"
  | "infected"
  | "process_failed"
  // service / transport
  | "not_authenticated"
  | "not_found"
  | "invalid_output"
  | "duplicate"
  | "bad_request"
  | "db_error";

/**
 * Map an error key → user-facing copy. `{limit}` / `{filetype}` are interpolated
 * from the server-supplied context (the route computes the per-kind cap + echoes
 * the sniffed type), so the copy reads "over the 10MB limit" / "SVG isn't
 * supported." [Source: epics.md#Story-2.4 L421]
 */
export function outputErrorMessage(
  error: OutputError,
  ctx?: { limit?: string; filetype?: string },
): string {
  switch (error) {
    case "too_large":
      return `File is over the ${ctx?.limit ?? "size"} limit.`;
    case "unreadable_type":
      return "We couldn't read that file. Try a PNG, JPG, WebP, GIF, MP4, or PDF.";
    case "unsupported_type":
      return `${ctx?.filetype ?? "That file type"} isn't supported.`;
    case "infected":
      return "That file didn't pass our safety check.";
    case "process_failed":
      return "We couldn't process that image. Try re-exporting it.";
    case "not_authenticated":
      return "You must be signed in.";
    case "not_found":
      return "That step no longer exists.";
    case "invalid_output":
      return "That output couldn't be saved.";
    case "bad_request":
      return "That upload was malformed. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
