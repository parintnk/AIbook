"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { forkWorkflowAction } from "@/app/(app)/workflows/actions";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { descendantCount, type LineageTreeNode } from "@/lib/lineage";
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

/**
 * The right detail panel (the mockup's `<aside class="detail">`) for the selected lineage node:
 * eyebrow, ancestry breadcrumb (root → … → here), thumb, title, author, "Forked from @x", stats
 * (forks of this node + worked %), ministats (direct children + descendants), the "Forked into"
 * direct-children list, and the actions (Open workflow + Fork this). Hidden < 1180px (the graph
 * collapses to one pane); the list view carries the same info on mobile.
 */
export function LineageDetailPanel({
  selected,
  path,
  isCurrent,
  signedIn,
}: {
  selected: LineageTreeNode;
  path: LineageTreeNode[];
  isCurrent: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const parent = path.length >= 2 ? path[path.length - 2] : null;
  const children = selected.children;
  const descendants = descendantCount(selected);
  const worked =
    selected.triedCount > 0 ? Math.round(selected.workedScore * 100) : null;
  const isDraft = selected.status === "draft";
  const openHref = isDraft
    ? `/workflows/${selected.id}/edit`
    : `/workflows/${selected.id}`;

  function fork() {
    if (isPending) return;
    startTransition(async () => {
      const res = await forkWorkflowAction(selected.id);
      if (res.ok) {
        toast("Forked. Editing your copy.");
        router.push(`/workflows/${res.forkId}/edit`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <aside className={styles.detail} aria-label="Selected workflow details">
      <div className={styles.dHead}>
        <span className={styles.dEyebrow}>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8Z" />
          </svg>
          {isCurrent ? "Selected node · you are here" : "Selected node"}
        </span>

        {path.length > 1 ? (
          <nav className={styles.ancestry} aria-label="Ancestry">
            {path.map((n, i) => (
              <span key={n.id} style={{ display: "contents" }}>
                <span
                  className={cn(
                    styles.crumb,
                    i === path.length - 1 && styles.crumbCur,
                  )}
                >
                  <ProfileAvatar
                    avatarUrl={n.author?.avatar_url ?? null}
                    displayName={n.author?.display_name ?? null}
                    handle={n.author?.handle ?? "?"}
                    className="size-4 text-[7px]"
                  />
                  @{n.author?.handle ?? "unknown"}
                </span>
                {i < path.length - 1 ? (
                  <span className={styles.crumbArr}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                ) : null}
              </span>
            ))}
          </nav>
        ) : null}

        <div className={cn(styles.dThumb, washClass(selected.id))}>
          <span className={styles.thumbTag}>
            {isDraft ? "draft" : "output"}
          </span>
        </div>
        <div className={styles.dTitle}>{selected.title}</div>
        <div className={styles.dAuthor}>
          <ProfileAvatar
            avatarUrl={selected.author?.avatar_url ?? null}
            displayName={selected.author?.display_name ?? null}
            handle={selected.author?.handle ?? "?"}
            className="size-[34px] text-xs"
          />
          <div>
            <div className={styles.dAuthorName}>
              {selected.author?.display_name ?? `@${selected.author?.handle}`}
            </div>
            {selected.author?.display_name ? (
              <div className={styles.dAuthorRole}>
                @{selected.author.handle}
              </div>
            ) : null}
          </div>
        </div>
        {parent?.author?.handle ? (
          <div className={styles.forkedfrom}>
            <ForkGlyph className="size-3.5" />
            Forked from{" "}
            <Link
              href={`/workflows/${parent.id}`}
              className="contents hover:underline"
            >
              <b>@{parent.author.handle}</b>
            </Link>
          </div>
        ) : null}
      </div>

      <div className={styles.dBody}>
        <div className={styles.statsrow}>
          <div className={styles.statcard}>
            <div className={styles.statV}>
              <ForkGlyph className="size-[15px]" />
              <span className={styles.mono}>{selected.forkCount}</span>
            </div>
            <div className={styles.statK}>forks of this node</div>
          </div>
          <div className={styles.statcard}>
            <div
              className={cn(styles.statV, worked !== null && styles.statVok)}
            >
              {worked !== null ? (
                <>
                  <svg
                    width="15"
                    height="15"
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
                  <span className={styles.mono}>{worked}%</span>
                </>
              ) : (
                <span className={styles.mono}>—</span>
              )}
            </div>
            <div className={styles.statK}>worked</div>
          </div>
        </div>

        <div className={styles.ministats}>
          <div className={styles.ministat}>
            <b className={styles.mono}>{children.length}</b>
            <span>direct children</span>
          </div>
          <div className={styles.miniDivider} />
          <div className={styles.ministat}>
            <b className={styles.mono}>{descendants}</b>
            <span>descendants</span>
          </div>
        </div>

        {children.length > 0 ? (
          <div className={styles.descend}>
            <div className={styles.descendTitle}>Forked into</div>
            {children.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={
                  c.status === "draft"
                    ? `/workflows/${c.id}/edit`
                    : `/workflows/${c.id}`
                }
                className={styles.drow}
              >
                <ProfileAvatar
                  avatarUrl={c.author?.avatar_url ?? null}
                  displayName={c.author?.display_name ?? null}
                  handle={c.author?.handle ?? "?"}
                  className="size-5 text-[8px]"
                />
                <span className={styles.handle}>@{c.author?.handle}</span> ·{" "}
                {c.title}
                <span className={styles.drowFk}>
                  <b className={styles.mono}>{c.forkCount}</b> forks
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.dFoot}>
        <Link href={openHref} className={cn(styles.btn, styles.btnPrimary)}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {isDraft ? "Edit draft" : "Open workflow"}
        </Link>
        {!isDraft ? (
          signedIn ? (
            <button
              type="button"
              onClick={fork}
              disabled={isPending}
              className={cn(styles.btn, styles.btnGhost)}
            >
              <ForkGlyph className="size-4" />
              {isPending ? "Forking…" : "Fork this"}
            </button>
          ) : (
            <Link
              href={`/sign-in?next=/workflows/${selected.id}`}
              className={cn(styles.btn, styles.btnGhost)}
            >
              <ForkGlyph className="size-4" />
              Sign in to fork
            </Link>
          )
        ) : null}
      </div>
    </aside>
  );
}
