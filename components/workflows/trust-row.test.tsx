import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustRow } from "./trust-row";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

describe("TrustRow", () => {
  it("renders graceful zero-states (no votes, no forks, original, recent)", () => {
    render(
      <TrustRow
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
});
