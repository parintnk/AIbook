"use server";

import { revalidatePath } from "next/cache";
import type { NotificationPrefs } from "@/lib/notification-prefs";
import { updateNotificationPrefs } from "@/lib/services/profiles";

export async function saveNotificationPrefsAction(
  prefs: NotificationPrefs,
): Promise<{ ok: boolean }> {
  const res = await updateNotificationPrefs(prefs);
  if (res.ok) revalidatePath("/settings/notifications");
  return { ok: res.ok };
}
