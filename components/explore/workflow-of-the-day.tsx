import {
  ArrowRight,
  Check,
  GitFork,
  LayoutGrid,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { SaveButton } from "@/components/workflows/save-button";
import { WorkflowThumb } from "@/components/workflows/workflow-thumb";
import { thumbLabel, workedPct } from "@/lib/explore";
import type { WotdData } from "@/lib/services/featured";
import styles from "./featured.module.css";

/**
 * The "Workflow of the Day" hero (Story 6.3 / FR5 / UX-DR16) — a prominent featured card
 * that prepends the Explore home + a profession community page on a profession-of-the-day
 * rotation. Server component (static card + links; no client JS). Ports the LOCKED
 * `explore-{light,dark}.html` `.featured` composition; the thumbnail reuses the shared
 * WorkflowThumb (real output preview, else a deterministic wash). Trust row = worked-% +
 * fork + step stats. The Save affordance (Story 8.1) sits beside "Open workflow" — a ghost button
 * that opens the board picker (anon → sign-in). Render this only when `getWorkflowOfTheDay`
 * returns data.
 */
export function WorkflowOfTheDay({
  data,
  signedIn = false,
  initialSaved = false,
}: {
  data: WotdData;
  signedIn?: boolean;
  initialSaved?: boolean;
}) {
  const pct = workedPct(data.workedScore, data.triedCount);
  return (
    <section className={styles.featured} aria-label="Workflow of the day">
      <div className={styles.fthumb}>
        <WorkflowThumb id={data.id} thumb={data.thumb} variant="featured" />
        <span className={styles.ftag}>
          output · {thumbLabel(data.thumb.kind)}
        </span>
      </div>

      <div className={styles.fmeta}>
        <span className={styles.flabel}>
          <Star width={14} height={14} aria-hidden="true" />
          Workflow of the day
        </span>

        {data.professionName && data.professionSlug ? (
          <Link
            href={`/communities/${data.professionSlug}`}
            className={styles.fprof}
          >
            <span className={styles.spark}>
              <Users width={13} height={13} aria-hidden="true" />
            </span>
            Today: {data.professionName}
          </Link>
        ) : null}

        <h3 className={styles.ftitle}>
          <Link href={`/workflows/${data.id}`}>{data.title}</Link>
        </h3>

        {data.authorHandle ? (
          <div className={styles.fauthor}>
            <ProfileAvatar
              avatarUrl={data.authorAvatarUrl}
              displayName={data.authorDisplayName}
              handle={data.authorHandle}
              className={styles.av}
            />
            <div>
              <div className={styles.nm}>
                {data.authorDisplayName ?? `@${data.authorHandle}`}
              </div>
              {data.authorDisplayName ? (
                <div className={styles.sub}>@{data.authorHandle}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.ftrust}>
          {pct !== null ? (
            <span className={styles.tpillOk}>
              <Check
                width={14}
                height={14}
                strokeWidth={2.4}
                aria-hidden="true"
              />
              {pct}% worked
            </span>
          ) : null}
          <span className={styles.tstat}>
            <GitFork width={14} height={14} aria-hidden="true" />
            Forked <b className={styles.mono}>{data.forkCount}×</b>
          </span>
          <span className={styles.tstat}>
            <LayoutGrid width={13} height={13} aria-hidden="true" />
            {data.stepCount} {data.stepCount === 1 ? "step" : "steps"}
          </span>
        </div>

        <div className={styles.factions}>
          <Link href={`/workflows/${data.id}`} className={styles.btnPrimary}>
            <ArrowRight width={16} height={16} aria-hidden="true" />
            Open workflow
          </Link>
          <SaveButton
            workflowId={data.id}
            signedIn={signedIn}
            initialSaved={initialSaved}
          />
        </div>
      </div>
    </section>
  );
}
