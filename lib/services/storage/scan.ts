import "server-only";

/**
 * Malware-scan seam (NFR5). v1 is a NO-OP that always returns clean.
 *
 * ⚠️ ACCEPTED RISK FOR v1 LAUNCH (decision 2026-06-20): file scanning is intentionally
 * off. Mitigations that make this acceptable for launch: uploads are auth-gated +
 * owner-scoped, MIME/size/extension validated (`media/validate.ts`), stored in private
 * Supabase Storage behind RLS + signed URLs (never executed, served as downloads), and
 * the surface is small (creator sample outputs, not arbitrary public upload). Revisit
 * before scaling user uploads.
 *
 * ponytail: no-op scanner; wire the real call when uploads open up. The intended impl
 * is the **Cloudmersive Virus Scan API** (a private POST-the-bytes scan) — explicitly
 * NOT VirusTotal's free tier, which makes submitted files PUBLIC (unacceptable for
 * private creator outputs). This signature is stable so it stays a one-function change.
 *
 * [Source: architecture.md#NFR5; epic-2 retro D1 — Cloudmersive preferred, avoid
 * VirusTotal-free]
 */
export async function scanFile(
  _bytes: Uint8Array,
  _mime: string,
): Promise<{ clean: boolean; reason?: string }> {
  return { clean: true };
}
