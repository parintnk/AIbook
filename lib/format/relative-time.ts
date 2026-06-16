/**
 * Compact "now" / "2m" / "3h" / "5d" / "2w" / "4mo" / "1y" relative time for comment
 * timestamps (Story 4.2 / UX-DR19 mockup uses the compact form, unlike the trust row's
 * verbose `formatVerifiedAge`). Returns "" for an invalid date.
 */
export function compactAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const sec = Math.round((now.getTime() - then.getTime()) / 1000);
  if (sec < 60) return "now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  if (day < 30) return `${Math.round(day / 7)}w`;
  if (day < 365) return `${Math.round(day / 30)}mo`;
  return `${Math.round(day / 365)}y`;
}
