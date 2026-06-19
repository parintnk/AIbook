import { Compass } from "lucide-react";
import Link from "next/link";
import { KeywordFallback } from "@/components/search/keyword-fallback";
import { ResultBar } from "@/components/search/result-bar";
import styles from "@/components/search/search.module.css";
import { SearchBox } from "@/components/search/search-box";
import { SearchHeader } from "@/components/search/search-header";
import { SearchResults } from "@/components/search/search-results";
import { parseSearchSort } from "@/lib/search";
import { getSavedWorkflowIds } from "@/lib/services/boards";
import { listProfessions } from "@/lib/services/professions";
import { searchWorkflows } from "@/lib/services/search";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Search — idea" };

/** Example goals — shown on the empty `/search` landing (never a dead end), mirror the nav launcher. */
const SUGGESTED_GOALS = [
  "logo + brand kit for a coffee shop",
  "SaaS landing page from a one-line brief",
  "weekly content calendar from a few bullet points",
  "turn a blog post into a launch email",
  "product photos that actually convert",
];

/**
 * Goal-based semantic search (Story 10.2 / FR2). Public, SSR-first, anon-readable (mirrors /explore).
 * `/search?q=…` embeds the query + ranks PUBLISHED workflows by cosine similarity (the `searchWorkflows`
 * service); URL state (`q`, `profession`, `tag`, `sort`) is the shareable source of truth (DR-5). If
 * the embedder is unavailable it degrades to the FTS keyword fallback; zero matches → the AC2 empty
 * state — never a dead end.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    profession?: string;
    tag?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const sort = parseSearchSort(sp.sort);

  // No query → the search landing: the box + suggested goals (a designed preview, not a dead end).
  if (!query) {
    return (
      <div
        className={`${styles.search} mx-auto w-full max-w-[1180px] px-6 py-8`}
      >
        <h1 className="sr-only">Search workflows by goal</h1>
        <SearchBox />
        <p className="mb-3 mt-7 px-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Try a goal
        </p>
        <div className="flex flex-wrap gap-2.5">
          {SUGGESTED_GOALS.map((goal) => (
            <Link
              key={goal}
              href={`/search?q=${encodeURIComponent(goal)}`}
              className="inline-flex items-center rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-card hover:text-foreground"
            >
              {goal}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Validate the filters up front, in PARALLEL. listProfessions already carries every
  // profession's id, so the active profession's id comes from that list — no extra query
  // (the old separate `professions.select("id")` round-trip is gone). The tag slug→id
  // lookup is independent, so it runs alongside listProfessions.
  const [professions, tagRow] = await Promise.all([
    listProfessions(),
    sp.tag
      ? supabase
          .from("tags")
          .select("id, slug")
          .eq("slug", sp.tag)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activeProfession =
    sp.profession && professions.some((p) => p.slug === sp.profession)
      ? sp.profession
      : null;
  const professionId = activeProfession
    ? (professions.find((p) => p.slug === activeProfession)?.id ?? null)
    : null;

  let activeTag: string | null = null;
  let tagIds: string[] | null = null;
  if (tagRow.data) {
    const t = tagRow.data as { id: string; slug: string };
    activeTag = t.slug;
    tagIds = [t.id];
  }

  const result = await searchWorkflows({
    query,
    professionId,
    tagIds,
    sort,
    offset: 0,
  });

  // Saved-state (Story 8.1), result-set tag chips, and the signed-in flag are all keyed
  // off the result ids — fetch them in PARALLEL instead of three serial round-trips.
  const resultIds = result.items.map((i) => i.id);
  const [{ data: userData }, savedIds, tags] = await Promise.all([
    supabase.auth.getUser(),
    getSavedWorkflowIds(resultIds),
    resultTags(supabase, resultIds),
  ]);
  const signedIn = userData.user != null;
  const items = result.items.map((i) => ({ ...i, saved: savedIds.has(i.id) }));

  let body: React.ReactNode;
  if (result.degraded) {
    body = <KeywordFallback query={query} items={items} total={result.total} />;
  } else if (result.total === 0) {
    const professionName = activeProfession
      ? (professions.find((p) => p.slug === activeProfession)?.name ?? null)
      : null;
    body = (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No close matches for “{query}”.</div>
        <p className={styles.emptySub}>
          Try a broader goal
          {professionName ? (
            <>
              , or browse{" "}
              <Link
                className={styles.emptyLink}
                href={`/communities/${activeProfession}`}
              >
                {professionName}
              </Link>
            </>
          ) : null}
          .
        </p>
        <Link className={styles.emptyLink} href="/explore">
          <Compass width={16} height={16} aria-hidden="true" />
          Browse all workflows
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ResultBar
          total={result.total}
          query={query}
          profession={activeProfession}
          tag={activeTag}
          sort={sort}
        />
        <SearchResults
          // Remount on any result-set change (query/profession/tag/sort) so the client list re-seeds
          // from the fresh initialItems — without this, a filter chip's soft-nav leaves the previous
          // results' useState in place until a full refresh (the 6.1 ExploreFeed key precedent).
          key={`${sort}:${activeProfession ?? "all"}:${activeTag ?? "all"}:${query}`}
          query={query}
          professionId={professionId}
          tagIds={tagIds}
          sort={sort}
          initialItems={items}
          total={result.total}
          signedIn={signedIn}
        />
      </>
    );
  }

  return (
    <div className={`${styles.search} mx-auto w-full max-w-[1180px] px-6 py-8`}>
      <SearchBox initialQuery={query} />
      <SearchHeader
        query={query}
        professions={professions}
        activeProfession={activeProfession}
        tags={tags}
        activeTag={activeTag}
        sort={sort}
      />
      {body}
    </div>
  );
}

/** Distinct tags carried by the current result set (capped) → the relevant filter chips. */
async function resultTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workflowIds: string[],
): Promise<Array<{ slug: string; label: string }>> {
  if (workflowIds.length === 0) return [];
  const { data: wt } = await supabase
    .from("workflow_tags")
    .select("tag_id")
    .in("workflow_id", workflowIds);
  const ids = [
    ...new Set(((wt ?? []) as Array<{ tag_id: string }>).map((r) => r.tag_id)),
  ];
  if (ids.length === 0) return [];
  const { data: tags } = await supabase
    .from("tags")
    .select("slug, label")
    .in("id", ids)
    .limit(8);
  return (tags ?? []) as Array<{ slug: string; label: string }>;
}
