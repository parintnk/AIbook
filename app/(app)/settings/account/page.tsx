import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/settings/account-settings";
import { getCurrentUser } from "@/lib/supabase/user";

export const metadata = { title: "Account — idea" };

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/settings/account");
  const provider =
    (user.app_metadata?.provider as string | undefined) ?? "email";

  return (
    <div>
      <h2 className="font-heading font-bold text-xl tracking-tight">Account</h2>
      <p className="mt-1 text-muted-foreground">
        Manage your sign-in email and password.
      </p>
      <AccountSettings email={user.email ?? ""} provider={provider} />
    </div>
  );
}
