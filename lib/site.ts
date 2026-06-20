/**
 * Canonical site origin + brand strings — the ONE source for absolute URLs (metadataBase,
 * sitemap, robots, OG tags). `NEXT_PUBLIC_SITE_URL` should be set in Vercel; the vercel.app host
 * is the fallback so links still resolve before it's configured.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://a-ibook-ivory.vercel.app";

export const SITE_NAME = "idea";
export const SITE_TAGLINE = "a cookbook for AI workflows";
export const SITE_DESCRIPTION =
  "Share, discover, and remix multi-tool AI workflows — organized by profession, with a real sample output on every step.";
