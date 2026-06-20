import type { ActivityCalendar } from "@/lib/services/activity";
import styles from "./profile.module.css";

const LEVEL_CLASS = [
  styles.l0,
  styles.l1,
  styles.l2,
  styles.l3,
  styles.l4,
] as const;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/**
 * The contribution heatmap tile (Story 9.x) — a GitHub-style 53-week calendar of the user's real
 * activity (publishes + comments + outcome votes), ported from profile-{light,dark}.html through
 * the app tokens. Pure render of the service-built `ActivityCalendar`. Title-attributes give each
 * cell an accessible "N on YYYY-MM-DD" tooltip.
 */
export function ProfileHeatmap({ calendar }: { calendar: ActivityCalendar }) {
  return (
    <div className={`${styles.tile} ${styles.heat}`}>
      <div className={styles.heatTop}>
        <div>
          <div className={styles.tileTitle}>Activity</div>
          <div className={styles.heatTotal}>
            <b className="font-mono">{calendar.total}</b> contributions this
            year
          </div>
        </div>
        <div className={styles.heatLegend}>
          Less
          <span className={styles.heatLs}>
            <i className={styles.l0} />
            <i className={styles.l1} />
            <i className={styles.l2} />
            <i className={styles.l3} />
            <i className={styles.l4} />
          </span>
          More
        </div>
      </div>

      <div className={styles.heatScroll}>
        <div className={styles.heatMonths}>
          {calendar.monthLabels.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length column axis, order never changes.
            <span key={i}>{m}</span>
          ))}
        </div>
        <div className={styles.heatBody}>
          <div className={styles.heatDays}>
            {DAY_LABELS.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-row day axis.
              <i key={i}>{d}</i>
            ))}
          </div>
          <div className={styles.heatGrid}>
            {calendar.weeks.map((col, wi) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed week-column axis.
              <div key={wi} className={styles.hcol}>
                {col.map((cell, di) =>
                  cell ? (
                    <i
                      key={cell.date}
                      className={LEVEL_CLASS[cell.level]}
                      title={`${cell.count} on ${cell.date}`}
                    />
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: empty future-day placeholder.
                    <i key={di} className={styles.hempty} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
