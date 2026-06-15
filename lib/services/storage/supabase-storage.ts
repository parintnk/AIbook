import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { StorageService, StoredObject } from "./index";

/**
 * Supabase Storage implementation of the StorageService seam (Story 2.4), backed by
 * the private `node-outputs` bucket.
 *
 * It is bound to a caller-supplied Supabase client (the user-session server client),
 * so every operation runs under the uploader's Auth/RLS — the `storage.objects`
 * policies (path workflow_id → owned draft) are the real boundary, NOT just
 * defense-in-depth. The Route Handler ALSO checks `ownsDraftForNode` before reading
 * the body for an early 403 + typed errors, but RLS is what ultimately gates writes,
 * so no secret/service key is needed.
 *
 * The R2 fallback (DR-3) later implements this same interface (S3 presigned GET for
 * `signedUrl`); callers never change.
 */

const BUCKET = "node-outputs";
const DEFAULT_SIGNED_TTL = 3600; // 1h

export function createSupabaseStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
): StorageService {
  const bucket = supabase.storage.from(BUCKET);

  return {
    async upload({ key, body, mime }): Promise<StoredObject> {
      const { error } = await bucket.upload(key, body, {
        contentType: mime,
        upsert: true, // replace-on-reupload (the row is unique per node)
      });
      if (error) throw error;
      return { path: key, mime, bytes: body.byteLength };
    },

    publicUrl(path: string): string {
      return bucket.getPublicUrl(path).data.publicUrl;
    },

    async signedUrl(
      path: string,
      expiresInSeconds: number = DEFAULT_SIGNED_TTL,
    ): Promise<string> {
      const { data, error } = await bucket.createSignedUrl(
        path,
        expiresInSeconds,
      );
      if (error) throw error;
      return data.signedUrl;
    },

    async remove(path: string | string[]): Promise<void> {
      const paths = Array.isArray(path) ? path : [path];
      const { error } = await bucket.remove(paths);
      if (error) throw error;
    },
  };
}
