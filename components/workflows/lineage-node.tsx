"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import type { LayoutAvatar, LineageNode } from "@/lib/lineage";
import { cn } from "@/lib/utils";
import styles from "./lineage.module.css";
import { washClass } from "./lineage-wash";

function ForkGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="9" r="2.4" />
      <path d="M6 8.4v7.2M8.2 6h4.5a3 3 0 0 1 3 3v.2" />
    </svg>
  );
}

export type LineageFlowNodeData = {
  node: LineageNode;
  isRoot: boolean;
  isCurrent: boolean;
  dimmed: boolean;
  direction: "LR" | "TB";
};
export type LineageFlowNode = Node<LineageFlowNodeData, "lineage">;

export type ForkBadgeNodeData = {
  hiddenCount: number;
  parentId: string;
  direction: "LR" | "TB";
};
export type ForkBadgeFlowNode = Node<ForkBadgeNodeData, "forkBadge">;

export type LeafClusterNodeData = {
  count: number;
  avatars: LayoutAvatar[];
  direction: "LR" | "TB";
};
export type LeafClusterFlowNode = Node<LeafClusterNodeData, "leafCluster">;

const HANDLE = "!size-2 !border-0 !bg-transparent !min-w-0 !min-h-0";

/** The lineage workflow node — a compact glass card (the mockup's `.lnode`). Root = "Origin" tag +
 * crown + glow; current = "You are here" tag + brighter glow; off-focus context nodes dim. */
export function LineageNodeCard({ data }: NodeProps<LineageFlowNode>) {
  const { node, isRoot, isCurrent, dimmed, direction } = data;
  const worked =
    node.triedCount > 0 ? Math.round(node.workedScore * 100) : null;
  const targetPos = direction === "LR" ? Position.Left : Position.Top;
  const sourcePos = direction === "LR" ? Position.Right : Position.Bottom;

  return (
    <div
      className={cn(
        styles.lnode,
        isRoot && styles.lnodeRoot,
        isCurrent && styles.lnodeCurrent,
        dimmed && styles.lnodeDim,
      )}
    >
      <Handle
        type="target"
        position={targetPos}
        isConnectable={false}
        className={HANDLE}
      />
      {isRoot ? (
        <span className={styles.ntag}>
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="#fff"
            aria-hidden="true"
          >
            <path d="M5 16 3 5l5.5 4L12 4l3.5 5L21 5l-2 11z" />
          </svg>
          Origin
        </span>
      ) : isCurrent ? (
        <span className={styles.ntag}>
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8Z" />
          </svg>
          You are here
        </span>
      ) : null}

      <div className={cn(styles.lthumb, washClass(node.id))}>
        <div className={styles.kitMark}>
          <span className={styles.kitBadge}>
            <ForkGlyph className="size-4 text-foreground/70" />
          </span>
        </div>
        <span className={styles.thumbTag}>
          {node.status === "draft" ? "draft" : "output"}
        </span>
      </div>

      <h4 className={styles.nodeTitle}>{node.title}</h4>
      <div className={styles.lauth}>
        <ProfileAvatar
          avatarUrl={node.author?.avatar_url ?? null}
          displayName={node.author?.display_name ?? null}
          handle={node.author?.handle ?? "?"}
          className="size-[18px] text-[8px]"
        />
        <span className={styles.handle}>
          @{node.author?.handle ?? "unknown"}
        </span>
      </div>
      <div className={styles.lfoot}>
        <span className={styles.forkstat}>
          <ForkGlyph className="size-3" />
          <b className={styles.mono}>{node.forkCount}</b> forks
        </span>
        {isRoot ? (
          <span className={styles.crown}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5 16 3 5l5.5 4L12 4l3.5 5L21 5l-2 11z" />
            </svg>
          </span>
        ) : worked !== null ? (
          <span className={cn(styles.forkstat, styles.workedStat)}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {worked}%
          </span>
        ) : null}
      </div>
      <Handle
        type="source"
        position={sourcePos}
        isConnectable={false}
        className={HANDLE}
      />
    </div>
  );
}

/** The collapsed "+N forks" badge node (the mockup's `.forkbadge`) — stands in for dense siblings
 * hidden by the collapse threshold; the stacked-card look implies many nodes behind it. */
export function ForkBadgeNode({ data }: NodeProps<ForkBadgeFlowNode>) {
  const targetPos = data.direction === "LR" ? Position.Left : Position.Top;
  return (
    <div className={styles.forkbadge}>
      <Handle
        type="target"
        position={targetPos}
        isConnectable={false}
        className={HANDLE}
      />
      <div className={styles.fbStack} />
      <div className={styles.fbPill}>
        <span className={styles.fbIc}>
          <ForkGlyph className="size-3.5" />
        </span>
        <span className={cn(styles.fbN, styles.mono)}>+{data.hiddenCount}</span>
        <span className={styles.fbLab}>forks</span>
        <span className={styles.fbChev}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
      <span className={styles.fbHint}>Click to expand</span>
    </div>
  );
}

const LC_SEG_WASHES = [
  styles.tRose,
  styles.tAmber,
  styles.tTeal,
  styles.tEmerald,
  styles.tIndigo,
];

/** The aggregated leaf-tip cluster (the mockup's `.leafcluster`) — many 0-descendant forks bucketed
 * into one segmented tile so a wide fan-out stays legible (UX-DR14 "aggregate leaves"). */
export function LeafClusterNode({ data }: NodeProps<LeafClusterFlowNode>) {
  const targetPos = data.direction === "LR" ? Position.Left : Position.Top;
  const shown = data.avatars.slice(0, 3);
  const more = data.count - shown.length;
  return (
    <div className={styles.leafcluster}>
      <Handle
        type="target"
        position={targetPos}
        isConnectable={false}
        className={HANDLE}
      />
      <div className={styles.lcSeg}>
        {LC_SEG_WASHES.map((w) => (
          <i key={w} className={w} />
        ))}
      </div>
      <div className={styles.lcTitle}>
        <span className={styles.mono}>{data.count}</span> small forks{" "}
        <span className={styles.lcUnit}>· leaf tips</span>
      </div>
      <div className={styles.lcFoot}>
        <div className={styles.lcAvs}>
          {shown.map((a) => (
            <ProfileAvatar
              key={a.handle}
              avatarUrl={a.avatarUrl}
              displayName={a.displayName}
              handle={a.handle}
              className="size-[18px] border border-background text-[7px]"
            />
          ))}
          {more > 0 ? <span className={styles.lcMore}>+{more}</span> : null}
        </div>
        <span className={styles.drill}>
          Drill in
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
