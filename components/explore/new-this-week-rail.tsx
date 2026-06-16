import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import styles from "@/components/workflows/explore.module.css";
import { WorkflowThumb } from "@/components/workflows/workflow-thumb";
import type { WorkflowCardData } from "@/lib/explore";
import { relativeAgo } from "@/lib/format/verified-age";
import { SectionHead } from "./section-head";

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return relativeAgo(Date.now() - then);
}

/** The "New this week" horizontal rail (UX-DR17) — newest published workflows, "See all →" to the full recency feed. */
export function NewThisWeekRail({ items }: { items: WorkflowCardData[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section}>
      <SectionHead
        icon={<Sparkles width={19} height={19} aria-hidden="true" />}
        title="New this week"
        sub="Freshly published recipes, straight from creators."
        seeAllHref="/explore?sort=new"
      />
      <div className={styles.rail}>
        {items.map((w) => {
          const when = ago(w.publishedAt);
          return (
            <Link
              key={w.id}
              href={`/workflows/${w.id}`}
              className={styles.newcard}
            >
              <WorkflowThumb
                id={w.id}
                thumb={w.thumb}
                variant="rail"
                badge={
                  <span className={styles.newtag}>
                    <Plus
                      width={9}
                      height={9}
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    New
                  </span>
                }
              />
              <h3 className={styles.newTitle}>{w.title}</h3>
              <div className={styles.newmeta}>
                <span className={styles.who}>
                  {w.authorHandle ? (
                    <>
                      <ProfileAvatar
                        avatarUrl={w.authorAvatarUrl}
                        displayName={w.authorDisplayName}
                        handle={w.authorHandle}
                        className={styles.av}
                      />
                      <b>@{w.authorHandle}</b>
                    </>
                  ) : null}
                </span>
                {when ? (
                  <span className={`${styles.ago} ${styles.mono}`}>{when}</span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
