import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustRow } from "./trust-row";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

describe("TrustRow", () => {
  it("renders graceful zero-states (no votes, no forks, original, recent)", () => {
    render(
      <TrustRow
        workflowId="w1"
        triedCount={0}
        forkCount={0}
        parentId={null}
        lastVerifiedAt={null}
        publishedAt={daysAgo(14)}
      />,
    );
    expect(screen.getByText(/be the first to try this/i)).toBeInTheDocument();
    expect(screen.getByText(/original by creator/i)).toBeInTheDocument();
    expect(screen.getByText(/last verified .* ago/i)).toBeInTheDocument();
    // No fork stat at 0, no green success pill, no stale warning.
    expect(screen.queryByText(/forked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tried & worked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tools change fast/i)).not.toBeInTheDocument();
  });

  it("renders populated counts (outcome pill + fork count)", () => {
    render(
      <TrustRow
        workflowId="w1"
        triedCount={47}
        forkCount={230}
        parentId={null}
        lastVerifiedAt={daysAgo(5)}
        publishedAt={daysAgo(200)}
      />,
    );
    expect(screen.getByText(/tried & worked/i)).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText(/forked/i)).toBeInTheDocument();
    expect(screen.getByText(/230/)).toBeInTheDocument();
    // last_verified (5d) beats published (200d) → not stale.
    expect(screen.queryByText(/tools change fast/i)).not.toBeInTheDocument();
  });

  it("shows the cautionary tone when last-verified is older than 90 days", () => {
    render(
      <TrustRow
        workflowId="w1"
        triedCount={0}
        forkCount={0}
        parentId={null}
        lastVerifiedAt={null}
        publishedAt={daysAgo(120)}
      />,
    );
    expect(
      screen.getByText(/tools change fast — this may need a re-check/i),
    ).toBeInTheDocument();
  });

  it("shows a variation marker for a forked workflow", () => {
    render(
      <TrustRow
        workflowId="w1"
        triedCount={0}
        forkCount={0}
        parentId="parent-id"
        lastVerifiedAt={null}
        publishedAt={daysAgo(1)}
      />,
    );
    expect(screen.getByText(/variation/i)).toBeInTheDocument();
    expect(screen.queryByText(/original by creator/i)).not.toBeInTheDocument();
  });

  it("renders 'Forked from @handle' as a link to the parent (Story 5.2)", () => {
    render(
      <TrustRow
        workflowId="w1"
        triedCount={0}
        forkCount={0}
        parentId="parent-id"
        parentHandle="nok"
        lastVerifiedAt={null}
        publishedAt={daysAgo(1)}
      />,
    );
    const link = screen.getByRole("link", { name: /forked from @nok/i });
    expect(link).toHaveAttribute("href", "/workflows/parent-id");
    expect(screen.queryByText(/^variation$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/original by creator/i)).not.toBeInTheDocument();
  });

  it("links to the lineage tree when there are forks or an ancestor (Story 5.3)", () => {
    // Has forks → the "View lineage" entry appears, pointing at /workflows/{id}/lineage.
    const { rerender } = render(
      <TrustRow
        workflowId="w1"
        triedCount={0}
        forkCount={3}
        parentId={null}
        lastVerifiedAt={null}
        publishedAt={daysAgo(1)}
      />,
    );
    expect(screen.getByRole("link", { name: /view lineage/i })).toHaveAttribute(
      "href",
      "/workflows/w1/lineage",
    );

    // No forks AND no parent → no lineage to explore → no entry.
    rerender(
      <TrustRow
        workflowId="w1"
        triedCount={0}
        forkCount={0}
        parentId={null}
        lastVerifiedAt={null}
        publishedAt={daysAgo(1)}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /view lineage/i }),
    ).not.toBeInTheDocument();
  });
});
