import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/anon";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://a-ibook-ivory.vercel.app";

/**
 * Dynamic sitemap — published workflows, their authors' profiles, and the community
 * (profession) pages, plus the static browse routes. Uses the cookie-free anon client
 * (public RLS reads) so it works at build/request time without a session. Profiles are
 * limited to authors WITH published work (no thin/empty profile pages).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAnonClient();
  const [{ data: workflows }, { data: professions }] = await Promise.all([
    supabase
      .from("workflows")
      .select(
        "id, updated_at, author:profiles!workflows_author_id_fkey(handle)",
      )
      .eq("status", "published"),
    supabase.from("professions").select("slug"),
  ]);

  const wfRows = (workflows ?? []) as Array<{
    id: string;
    updated_at: string | null;
    author: { handle: string } | null;
  }>;
  const profRows = (professions ?? []) as Array<{ slug: string }>;

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1 },
    { path: "/explore", priority: 0.9 },
    { path: "/search", priority: 0.7 },
    { path: "/communities", priority: 0.8 },
  ].map(({ path, priority }) => ({
    url: `${SITE}${path}`,
    changeFrequency: "daily",
    priority,
  }));

  const workflowRoutes: MetadataRoute.Sitemap = wfRows.map((w) => ({
    url: `${SITE}/workflows/${w.id}`,
    lastModified: w.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const communityRoutes: MetadataRoute.Sitemap = profRows.map((p) => ({
    url: `${SITE}/communities/${p.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const handles = [
    ...new Set(
      wfRows
        .map((w) => w.author?.handle)
        .filter((h): h is string => Boolean(h)),
    ),
  ];
  const profileRoutes: MetadataRoute.Sitemap = handles.map((h) => ({
    url: `${SITE}/u/${h}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...workflowRoutes,
    ...communityRoutes,
    ...profileRoutes,
  ];
}
