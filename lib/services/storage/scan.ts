import "server-only";

/**
 * Malware-scan seam (NFR5). v1 is a NO-OP that always returns clean — real AV is
 * deferred to near-launch (D1 decision).
 *
 * The intended real implementation is the **Cloudmersive Virus Scan API** (a private
 * POST-the-bytes scan). It is explicitly NOT VirusTotal's free tier, which makes
 * submitted files PUBLIC — unacceptable for private creator outputs. Keep this
 * signature stable so wiring the real call later is a one-function change.
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
