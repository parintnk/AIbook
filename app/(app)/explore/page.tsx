import { Zap } from "lucide-react";
import { ExploreFeed } from "@/components/explore/explore-feed";
import { NewThisWeekRail } from "@/components/explore/new-this-week-rail";
import { ProfessionChips } from "@/components/explore/profession-chips";
import { SectionHead } from "@/components/explore/section-head";
import { WorkflowOfTheDay } from "@/components/explore/workflow-of-the-day";
import styles from "@/components/workflows/explore.module.css";
import { PAGE_SIZE, type WorkflowSort } from "@/lib/explore";
import { getSavedWorkflowIds } from "@/lib/services/boards";
import { getWorkflowOfTheDay } from "@/lib/services/featured";
import { listProfessions } from "@/lib/services/professions";
import {
  listNewThisWeek,
  listPublishedWorkflows,
} from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Explore — idea" };

/**
 * Explore home (Story 6.1 / FR3) — the public cross-profession discovery surface. Public/anon
 * (RLS-only reads, no auth gate); SSR-first so the first page of cards is in the HTML (SEO/LCP).
 * Scope: profession chips + Trending feed (Load more) + New-this-week rail. The WOTD hero (6.3),
 * Collections (Epic 8), Rising creators (Epic 9) and Guides (v1.1) land in their own epics.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ profession?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const profession = sp.profession ?? null;
  const sort: WorkflowSort = sp.sort === "new" ? "new" : "trending";

  const [feed, professions, newThisWeek, wotd] = await Promise.all([
    listPublishedWorkflows({ profession, sort, limit: PAGE_SIZE, offset: 0 }),
    listProfessions(),
    sort === "new" ? Promise.resolve([]) : listNewThisWeek(),
    getWorkflowOfTheDay(),
  ]);

  // Validate the slug against real professions — an unknown slug → "All" (null). The service
  // already treats an unresolved slug as no-filter (so the SSR feed is unfiltered); keep the
  // chips + Load-more consistent with that rather than showing a feed with no active chip.
  const activeProfession =
    profession && professions.some((p) => p.slug === profession)
      ? profession
      : null;
  const professionName = activeProfession
    ? (professions.find((p) => p.slug === activeProfession)?.name ?? null)
    : null;

  // Saved-state (Story 8.1) for the feed cards + the WOTD hero — empty for anon (the feed itself
  // stays RLS-only public; this is the only auth read on the page).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = user != null;
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
      className={`${styles.explore} mx-auto w-full max-w-[1180px] px-6 py-8`}
    >
      <h1 className="sr-only">Explore — discover AI workflows</h1>
      {wotd ? (
        <div className="mb-[34px]">
          <WorkflowOfTheDay
            data={wotd}
            signedIn={signedIn}
            initialSaved={savedIds.has(wotd.id)}
          />
        </div>
      ) : null}
      <ProfessionChips professions={professions} active={activeProfession} />
      <SectionHead
        icon={<Zap width={19} height={19} aria-hidden="true" />}
        title={
          sort === "new"
            ? "Newest across professions"
            : "Trending across professions"
        }
        sub={
          sort === "new"
            ? "Freshly published recipes, newest first."
            : "Fresh, proven recipes the community is forking right now."
        }
      />
      <ExploreFeed
        key={`${sort}:${activeProfession ?? "all"}`}
        initialItems={feedItems}
        total={feed.total}
        sort={sort}
        profession={activeProfession}
        professionName={professionName}
        signedIn={signedIn}
      />
      {sort === "new" ? null : <NewThisWeekRail items={newThisWeek} />}
    </div>
  );
}
