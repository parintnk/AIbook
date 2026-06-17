import { notFound } from "next/navigation";
import { ExploreFeed } from "@/components/explore/explore-feed";
import { WorkflowOfTheDay } from "@/components/explore/workflow-of-the-day";
import styles from "@/components/professions/community.module.css";
import { CommunityRail } from "@/components/professions/community-rail";
import { FeedSortTabs } from "@/components/professions/feed-sort-tabs";
import { ProfessionHero } from "@/components/professions/profession-hero";
import { ProfessionTagChips } from "@/components/professions/profession-tag-chips";
import { PAGE_SIZE, type WorkflowSort } from "@/lib/explore";
import { getWorkflowOfTheDay } from "@/lib/services/featured";
import {
  getMyMembership,
  getProfessionBySlug,
  listProfessionMods,
} from "@/lib/services/professions";
import { listProfessionTags } from "@/lib/services/tags";
import { listPublishedWorkflows } from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";

/**
 * Profession community landing (Story 6.2 / FR3 + FR17 + FR18). Public, SSR-first
 * (RLS-only published reads, no auth gate); resolves the profession by slug → 404 on
 * unknown. A 2-column shell: the rail (mods / start-here / house rules / about) beside
 * the profession-filtered feed (reusing 6.1's WorkflowCard + Load more) with a Hot/New
 * sort and tag-filter chips. Only the Join control needs auth; membership is read
 * server-side and passed down. The WOTD hero (6.3) prepends here later.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profession = await getProfessionBySlug(slug);
  return {
    title: profession ? `${profession.name} — idea` : "Community — idea",
  };
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; tag?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort: WorkflowSort = sp.sort === "new" ? "new" : "trending";
  const tag = sp.tag ?? null;

  const profession = await getProfessionBySlug(slug);
  if (!profession) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Validate the tag against the profession's actual tags BEFORE the feed query, so the
  // feed, the chips, and the empty-state all agree on one `activeTag`. A bogus / cross-
  // profession `?tag=` (e.g. a real tag with zero workflows in THIS profession) collapses
  // to no-filter → the full feed + an "All" chip, NOT a misleading "no workflows yet"
  // empty state (the 6.1 unknown-slug → "All" pattern, applied to tags).
  const tags = await listProfessionTags(slug);
  const activeTag = tag && tags.some((t) => t.slug === tag) ? tag : null;

  const [feed, mods, canonFeed, membership, wotd] = await Promise.all([
    listPublishedWorkflows({
      profession: slug,
      tag: activeTag,
      sort,
      limit: PAGE_SIZE,
    }),
    listProfessionMods(profession.id),
    // "Start here" interim proxy = the profession's most-forked published workflows.
    listPublishedWorkflows({ profession: slug, sort: "trending", limit: 5 }),
    user ? getMyMembership(profession.id) : Promise.resolve(null),
    // The profession's Workflow of the Day (6.3) — prepends the feed column.
    getWorkflowOfTheDay({ professionId: profession.id }),
  ]);

  const canon = canonFeed.items.map((w) => ({ id: w.id, title: w.title }));
  const isMember = membership !== null;
  // Only a moderator / verified_pro can't self-leave (RLS). A plain member — or a
  // non-member who's about to join AS a member (optimistic) — can. So the leave is
  // blocked only for the elevated roles, never for the common join→leave path.
  const canLeave = !membership || membership.role === "member";

  return (
    <div
      className={`${styles.community} mx-auto w-full max-w-[1180px] px-6 py-8`}
    >
      <ProfessionHero
        profession={profession}
        isAuthed={Boolean(user)}
        isMember={isMember}
        canLeave={canLeave}
      />
      <div className={styles.grid}>
        <CommunityRail
          mods={mods}
          canon={canon}
          description={profession.description}
        />
        <section className={styles.main}>
          {wotd ? <WorkflowOfTheDay data={wotd} /> : null}
          <FeedSortTabs slug={slug} sort={sort} tag={activeTag} />
          <ProfessionTagChips
            slug={slug}
            tags={tags}
            sort={sort}
            activeTag={activeTag}
          />
          <ExploreFeed
            key={`${sort}:${activeTag ?? "all"}`}
            initialItems={feed.items}
            total={feed.total}
            sort={sort}
            profession={slug}
            professionName={profession.name}
            tag={activeTag}
            hideCommunityChip
          />
        </section>
      </div>
    </div>
  );
}
