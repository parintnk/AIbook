import Link from "next/link";
import { redirect } from "next/navigation";
import { ForkCard } from "@/components/workflows/fork-card";
import forks from "@/components/workflows/forks.module.css";
import { listMyForks } from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My forks — idea" };

/**
 * "My forks" (Story 5.2 / FR15 / UX-DR3). The workflows I've forked — draft AND published — each
 * keeping its "Forked from @x" lineage (a link up to the parent). Auth-gated (my content): a draft
 * fork → Edit, a published fork → View. Replaces the Story 1.6 ComingSoon stub (no new route).
 * Cards ported from `myforks-light.html` (the `.forkgrid` + `.fkcard` glass surface).
 */
export default async function ForkedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/forked");

  const list = await listMyForks();

  return (
    <div className={`${forks.forks} mx-auto w-full max-w-[1180px] px-6 py-8`}>
      <div className="mb-7">
        <h1 className="font-heading text-xl font-bold tracking-tight">
          My forks
        </h1>
        <p className="mt-1 text-muted-foreground">
          Workflows you&apos;ve forked — pick up where you left off.
        </p>
      </div>

      {list.length === 0 ? (
        <div className={forks.empty}>
          <p>No forks yet — fork a workflow to make it your own.</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm"
          >
            Explore workflows
          </Link>
        </div>
      ) : (
        <div className={forks.forkgrid}>
          {list.map((fork) => (
            <ForkCard key={fork.id} fork={fork} />
          ))}
        </div>
      )}
    </div>
  );
}
