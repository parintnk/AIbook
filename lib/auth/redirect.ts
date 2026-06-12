/**
 * Sanitize a post-auth `next` destination so an attacker can't bounce the user
 * to an external origin (open-redirect). Only same-origin absolute paths are
 * allowed — anything else falls back to the home page.
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/";
  // Must be a single-slash absolute path. Reject protocol-relative (`//host`),
  // absolute URLs (`https://…`), and backslash/whitespace tricks browsers may
  // normalize into a host.
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (/[\s\\]/.test(next)) return "/";
  return next;
}
