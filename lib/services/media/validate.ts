import "server-only";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { scanFile } from "@/lib/services/storage/scan";

/**
 * Server-side media validation pipeline (Story 2.4, AC1/AC2). Pure (no Supabase) so
 * it is trivially unit-testable. Runs ONLY on bytes the server controls (the Route
 * Handler buffers the upload) — a client-direct-to-Storage upload could not be
 * validated (the bucket's allowed_mime_types trusts the forgeable client
 * content-type). Order is cheapest-first / fail-fast.
 *
 * Images are re-encoded with sharp (which strips ALL metadata incl. EXIF by default)
 * and thumbnailed in-app — NOT via Supabase image transforms (Pro-plan-only + not
 * R2-portable, DR-3). Videos/PDFs are stored as-is after sniff + allowlist + scan.
 *
 * [Context7: sharp 0.34.x, file-type 22.x]
 */

export type MediaKind = "image" | "video" | "file";

export type MediaError =
  | "too_large"
  | "unreadable_type"
  | "unsupported_type"
  | "infected"
  | "process_failed";

export type MediaValidationResult =
  | {
      ok: true;
      mime: string;
      bytes: number;
      main: Uint8Array;
      thumb?: Uint8Array;
      thumbMime?: string;
    }
  // `detectedType` carries the SNIFFED mime on an unsupported_type reject so the UI
  // copy ("{filetype} isn't supported") names what the bytes actually are, not a
  // forgeable client-supplied extension.
  | { ok: false; error: MediaError; detectedType?: string };

/** Per-kind size caps. [ASSUMPTION, confirmed] images ≤10MB, video ≤100MB. */
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  file: 25 * 1024 * 1024,
};

/** Allowlist by kind, matched against the SNIFFED mime (never the declared one). */
const ALLOW: Record<MediaKind, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  file: ["application/pdf"],
};

/** ~16k² — guards a pixel/decompression bomb without rejecting normal photos. */
const MAX_INPUT_PIXELS = 268_402_689;
/** Thumbnail longest edge. */
const THUMB_EDGE = 512;

export async function validateMediaUpload({
  bytes,
  kind,
}: {
  bytes: Uint8Array;
  declaredMime: string;
  kind: MediaKind;
}): Promise<MediaValidationResult> {
  // 1) size cap (cheapest)
  if (bytes.byteLength > MEDIA_LIMITS[kind]) {
    return { ok: false, error: "too_large" };
  }

  // 2) magic-byte sniff — NEVER trust the declared mime / extension
  const sniff = await fileTypeFromBuffer(bytes);
  if (!sniff) return { ok: false, error: "unreadable_type" };

  // 3) allowlist + 4) kind agreement (the sniffed mime must be in the kind's set)
  if (!ALLOW[kind].includes(sniff.mime)) {
    return { ok: false, error: "unsupported_type", detectedType: sniff.mime };
  }

  // 5) malware-scan seam (no-op v1)
  const scan = await scanFile(bytes, sniff.mime);
  if (!scan.clean) return { ok: false, error: "infected" };

  // 6) images: re-encode (strips EXIF by default) + thumbnail. video/file: as-is.
  if (kind === "image") {
    try {
      const meta = await sharp(bytes, {
        failOn: "warning",
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();

      // Keep animated GIFs animated; everything else normalizes to webp.
      const isAnimated = (meta.pages ?? 1) > 1;
      const main = isAnimated
        ? await sharp(bytes, { animated: true, failOn: "warning" })
            .gif()
            .toBuffer()
        : await sharp(bytes, { failOn: "warning" })
            .rotate() // bake EXIF orientation BEFORE metadata is stripped
            .webp({ quality: 82 })
            .toBuffer();
      const mainMime = isAnimated ? "image/gif" : "image/webp";

      const thumb = await sharp(bytes, { failOn: "warning" })
        .rotate()
        .resize(THUMB_EDGE, THUMB_EDGE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 72 })
        .toBuffer();

      return {
        ok: true,
        mime: mainMime,
        bytes: main.byteLength,
        main: new Uint8Array(main),
        thumb: new Uint8Array(thumb),
        thumbMime: "image/webp",
      };
    } catch {
      // corrupt / decompression-bomb / unsupported-internally
      return { ok: false, error: "process_failed" };
    }
  }

  // video | file: store the original validated bytes, no thumbnail in v1.
  return { ok: true, mime: sniff.mime, bytes: bytes.byteLength, main: bytes };
}
