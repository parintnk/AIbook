/**
 * Lineage tree — client-safe types + pure tree/layout helpers (Story 5.3 / FR16). The data fetch
 * lives in `lib/services/lineage.ts` (server-only); the types + `buildLineageForest` + `layoutLineage`
 * live here so the client graph/list components can import them (a `server-only` module can't be
 * imported into a client component). All pure → unit-tested.
 */

/** A workflow rendered as a node in the lineage tree. `depth` is the distance from the queried
 * root (0 = root); `parentId` is the immediate fork edge (`workflows.parent_id`). */
export type LineageNode = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  forkCount: number;
  workedScore: number;
  triedCount: number;
  depth: number;
  parentId: string | null;
  author: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** A lineage node with its visible children nested (built from depth + parentId). */
export type LineageTreeNode = LineageNode & { children: LineageTreeNode[] };

/**
 * Build the nested tree (root → visible children) from the flat depth-ordered nodes. Edges come
 * from each node's `parentId` (the immediate fork edge), NOT from `depth` (a depth-2 node is a
 * descendant of the root but a child of some depth-1 node). A node whose `parentId` isn't in the
 * visible set attaches to the root (defensive — a private/deleted mid-tree ancestor; UNREACHABLE in
 * v1 since forking is published-only and there's no published-delete path). Returns null if the
 * root node isn't present (an unreadable/unpublished root).
 */
export function buildLineageForest(
  nodes: LineageNode[],
  rootId: string,
): LineageTreeNode | null {
  const byId = new Map<string, LineageTreeNode>();
  for (const n of nodes) byId.set(n.id, { ...n, children: [] });
  const root = byId.get(rootId);
  if (!root) return null;
  for (const node of byId.values()) {
    if (node.id === rootId) continue;
    const parent =
      node.parentId && node.parentId !== node.id
        ? byId.get(node.parentId)
        : undefined;
    (parent ?? root).children.push(node);
  }
  for (const node of byId.values()) {
    node.children.sort((a, b) => a.title.localeCompare(b.title));
  }
  return root;
}

/** Find a node by id anywhere in the forest. */
export function findLineageNode(
  root: LineageTreeNode,
  id: string,
): LineageTreeNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findLineageNode(c, id);
    if (hit) return hit;
  }
  return null;
}

/** The path from the root down to `id` (inclusive), root-first — the ancestry breadcrumb. */
export function lineagePath(
  root: LineageTreeNode,
  id: string,
): LineageTreeNode[] {
  if (root.id === id) return [root];
  for (const c of root.children) {
    const sub = lineagePath(c, id);
    if (sub.length) return [root, ...sub];
  }
  return [];
}

/** Count all descendants of a node (its subtree size minus itself). */
export function descendantCount(node: LineageTreeNode): number {
  let n = 0;
  for (const c of node.children) n += 1 + descendantCount(c);
  return n;
}

// ============================================================ LAYOUT

export type LayoutDirection = "LR" | "TB";
export type LayoutSort = "top" | "worked" | "author";

export type LayoutAvatar = {
  handle: string;
  avatarUrl: string | null;
  displayName: string | null;
};

export type LayoutItem =
  | {
      id: string;
      kind: "workflow";
      node: LineageTreeNode;
      depth: number;
      x: number;
      y: number;
      dimmed: boolean;
      isRoot: boolean;
      isCurrent: boolean;
    }
  | {
      id: string;
      kind: "forkbadge";
      hiddenCount: number;
      parentId: string;
      depth: number;
      x: number;
      y: number;
    }
  | {
      id: string;
      kind: "leafcluster";
      count: number;
      avatars: LayoutAvatar[];
      depth: number;
      x: number;
      y: number;
    };

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  dashed: boolean;
  focus: boolean;
};

export type LineageLayout = {
  items: LayoutItem[];
  edges: LayoutEdge[];
};

const COL = 256; // x step per depth (node 194 + gap)
const ROW = 172; // y step per sibling row

/** The default collapse threshold K (UX-DR14 / Story 5.3 Q5) — a node with more than K visible
 * children renders the first K + a "+N forks" badge. */
export const DEFAULT_COLLAPSE_THRESHOLD = 5;
/** The default depth filter ("Show depth: 3", Q5). */
export const DEFAULT_MAX_DEPTH = 3;

function sortComparator(
  sort: LayoutSort,
): (a: LineageTreeNode, b: LineageTreeNode) => number {
  if (sort === "worked")
    return (a, b) => b.workedScore - a.workedScore || b.forkCount - a.forkCount;
  if (sort === "author")
    return (a, b) =>
      (a.author?.handle ?? "").localeCompare(b.author?.handle ?? "");
  // "top" — by fork count, then title (stable).
  return (a, b) => b.forkCount - a.forkCount || a.title.localeCompare(b.title);
}

