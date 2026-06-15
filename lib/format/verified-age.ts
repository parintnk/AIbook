const STALE_DAYS = 90;
const MS_PER_DAY = 86_400_000;

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/**
 * The effective "last verified" age for the trust row (Story 3.3 / UX-DR21).
 * `lastVerifiedAt` falls back to `publishedAt` — publishing requires real sample
 * outputs (the 2.5 gate), so the publish IS the initial verification. Returns a
 * "Last verified {relative} ago" label + whether it is older than the 90-day
 * staleness threshold, or null when no date is available (caller omits the element).
 */
export function formatVerifiedAge(
  lastVerifiedAt: string | null,
  publishedAt: string | null,
  now: Date = new Date(),
): { label: string; isStale: boolean } | null {
  const iso = lastVerifiedAt ?? publishedAt;
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const diffMs = now.getTime() - then.getTime();
  const isStale = diffMs > STALE_DAYS * MS_PER_DAY;
  return { label: `Last verified ${relativeAgo(diffMs)}`, isStale };
}

/** Coarse "N units ago" from a millisecond delta; a future/sub-minute delta → "just now". */
function relativeAgo(diffMs: number): string {
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return rtf.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (day < 7) return rtf.format(-day, "day");
  if (day < 30) return rtf.format(-Math.round(day / 7), "week");
  if (day < 365) return rtf.format(-Math.round(day / 30), "month");
  return rtf.format(-Math.round(day / 365), "year");
}
