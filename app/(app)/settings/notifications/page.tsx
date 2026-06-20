import { redirect } from "next/navigation";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { getNotificationPrefs } from "@/lib/services/profiles";
import { getCurrentUser } from "@/lib/supabase/user";

export const metadata = { title: "Notifications — idea" };

export default async function NotificationsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/settings/notifications");
  const prefs = await getNotificationPrefs();

  return (
    <div>
      <h2 className="font-heading font-bold text-xl tracking-tight">
        Notifications
      </h2>
      <p className="mt-1 text-muted-foreground">
        Choose which notifications reach your bell. Turn one off and we'll stop
        creating it.
      </p>
      <NotificationPrefsForm initialPrefs={prefs} />
    </div>
  );
}
