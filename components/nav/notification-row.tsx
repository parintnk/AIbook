import {
  AtSign,
  Award,
  Check,
  GitFork,
  MessageCircle,
  Pin,
  UserPlus,
} from "lucide-react";
import type { ComponentType } from "react";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { relativeAgo } from "@/lib/format/verified-age";
import {
  type NotificationType,
  notificationView,
  type NotificationRow as Row,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import styles from "./notifications-bell.module.css";

/** Per-type badge: a lucide glyph + the matching gradient class (mockup .tb-*). */
const TYPE_BADGE: Record<
  NotificationType,
  { Icon: ComponentType<{ size?: number; strokeWidth?: number }>; cls: string }
> = {
  fork: { Icon: GitFork, cls: styles.tbFork },
  comment: { Icon: MessageCircle, cls: styles.tbComment },
  follow: { Icon: UserPlus, cls: styles.tbFollow },
  mention: { Icon: AtSign, cls: styles.tbMention },
  featured: { Icon: Award, cls: styles.tbFeatured },
  worked: { Icon: Check, cls: styles.tbWorked },
  pin: { Icon: Pin, cls: styles.tbPin },
};

/**
 * One notification row (Story 9.3). Renders the 9.2-denormalized payload via the pure
 * `notificationView` — actor avatar + per-type badge + message + relative timestamp; unread
 * rows tint with a dot, realtime arrivals flash (`isNew`). Tapping calls `onSelect` (the parent
 * marks it read + routes to source).
 */
export function NotificationRow({
  row,
  isNew = false,
  onSelect,
}: {
  row: Row;
  isNew?: boolean;
  onSelect: (row: Row) => void;
}) {
  const v = notificationView(row);
  const { Icon, cls } = TYPE_BADGE[v.type];
  const when = relativeAgo(Date.now() - new Date(v.createdAt).getTime());

  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      className={cn(
        styles.nrow,
        v.unread && styles.unread,
        isNew && styles.justnew,
      )}
    >
      <span className={cn(styles.av, v.isSystem && styles.avSys)}>
        {!v.isSystem && (
          <ProfileAvatar
            avatarUrl={v.actorAvatar}
            displayName={v.actorName}
            handle={v.actorHandle ?? "?"}
            className="size-full text-[13px]"
          />
        )}
        <span className={cn(styles.tbadge, cls)}>
          <Icon size={10} strokeWidth={2.4} />
        </span>
      </span>

      <span className={styles.content}>
        <span className={styles.msg}>
          {v.actorLabel ? <b>{v.actorLabel}</b> : null}
          {v.actorLabel ? " " : null}
          {v.message}
          {v.snippet ? ` “${v.snippet}”` : null}
          {v.targetLabel ? (
            <>
              {" "}
              <span className={styles.tgt}>{v.targetLabel}</span>
            </>
          ) : null}
          {v.tone === "worked" ? (
            <>
              {" "}
              <b className={styles.okw}>Tried &amp; Worked</b>
            </>
          ) : null}
        </span>
        <span className={styles.sub}>
          {isNew ? <span className={styles.ntag}>New</span> : null}
          <span className={cn(styles.stamp, styles.mono)}>{when}</span>
        </span>
      </span>

      {v.unread ? <span className={styles.udot} aria-hidden /> : null}
    </button>
  );
}
