import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { workedPct } from "@/lib/explore";
import type { LineageTreeNode } from "@/lib/lineage";
import { cn } from "@/lib/utils";

const COLLAPSE_K = 5;

/**
 * The indented lineage tree (Story 5.3 / AC1, AC2) — the SSR'd, screen-reader-first representation
 * of the fork tree (the a11y/mobile/crawler primary; the React Flow graph is the ≥md enhancement,
 * per the Epic-3 list-first pattern). A nested `<ul>`; each row links to the workflow. The root is
 * tagged "Origin", the current workflow "You are here". Dense sibling sets collapse into a native
 * `<details>` "+N more forks" (no client JS). Pure server component.
 */
export function LineageTreeList({
  forest,
  currentId,
}: {
  forest: LineageTreeNode;
  currentId: string;
}) {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      <TreeRow node={forest} currentId={currentId} isRoot />
    </ul>
  );
}

function TreeRow({
  node,
  currentId,
  isRoot = false,
}: {
  node: LineageTreeNode;
  currentId: string;
  isRoot?: boolean;
}) {
  const isCurrent = node.id === currentId;
  const isDraft = node.status === "draft";
  const href = isDraft ? `/workflows/${node.id}/edit` : `/workflows/${node.id}`;
  const worked = workedPct(node.workedScore, node.triedCount);
  const shown = node.children.slice(0, COLLAPSE_K);
  const overflow = node.children.slice(COLLAPSE_K);

  return (
    <li>
      <div
        className={cn(
          "glass flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5",
          isCurrent && "ring-2 ring-ring/50",
        )}
      >
        <ProfileAvatar
          avatarUrl={node.author?.avatar_url ?? null}
          displayName={node.author?.display_name ?? null}
          handle={node.author?.handle ?? "?"}
          className="size-7 shrink-0 text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={href}
              className="truncate font-medium text-sm hover:text-foreground hover:underline"
            >
              {node.title}
            </Link>
            {isRoot ? (
              <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-[10px] text-ring uppercase tracking-wide">
                Origin
              </span>
            ) : null}
            {isCurrent ? (
              <span className="rounded-full bg-ring px-2 py-0.5 font-semibold text-[10px] text-white uppercase tracking-wide">
                You are here
              </span>
            ) : null}
            {isDraft ? (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 font-medium text-[10px] text-warning">
                Draft
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
            <span>@{node.author?.handle ?? "unknown"}</span>
            <span aria-hidden="true">·</span>
            <span>
              <b className="font-mono font-semibold text-foreground">
                {node.forkCount}
              </b>{" "}
              forks
            </span>
            {worked !== null ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-success">
                  <span className="font-mono font-semibold">{worked}%</span>{" "}
                  worked
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {node.children.length > 0 ? (
        <ul className="mt-2 ml-3.5 flex flex-col gap-2 border-border/60 border-l pl-3.5">
          {shown.map((c) => (
            <TreeRow key={c.id} node={c} currentId={currentId} />
          ))}
          {overflow.length > 0 ? (
            <li>
              <details className="group">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-medium text-ring text-xs">
                  +{overflow.length} more forks
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {overflow.map((c) => (
                    <TreeRow key={c.id} node={c} currentId={currentId} />
                  ))}
                </ul>
              </details>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}
