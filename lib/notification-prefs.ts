/**
 * The notification types a user can mute (Settings → Notifications). Mirrors the DB
 * `notification_type` enum; the opt-out model means a missing/true value = on. UI metadata lives
 * here so both the settings form and the prefs service share one source.
 */
export const NOTIFICATION_TYPES = [
  "fork",
  "comment",
  "follow",
  "mention",
  "featured",
  "worked",
  "pin",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationPrefs = Record<NotificationType, boolean>;

export const NOTIFICATION_LABELS: Record<
  NotificationType,
  { title: string; desc: string }
> = {
  fork: { title: "Forks", desc: "Someone forks one of your workflows" },
  comment: {
    title: "Comments & replies",
    desc: "Someone comments on or replies to your work",
  },
  follow: { title: "New followers", desc: "Someone follows you" },
  mention: { title: "Mentions", desc: "Someone @mentions you" },
  featured: { title: "Featured", desc: "Your workflow gets featured" },
  worked: {
    title: "Worked votes",
    desc: "Someone marks your workflow as worked",
  },
  pin: { title: "Pins", desc: "A community pins your workflow" },
};

/** Default = everything on; merge a stored partial map over it so missing keys read as enabled. */
export function resolvePrefs(
  stored: Record<string, unknown> | null,
): NotificationPrefs {
  const out = {} as NotificationPrefs;
  for (const t of NOTIFICATION_TYPES) {
    out[t] = stored?.[t] !== false;
  }
  return out;
}
