import { redirect } from "next/navigation";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";
import { getMyHandle } from "@/lib/services/profiles";

export const metadata = { title: "Danger zone — idea" };

export default async function DangerSettingsPage() {
  const handle = await getMyHandle();
  if (!handle) redirect("/sign-in?next=/settings/danger");

  return (
    <div>
      <h2 className="font-heading text-xl font-bold tracking-tight">
        Danger zone
      </h2>
      <p className="mt-2 text-muted-foreground">
        Irreversible actions for your account.
      </p>
      <DeleteAccountButton handle={`@${handle}`} />
    </div>
  );
}
