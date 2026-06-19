import { Check, Clock, GitFork, Pencil } from "lucide-react";
import Link from "next/link";
import { relativeAgo } from "@/lib/format/verified-age";
import type { MyForkListItem } from "@/lib/services/workflows";
import { cn } from "@/lib/utils";
import styles from "./forks.module.css";
import { WorkflowThumb } from "./workflow-thumb";

/**
 * A "My forks" card (Story 5.2 / FR15) — ported from `myforks-light.html`. The shared WorkflowThumb
 * provides the decorative thumbnail (id-seeded wash, no extra query); a Draft (amber) / Published
 * (emerald) status badge overlays it top-left (the 8.1 sibling-overlay rule). Carries the "Forked
 * from @x" lineage chip, a "Forked N ago" stamp, and the status-branched action (draft → Continue
 * editing, published → Open).
 *
 * ponytail: the mockup's publish-blocked hint + live fork/worked stats + 3-dot overflow menu are
 * omitted — each needs a per-fork query (node-output scan / engagement counts) that `listMyForks`
 * doesn't run. Add them when the list service is enriched.
 */
export function ForkCard({ fork }: { fork: MyForkListItem }) {
  const isDraft = fork.status === "draft";
  const parentHandle = fork.parent?.author?.handle ?? null;
  const ago = relativeAgo(Date.now() - new Date(fork.created_at).getTime());

  return (
    <div className={styles.fkcard}>
      <div className={styles.thumbWrap}>
        <WorkflowThumb id={fork.id} thumb={{ kind: null, url: null }} />
        <span
          className={cn(
            styles.statusbadge,
            isDraft ? styles.statusDraft : styles.statusPub,
          )}
        >
          {isDraft ? (
            <Pencil width={12} height={12} aria-hidden="true" />
          ) : (
            <Check
              width={12}
              height={12}
              strokeWidth={2.4}
              aria-hidden="true"
            />
          )}
          {isDraft ? "Draft" : "Published"}
        </span>
      </div>

      <h2 className={styles.title}>{fork.title}</h2>

      {fork.parent && parentHandle ? (
        <Link href={`/workflows/${fork.parent.id}`} className={styles.lineage}>
          <GitFork width={12} height={12} aria-hidden="true" />
          Forked from <b>@{parentHandle}</b>
        </Link>
      ) : null}

      <div className={styles.fkmeta}>
        <span className={styles.fkago}>
          <Clock width={12} height={12} aria-hidden="true" />
          Forked {ago}
        </span>
      </div>

      <div className={styles.fkact}>
        <Link
          href={
            isDraft ? `/workflows/${fork.id}/edit` : `/workflows/${fork.id}`
          }
          className={cn(
            styles.act,
            isDraft ? styles.actPrimary : styles.actGhost,
          )}
        >
          {isDraft ? (
            <>
              <Pencil width={14} height={14} aria-hidden="true" />
              Continue editing
            </>
          ) : (
            "Open"
          )}
        </Link>
      </div>
    </div>
  );
}
