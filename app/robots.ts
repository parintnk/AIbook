import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://a-ibook-ivory.vercel.app";

/**
 * Crawl rules — allow the public cookbook (explore / search / workflows / profiles /
 * communities), keep crawlers out of private + non-content routes, and point them at
 * the sitemap. Auth-gated routes (the draft editor, etc.) redirect to sign-in for
 * crawlers anyway, so only the clearly-private prefixes are disallowed here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/settings", "/me", "/admin", "/api", "/auth"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
