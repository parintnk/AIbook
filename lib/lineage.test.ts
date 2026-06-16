import { describe, expect, it } from "vitest";
import { buildLineageForest, type LineageNode, layoutLineage } from "./lineage";

function mk(id: string, parentId: string | null, forkCount = 0): LineageNode {
  return {
    id,
    title: `WF ${id}`,
    summary: null,
    status: "published",
    forkCount,
    workedScore: 0,
    triedCount: 0,
    depth: 0,
    parentId,
    author: null,
  };
}

describe("buildLineageForest", () => {
  it("nests visible children from parentId (edges), not depth", () => {
    const tree = buildLineageForest(
      [mk("r", null), mk("c", "r"), mk("g", "c")],
      "r",
    );
    expect(tree?.id).toBe("r");
    expect(tree?.children.map((c) => c.id)).toEqual(["c"]);
    expect(tree?.children[0].children.map((c) => c.id)).toEqual(["g"]);
  });

  it("attaches an orphan (parent not in the visible set) to the root", () => {
    const tree = buildLineageForest(
      [mk("r", null), mk("orphan", "missing")],
      "r",
    );
    expect(tree?.children.map((c) => c.id)).toEqual(["orphan"]);
  });

  it("returns null when the root node isn't present", () => {
    expect(buildLineageForest([mk("c", "r")], "r")).toBeNull();
  });
});

describe("layoutLineage", () => {
  it("places nodes in depth columns with edges from parentId", () => {
    const tree = buildLineageForest(
      [mk("r", null), mk("c", "r"), mk("g", "c")],
      "r",
    );
    if (!tree) throw new Error("no tree");
    const { items, edges } = layoutLineage(tree, { maxDepth: 3 });
    const wfs = items.filter((i) => i.kind === "workflow");
    expect(wfs).toHaveLength(3);
    const root = wfs.find((i) => i.id === "r");
    const child = wfs.find((i) => i.id === "c");
    const grand = wfs.find((i) => i.id === "g");
    // LR: x increases with depth.
    expect(root?.x).toBe(0);
    expect((child?.x ?? 0) > (root?.x ?? 0)).toBe(true);
    expect((grand?.x ?? 0) > (child?.x ?? 0)).toBe(true);
    expect(root && "isRoot" in root && root.isRoot).toBe(true);
    expect(edges.map((e) => e.id)).toContain("e:r->c");
    expect(edges.map((e) => e.id)).toContain("e:c->g");
  });

  it("collapses dense BRANCH siblings beyond K into a '+N forks' badge", () => {
    // 7 branch children (each with a grandchild → descendantCount > 0).
    const branches = Array.from({ length: 7 }, (_, i) => mk(`k${i}`, "r"));
    const grandkids = Array.from({ length: 7 }, (_, i) => mk(`g${i}`, `k${i}`));
    const tree = buildLineageForest(
      [mk("r", null), ...branches, ...grandkids],
      "r",
    );
    if (!tree) throw new Error("no tree");
    const { items } = layoutLineage(tree, {
      collapseThreshold: 5,
      maxDepth: 3,
    });
    const shownBranches = items.filter(
      (i) => i.kind === "workflow" && i.id.startsWith("k"),
    );
    const badges = items.filter((i) => i.kind === "forkbadge");
    expect(shownBranches).toHaveLength(5);
    expect(badges).toHaveLength(1);
    expect(badges[0].kind === "forkbadge" && badges[0].hiddenCount).toBe(2);
    expect(badges[0].kind === "forkbadge" && badges[0].parentId).toBe("r");
  });

  it("aggregates many LEAF-tip siblings into one leaf cluster", () => {
    const leaves = Array.from({ length: 7 }, (_, i) => mk(`l${i}`, "r"));
    const tree = buildLineageForest([mk("r", null), ...leaves], "r");
    if (!tree) throw new Error("no tree");
    const { items } = layoutLineage(tree, {
      collapseThreshold: 5,
      maxDepth: 3,
    });
    const clusters = items.filter((i) => i.kind === "leafcluster");
    const shownLeaves = items.filter(
      (i) => i.kind === "workflow" && i.id.startsWith("l"),
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind === "leafcluster" && clusters[0].count).toBe(7);
    expect(shownLeaves).toHaveLength(0); // all bucketed into the cluster
    expect(items.filter((i) => i.kind === "forkbadge")).toHaveLength(0);
  });

  it("expands a node's collapsed children when it's in the expanded set", () => {
    const leaves = Array.from({ length: 7 }, (_, i) => mk(`l${i}`, "r"));
    const tree = buildLineageForest([mk("r", null), ...leaves], "r");
    if (!tree) throw new Error("no tree");
    const { items } = layoutLineage(tree, {
      collapseThreshold: 5,
      maxDepth: 3,
      expanded: new Set(["r"]),
    });
    const shownLeaves = items.filter(
      (i) => i.kind === "workflow" && i.id.startsWith("l"),
    );
    expect(shownLeaves).toHaveLength(7); // expanded → no collapse, no cluster
    expect(items.filter((i) => i.kind === "leafcluster")).toHaveLength(0);
    expect(items.filter((i) => i.kind === "forkbadge")).toHaveLength(0);
  });

  it("dims context nodes off the focus path; keeps the current's subtree bright", () => {
    // root → {a, b}; b → c. Focus path = root→b (current = b).
    const tree = buildLineageForest(
      [mk("root", null), mk("a", "root"), mk("b", "root"), mk("c", "b")],
      "root",
    );
    if (!tree) throw new Error("no tree");
    const { items } = layoutLineage(tree, {
      focusPath: new Set(["root", "b"]),
      currentId: "b",
      maxDepth: 3,
    });
    const dim = (id: string) => {
      const it = items.find((i) => i.id === id);
      return it && it.kind === "workflow" && it.dimmed;
    };
    expect(dim("a")).toBe(true); // sibling off the path → dim
    expect(dim("root")).toBe(false); // on the path
    expect(dim("b")).toBe(false); // current
    expect(dim("c")).toBe(false); // under current → context, bright
  });

  it("honours the depth filter (deeper levels omitted)", () => {
    const tree = buildLineageForest(
      [mk("r", null), mk("c", "r"), mk("g", "c")],
      "r",
    );
    if (!tree) throw new Error("no tree");
    const { items } = layoutLineage(tree, { maxDepth: 1 });
    const ids = items.filter((i) => i.kind === "workflow").map((i) => i.id);
    expect(ids).toContain("r");
    expect(ids).toContain("c");
    expect(ids).not.toContain("g"); // depth 2 > maxDepth 1
  });
});
