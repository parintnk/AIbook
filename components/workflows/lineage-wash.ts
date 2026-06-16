import styles from "./lineage.module.css";

const WASHES = [
  styles.tViolet,
  styles.tRose,
  styles.tAmber,
  styles.tTeal,
  styles.tEmerald,
  styles.tIndigo,
];

/**
 * Deterministic thumbnail wash per workflow id (the mockup's `t-*` palette) so a node looks the
 * same across renders without a stored cover image. Pure + React-Flow-free, so importing it (from
 * the eagerly-rendered detail panel) does NOT drag `@xyflow/react` into the non-lazy bundle —
 * `lineage-node.tsx` (which imports React Flow) is reached only via the `dynamic(ssr:false)` graph.
 */
export function washClass(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return WASHES[h % WASHES.length];
}
