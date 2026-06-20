import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile contribution heatmap (Story 9.x dashboard) — a GitHub-style 53-week calendar of a user's
 * OWN real activity: workflows published, comments posted, outcome votes cast (all carry a real
 * timestamp). No new tracking table — three lightweight `created_at` selects over the last year,
 * bucketed by UTC day in JS. ponytail: fetches the year's rows and buckets in-process; at v1 scale
 * (hundreds of events) that's nothing — move to a SQL aggregate RPC only if a power user's year
 * ever returns tens of thousands of rows.
 */

export type HeatCell = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};
export type ActivityCalendar = {
  total: number;
  /** Up to 53 week-columns, each 7 rows (Sun→Sat); cells past today are null (rendered empty). */
  weeks: (HeatCell | null)[][];
  /** Month label per column (the abbreviated month name at the column where the month changes). */
  monthLabels: (string | null)[];
};

const WEEKS = 53;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function level(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export async function getProfileActivity(
  userId: string,
): Promise<ActivityCalendar> {
  // Grid window: back to the Sunday of the week 52 weeks ago, through today (UTC days).
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - today.getUTCDay() - (WEEKS - 1) * 7);
  const startIso = start.toISOString();

  const supabase = await createClient();
  const [pub, comm, votes] = await Promise.all([
    supabase
      .from("workflows")
      .select("published_at")
      .eq("author_id", userId)
      .eq("status", "published")
      .gte("published_at", startIso),
    supabase
      .from("comments")
      .select("created_at")
      .eq("author_id", userId)
      .is("deleted_at", null)
      .gte("created_at", startIso),
    supabase
      .from("outcome_votes")
      .select("created_at")
      .eq("voter_id", userId)
      .gte("created_at", startIso),
  ]);

  const counts = new Map<string, number>();
  const tally = (ts: string | null) => {
    if (!ts) return;
    const k = ts.slice(0, 10);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const r of pub.data ?? []) tally(r.published_at);
  for (const r of comm.data ?? []) tally(r.created_at);
  for (const r of votes.data ?? []) tally(r.created_at);

  const weeks: (HeatCell | null)[][] = [];
  const monthLabels: (string | null)[] = [];
  let total = 0;
  let prevMonth = -1;
  const cursor = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const col: (HeatCell | null)[] = [];
    let colMonth: string | null = null;
    for (let d = 0; d < 7; d++) {
      if (cursor > today) {
        col.push(null);
      } else {
        const key = dayKey(cursor);
        const count = counts.get(key) ?? 0;
        total += count;
        col.push({ date: key, count, level: level(count) });
        if (d === 0) {
          const m = cursor.getUTCMonth();
          if (m !== prevMonth) {
            colMonth = MONTHS[m];
            prevMonth = m;
          }
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(col);
    monthLabels.push(colMonth);
  }

  return { total, weeks, monthLabels };
}
