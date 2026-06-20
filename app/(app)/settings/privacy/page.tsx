import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsConsent } from "@/components/settings/analytics-consent";
import { getCurrentUser } from "@/lib/supabase/user";

export const metadata = { title: "Privacy — idea" };

export default async function PrivacySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/settings/privacy");

  return (
    <div>
      <h2 className="font-heading font-bold text-xl tracking-tight">Privacy</h2>
      <p className="mt-1 text-muted-foreground">
        Control analytics and review how your data is used.
      </p>

      <AnalyticsConsent />

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border p-5 text-muted-foreground text-sm">
        <p>
          Your profile and <span className="text-foreground">published</span>{" "}
          recipes are public so others can discover and fork them — drafts stay
          private to you. Manage your public “Hire me” link on your{" "}
          <Link href="/settings/profile" className="text-primary underline">
            Profile
          </Link>{" "}
          settings.
        </p>
        <p>
          Read our{" "}
          <Link href="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          , or permanently remove your account and data from the{" "}
          <Link href="/settings/danger" className="text-primary underline">
            Danger zone
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
