/**
 * Storage abstraction seam (architecture DR-3 / AR8).
 *
 * Media (creator sample outputs) is served from Supabase Storage in v1. This module is the single
 * boundary the rest of the app goes through, so the backend can later be swapped to Cloudflare R2
 * (S3-compatible, free egress) with no changes to callers.
 *
 * No implementation yet — the upload/validation pipeline lands in Story 2.4. This file only fixes
 * the seam's location and contract shape.
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
  /** Resolve a public (CDN) URL for a stored object path. */
  publicUrl(path: string): string;
  /** Remove a stored object. */
  remove(path: string): Promise<void>;
}
