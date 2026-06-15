/**
 * Storage abstraction seam (architecture DR-3 / AR8).
 *
 * Media (creator sample outputs) is served from Supabase Storage in v1. This module is the single
 * boundary the rest of the app goes through, so the backend can later be swapped to Cloudflare R2
 * (S3-compatible, free egress) with no changes to callers.
 *
 * Story 2.4 ships the first implementation (`createSupabaseStorage`, backed by the private
 * `node-outputs` bucket). The R2 swap later implements the same methods (S3 presigned GET for
 * `signedUrl`).
 */

export type StoredObject = {
  path: string;
  mime: string;
  bytes: number;
};

export interface StorageService {
  /** Upload a validated object and return its canonical stored reference. */
  upload(input: {
    key: string;
    body: Uint8Array;
    mime: string;
  }): Promise<StoredObject>;
  /**
   * Resolve a public (CDN) URL for a stored object path. Only meaningful for a
   * public bucket — the `node-outputs` bucket is private, so callers use
   * `signedUrl` instead (a bare public URL 400s for a private object).
   */
  publicUrl(path: string): string;
  /**
   * Resolve a time-limited signed URL for a private object (RLS-checked at
   * issuance). Used by the authoring surfaces to render image/video/file outputs.
   */
  signedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  /** Remove one or more stored objects. */
  remove(path: string | string[]): Promise<void>;
}
