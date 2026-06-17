import { notFound } from "next/navigation";
import { ExploreFeed } from "@/components/explore/explore-feed";
import { WorkflowOfTheDay } from "@/components/explore/workflow-of-the-day";
import styles from "@/components/professions/community.module.css";
import { CommunityRail } from "@/components/professions/community-rail";
import { FeedSortTabs } from "@/components/professions/feed-sort-tabs";
import { ProfessionHero } from "@/components/professions/profession-hero";
import { ProfessionTagChips } from "@/components/professions/profession-tag-chips";
import { PAGE_SIZE, type WorkflowSort } from "@/lib/explore";
import { getSavedWorkflowIds } from "@/lib/services/boards";
import { getWorkflowOfTheDay } from "@/lib/services/featured";
import {
  getMyMembership,
  getProfessionBySlug,
  isProfessionModerator,
  listPinnableWorkflows,
  listProfessionMods,
  listProfessionPins,
  parseHouseRules,
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
  const sort: WorkflowSort =
    sp.sort === "new" ? "new" : sp.sort === "top" ? "top" : "trending";
  const tag = sp.tag ?? null;
  // One reference time for the Hot blend's recency decay (Story 7.1), shared by the SSR page +
  // every Load-more page so pagination stays deterministic across the browse session.
  const asOf = new Date().toISOString();

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

  const [feed, mods, canon, membership, wotd, isModerator] = await Promise.all([
    listPublishedWorkflows({
      profession: slug,
      tag: activeTag,
      sort,
      limit: PAGE_SIZE,
      // Hot = the community recency-weighted engagement blend (Story 7.1); New/Top stay column sorts.
      hotBlend: sort === "trending",
      asOf,
    }),
    listProfessionMods(profession.id),
    // "Start here" = the profession's mod-curated pinned canon (Story 7.2; replaces the 6.2 proxy).
    listProfessionPins(profession.id),
    user ? getMyMembership(profession.id) : Promise.resolve(null),
    // The profession's Workflow of the Day (6.3) — prepends the feed column.
    getWorkflowOfTheDay({ professionId: profession.id }),
    // Mod gate (Story 7.3) — the RPC, NOT membership.role: the founder moderates EVERY profession via
    // is_profession_moderator but has no profession_members row for most, so role would wrongly hide
    // the mod tools. Anon → false (no RPC).
    user ? isProfessionModerator(profession.id) : Promise.resolve(false),
  ]);
  const isMember = membership !== null;
  // Only a moderator / verified_pro can't self-leave (RLS). A plain member — or a
  // non-member who's about to join AS a member (optimistic) — can. So the leave is
  // blocked only for the elevated roles, never for the common join→leave path.
  const canLeave = !membership || membership.role === "member";
  // Mod-only (Story 7.3): the pin picker's options = this profession's published workflows. Fetched
  // ONLY for a moderator → zero extra query on the member/anon path (UX-DR21 stays cheap).
  const pinnable = isModerator
    ? await listPinnableWorkflows(profession.id)
    : [];

  // Saved-state (Story 8.1) for the feed cards + the WOTD hero — empty for anon.
  const savedIds = await getSavedWorkflowIds(
    wotd
      ? [...feed.items.map((i) => i.id), wotd.id]
      : feed.items.map((i) => i.id),
  );
  const feedItems = feed.items.map((i) => ({
    ...i,
    saved: savedIds.has(i.id),
  }));

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
          rules={parseHouseRules(profession.rules)}
          description={profession.description}
          isModerator={isModerator}
          professionId={profession.id}
          pinnable={pinnable}
        />
        <section className={styles.main}>
          {wotd ? (
            <WorkflowOfTheDay
              data={wotd}
              signedIn={Boolean(user)}
              initialSaved={savedIds.has(wotd.id)}
            />
          ) : null}
          <FeedSortTabs slug={slug} sort={sort} tag={activeTag} />
          <ProfessionTagChips
            slug={slug}
            tags={tags}
            sort={sort}
            activeTag={activeTag}
          />
          <ExploreFeed
            key={`${sort}:${activeTag ?? "all"}`}
            initialItems={feedItems}
            total={feed.total}
            sort={sort}
            profession={slug}
            professionName={profession.name}
            tag={activeTag}
            hotBlend={sort === "trending"}
            asOf={asOf}
            hideCommunityChip
            signedIn={Boolean(user)}
          />
        </section>
      </div>
    </div>
  );
}
