import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildLineageForest, type LineageNode } from "@/lib/lineage";
import { LineageTreeList } from "./lineage-tree-list";

function mk(id: string, parentId: string | null, handle: string): LineageNode {
  return {
    id,
    title: `WF ${id}`,
    summary: null,
    status: "published",
    forkCount: 0,
    workedScore: 0,
    triedCount: 0,
    depth: 0,
    parentId,
    author: { handle, display_name: null, avatar_url: null },
  };
}

describe("LineageTreeList", () => {
  it("marks the root 'Origin' + the current 'You are here' and links each node", () => {
    const forest = buildLineageForest(
      [
        mk("r", null, "nok"),
        mk("c1", "r", "somchai"),
        mk("c2", "r", "ploy"),
        mk("g", "c1", "nina"),
      ],
      "r",
    );
    if (!forest) throw new Error("no forest");
    render(<LineageTreeList forest={forest} currentId="c1" />);

    expect(screen.getByText("Origin")).toBeInTheDocument();
    expect(screen.getByText("You are here")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WF r" })).toHaveAttribute(
      "href",
      "/workflows/r",
    );
    expect(screen.getByRole("link", { name: "WF g" })).toHaveAttribute(
      "href",
      "/workflows/g",
    );
  });

  it("collapses dense siblings into a '+N more forks' disclosure", () => {
    const kids = Array.from({ length: 7 }, (_, i) => mk(`k${i}`, "r", `u${i}`));
    const forest = buildLineageForest([mk("r", null, "nok"), ...kids], "r");
    if (!forest) throw new Error("no forest");
    const { container } = render(
      <LineageTreeList forest={forest} currentId="r" />,
    );

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    if (details)
      expect(
        within(details as HTMLElement).getByText(/\+2 more forks/i),
      ).toBeInTheDocument();
  });
});
