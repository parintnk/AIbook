import type { MetadataRoute } from "next";
import { SITE_URL as SITE } from "@/lib/site";

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
