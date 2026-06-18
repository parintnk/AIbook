import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SearchResultCard as Card } from "@/lib/search";

const loadMore = vi.fn();
vi.mock("@/app/(app)/search/actions", () => ({
  loadMoreSearchAction: (...a: unknown[]) => loadMore(...a),
}));
// Keep the grid simple — the card pipeline (WorkflowCard/Link/thumb) is tested elsewhere.
vi.mock("./search-result-card", () => ({
  SearchResultCard: ({ data }: { data: Card }) => (
    <div data-testid="card">{data.id}</div>
  ),
}));

import { SearchResults } from "./search-results";

function card(id: string): Card {
  return {
    id,
    title: id,
    authorHandle: null,
    authorDisplayName: null,
    authorAvatarUrl: null,
    professionName: null,
    professionSlug: null,
    forkCount: 0,
    workedScore: 0,
    triedCount: 0,
    publishedAt: null,
    thumb: { kind: null, url: null },
    matchPct: 90,
  };
}

function renderResults() {
  render(
    <SearchResults
      query="q"
      professionId={null}
      tagIds={null}
      sort="best"
      initialItems={[card("a"), card("b")]}
      total={5}
      signedIn={false}
    />,
  );
}

describe("SearchResults load-more guard", () => {
  it("stops cleanly without mixing rows when a load-more page comes back degraded", async () => {
    loadMore.mockResolvedValue({
      items: [card("kw1")],
      total: 5,
      degraded: true,
    });
    renderResults();
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await screen.findByText("You're all caught up");
    expect(screen.queryByText("kw1")).not.toBeInTheDocument(); // keyword row NOT spliced in
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });

  it("appends a normal (non-degraded) page", async () => {
    loadMore.mockResolvedValue({
      items: [card("c")],
      total: 5,
      degraded: false,
    });
    renderResults();
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByText("c")).toBeInTheDocument();
  });
});
