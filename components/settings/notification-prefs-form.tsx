"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveNotificationPrefsAction } from "@/app/(app)/settings/notifications/actions";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_LABELS,
  NOTIFICATION_TYPES,
  type NotificationPrefs,
  type NotificationType,
} from "@/lib/notification-prefs";

/**
 * Per-type notification toggles (Settings → Notifications). Each switch saves immediately
 * (optimistic; reverts + toasts on failure). Muted types are skipped by the create_notification
 * RPC, so they never reach your bell.
 */
export function NotificationPrefsForm({
  initialPrefs,
}: {
  initialPrefs: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [isPending, startTransition] = useTransition();

  function toggle(type: NotificationType, value: boolean) {
    const next = { ...prefs, [type]: value };
    setPrefs(next);
    startTransition(async () => {
      const res = await saveNotificationPrefsAction(next);
      if (!res.ok) {
        setPrefs((p) => ({ ...p, [type]: !value }));
        toast.error("Couldn't save. Please try again.");
      }
    });
  }

  return (
    <ul className="mt-6 flex flex-col divide-y divide-border rounded-2xl border border-border">
      {NOTIFICATION_TYPES.map((type) => {
        const { title, desc } = NOTIFICATION_LABELS[type];
        return (
          <li key={type} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground text-sm">{title}</p>
              <p className="text-muted-foreground text-xs">{desc}</p>
            </div>
            <Switch
              checked={prefs[type]}
              onCheckedChange={(v) => toggle(type, v)}
              disabled={isPending}
              aria-label={title}
            />
          </li>
        );
      })}
    </ul>
  );
}
