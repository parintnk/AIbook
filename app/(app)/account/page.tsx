import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Your account — idea" };

/**
 * Placeholder protected page. The middleware already redirects unauthenticated
 * requests; this server-side `getUser()` guard is defense-in-depth (never trust
 * routing alone for authz). The real account UI arrives in later stories.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center px-6 py-16">
      <div className="glass rounded-card p-8">
        <h1 className="font-heading text-2xl font-extrabold">Your account</h1>
        <p className="mt-2 text-muted-foreground">
          Signed in as <span className="text-foreground">{user.email}</span>.
        </p>
        <Link
          href="/settings/profile"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        >
          Edit profile
        </Link>
      </div>
    </main>
  );
}
