import type { Tables } from "@/lib/supabase/database.types";

/**
 * Client-safe types + PURE render/route helpers for the realtime bell panel (Story 9.3).
 * The `notifications` rows are written by Story 9.2's triggers, which denormalize a render
 * payload into `data jsonb` (so the bell renders with zero joins). These helpers turn a row
 * into (a) a route-to-source href and (b) a view descriptor the panel renders — all pure, so
 * they're the local-CI safety net (no DB needed). [Source: 20260627000001_notifications.sql]
 */

export type NotificationRow = Tables<"notifications">;
export type NotificationType = NotificationRow["type"];

/** The denormalized `data jsonb` keys the 9.2 triggers write (all defensive-optional). */
export type NotificationData = {
  actor_handle?: string | null;
  actor_name?: string | null;
  actor_avatar?: string | null;
  source_workflow_title?: string | null;
  source_workflow_id?: string | null;
  fork_id?: string | null;
  comment_snippet?: string | null;
  workflow_id?: string | null;
  comment_id?: string | null;
  workflow_title?: string | null;
  community_slug?: string | null;
  community_name?: string | null;
};

/** A tab is "all" or one notification type. */
export type NotificationTab = "all" | NotificationType;

/** The render descriptor the panel row consumes (kept pure + testable). */
export type NotificationView = {
  id: string;
  type: NotificationType;
  /** featured/pin carry no actor in `data` → a system glyph, not an avatar. */
  isSystem: boolean;
  actorHandle: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  /** "@handle" when present, else the display name, else null (system rows). */
  actorLabel: string | null;
  /** The verb phrase between actor and target, e.g. "forked", "commented:". */
  message: string;
  /** A quoted comment excerpt (comment rows only). */
  snippet: string | null;
  /** The emphasized target (workflow / community title). */
  targetLabel: string | null;
  /** "worked" tints the row's verb emerald (matches the mockup). */
  tone: "default" | "worked";
  /** Where tapping the row routes (route-to-source). */
  href: string;
  unread: boolean;
  createdAt: string;
};

/** Safely read the denormalized `data` object (jsonb can be null/array/scalar). */
function asData(n: NotificationRow): NotificationData {
  const d = n.data;
  return d && typeof d === "object" && !Array.isArray(d)
    ? (d as NotificationData)
    : {};
}

export function isUnread(n: NotificationRow): boolean {
  return n.read_at === null;
}

export function unreadCount(list: readonly NotificationRow[]): number {
  return list.reduce((acc, n) => acc + (isUnread(n) ? 1 : 0), 0);
}

/**
 * Route-to-source (AC2). Each type points at the destination its `data` describes;
 * a missing field degrades to /explore rather than a broken link.
 * - follow → the follower's profile · comment/mention → the workflow (target_id is the comment)
 * - fork/featured/worked/pin → the workflow (target_id is that workflow)
 */
export function notificationHref(n: NotificationRow): string {
  const d = asData(n);
  switch (n.type) {
    case "follow":
      return d.actor_handle ? `/u/${d.actor_handle}` : "/explore";
    case "comment":
    case "mention":
      return d.workflow_id ? `/workflows/${d.workflow_id}` : "/explore";
    default:
      // fork · featured · worked · pin — target_id is the workflow.
      return n.target_id ? `/workflows/${n.target_id}` : "/explore";
  }
}

/** The actor display label: "@handle" preferred, then name, else null (system rows). */
function actorLabel(d: NotificationData): string | null {
  if (d.actor_handle) return `@${d.actor_handle}`;
  if (d.actor_name) return d.actor_name;
  return null;
}

/** Turn a row into the panel's render descriptor (pure). */
export function notificationView(n: NotificationRow): NotificationView {
  const d = asData(n);
  const base = {
    id: n.id,
    type: n.type,
    actorHandle: d.actor_handle ?? null,
    actorName: d.actor_name ?? null,
    actorAvatar: d.actor_avatar ?? null,
    actorLabel: actorLabel(d),
    snippet: null as string | null,
    targetLabel: null as string | null,
    tone: "default" as "default" | "worked",
    href: notificationHref(n),
    unread: isUnread(n),
    createdAt: n.created_at,
    isSystem: false,
  };

  switch (n.type) {
    case "follow":
      return { ...base, message: "started following you" };
    case "fork":
      return {
        ...base,
        message: "forked",
        targetLabel: d.source_workflow_title ?? "your workflow",
      };
    case "comment":
      return {
        ...base,
        message: "commented:",
        snippet: d.comment_snippet ?? null,
      };
    case "mention":
      return { ...base, message: "mentioned you in a thread" };
    case "worked":
      return {
        ...base,
        message: "marked",
        targetLabel: d.workflow_title ?? "your workflow",
        tone: "worked",
      };
    case "featured":
      return {
        ...base,
        isSystem: true,
        message: "Featured as Workflow of the Day:",
        targetLabel: d.workflow_title ?? "your workflow",
      };
    case "pin":
      return {
        ...base,
        isSystem: true,
        message: "Your workflow was pinned to",
        targetLabel: d.community_name ?? "the canon",
      };
    default:
      return { ...base, message: "" };
  }
}

/** The tabs shown, in mockup order — only those present in the list (plus All). */
const TAB_ORDER: NotificationType[] = [
  "mention",
  "comment",
  "fork",
  "follow",
  "worked",
  "featured",
  "pin",
];

/** Per-tab counts for the filter chips (`all` + each type present), in TAB_ORDER. */
export function typeCounts(
  list: readonly NotificationRow[],
): Array<{ tab: NotificationTab; count: number }> {
  const counts = new Map<NotificationType, number>();
  for (const n of list) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  const tabs: Array<{ tab: NotificationTab; count: number }> = [
    { tab: "all", count: list.length },
  ];
  for (const t of TAB_ORDER) {
    const c = counts.get(t);
    if (c) tabs.push({ tab: t, count: c });
  }
  return tabs;
}

/** Filter the cached list by tab (pure; `all` is identity). */
export function filterByType(
  list: readonly NotificationRow[],
  tab: NotificationTab,
): NotificationRow[] {
  return tab === "all" ? [...list] : list.filter((n) => n.type === tab);
}
