import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/components/workflows/explore.module.css";

/** A section header (icon + title + sub) with an optional "See all →" link (UX-DR17). */
export function SectionHead({
  icon,
  title,
  sub,
  seeAllHref,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  seeAllHref?: string;
}) {
  return (
    <div className={styles.secHead}>
      <div>
        <h2 className={styles.secTitle}>
          <span className={styles.ic}>{icon}</span>
          {title}
        </h2>
        {sub ? <div className={styles.secSub}>{sub}</div> : null}
      </div>
      {seeAllHref ? (
        <Link href={seeAllHref} className={styles.see}>
          See all <ArrowRight width={14} height={14} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