/** Collect the id of `targetId` and all its descendants within the forest. */
function subtreeIds(root: LineageTreeNode, targetId: string): Set<string> {
  const out = new Set<string>();
  const find = (n: LineageTreeNode): LineageTreeNode | null => {
    if (n.id === targetId) return n;
    for (const c of n.children) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  const node = find(root);
  if (!node) return out;
  const walk = (n: LineageTreeNode) => {
    out.add(n.id);
    for (const c of n.children) walk(c);
  };
  walk(node);
  return out;
}

/**
 * Tidy left-to-right (or top-down) tree layout with focus+context dimming + "+N forks" collapse
 * (AC1/AC2). Columns by depth; sibling rows assigned post-order (a parent centres on its shown
 * children). `focusPath` (the root→current ancestry) + the current's subtree stay bright; everything
 * else dims (the mockup's context recede). A node with > `collapseThreshold` children renders the
 * first K (by `sort`) + a "+N forks" badge node. `maxDepth` bounds the rendered depth (the depth
 * filter / lazy-load). Pure — no React Flow types so it unit-tests cleanly.
 */
export function layoutLineage(
  root: LineageTreeNode,
  opts: {
    direction?: LayoutDirection;
    maxDepth?: number;
    collapseThreshold?: number;
    focusPath?: Set<string>;
    currentId?: string;
    sort?: LayoutSort;
    expanded?: Set<string>;
  } = {},
): LineageLayout {
  const direction = opts.direction ?? "LR";
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const collapseThreshold =
    opts.collapseThreshold ?? DEFAULT_COLLAPSE_THRESHOLD;
  const focusPath = opts.focusPath ?? new Set<string>();
  const expanded = opts.expanded ?? new Set<string>();
  const cmp = sortComparator(opts.sort ?? "top");

  const bright = new Set(focusPath);
  if (opts.currentId)
    for (const id of subtreeIds(root, opts.currentId)) bright.add(id);
  const hasFocus = focusPath.size > 0;

  const items: LayoutItem[] = [];
  const edges: LayoutEdge[] = [];
  let nextRow = 0;

  function visit(node: LineageTreeNode, depth: number): number {
    const allChildren = depth >= maxDepth ? [] : [...node.children].sort(cmp);
    const isExpanded = expanded.has(node.id);
    // Leaf tips (0 descendants) aggregate into a cluster (the mockup's "N small forks · leaf
    // tips"); branches (carry the tree forward) stay as nodes — the lineage spine.
    const branches = allChildren.filter((c) => c.children.length > 0);
    const leaves = allChildren.filter((c) => c.children.length === 0);

    let shown: LineageTreeNode[];
    let badgeHidden = 0; // generic "+N forks" overflow (branch-heavy collapse)
    let clusterLeaves: LineageTreeNode[] | null = null;

    if (isExpanded || allChildren.length <= collapseThreshold) {
      shown = allChildren; // no collapse — render every child as a node
    } else if (leaves.length > collapseThreshold) {
      // Many leaf tips → aggregate them into one cluster; keep the branch spine (capped at K).
      shown = branches.slice(0, collapseThreshold);
      badgeHidden = branches.length - shown.length;
      clusterLeaves = leaves;
    } else {
      // Few leaves → generic collapse: show the first K children, "+N forks" the rest.
      shown = allChildren.slice(0, collapseThreshold);
      badgeHidden = allChildren.length - shown.length;
    }

    const childRows: number[] = [];
    for (const c of shown) {
      childRows.push(visit(c, depth + 1));
      edges.push({
        id: `e:${node.id}->${c.id}`,
        source: node.id,
        target: c.id,
        dashed: false,
        focus: bright.has(node.id) && bright.has(c.id),
      });
    }

    const extraRows: number[] = [];

    if (clusterLeaves) {
      const clusterRow = nextRow++;
      extraRows.push(clusterRow);
      const clusterId = `cluster:${node.id}`;
      edges.push({
        id: `e:${node.id}->${clusterId}`,
        source: node.id,
        target: clusterId,
        dashed: true,
        focus: false,
      });
      items.push({
        id: clusterId,
        kind: "leafcluster",
        count: clusterLeaves.length,
        avatars: clusterLeaves.slice(0, 3).map((c) => ({
          handle: c.author?.handle ?? "?",
          avatarUrl: c.author?.avatar_url ?? null,
          displayName: c.author?.display_name ?? null,
        })),
        depth: depth + 1,
        x: 0,
        y: clusterRow,
      });
    }

    if (badgeHidden > 0) {
      const badgeRow = nextRow++;
      extraRows.push(badgeRow);
      const badgeId = `badge:${node.id}`;
      edges.push({
        id: `e:${node.id}->${badgeId}`,
        source: node.id,
        target: badgeId,
        dashed: true,
        focus: false,
      });
      items.push({
        id: badgeId,
        kind: "forkbadge",
        hiddenCount: badgeHidden,
        parentId: node.id,
        depth: depth + 1,
        x: 0,
        y: badgeRow,
      });
    }

    const rows = [...childRows, ...extraRows];
    const row =
      rows.length > 0 ? (rows[0] + rows[rows.length - 1]) / 2 : nextRow++;

    items.push({
      id: node.id,
      kind: "workflow",
      node,
      depth,
      x: 0,
      y: row,
      dimmed: hasFocus && !bright.has(node.id),
      isRoot: depth === 0,
      isCurrent: node.id === opts.currentId,
    });
    return row;
  }

  visit(root, 0);

  // Map (depth, row) → pixels per direction (rows were assigned into `y` during the walk).
  for (const it of items) {
    const row = it.y;
    if (direction === "LR") {
      it.x = it.depth * COL;
      it.y = row * ROW;
    } else {
      it.x = row * (COL - 20);
      it.y = it.depth * (ROW + 40);
    }
  }

  return { items, edges };
}
