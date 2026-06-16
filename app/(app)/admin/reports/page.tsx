import { notFound, redirect } from "next/navigation";
import { isModeratorAnywhere, listOpenReports } from "@/lib/services/reports";
import { createClient } from "@/lib/supabase/server";
import { ReportsQueue } from "./reports-queue";

export const metadata = {
  title: "Reports — idea",
  robots: { index: false },
};

/**
 * Founder/moderator reports queue (Story 4.3 / FR14, v1 simple). Mod-guarded: anon → sign-in; a
 * signed-in non-moderator → notFound() (hidden, no access-denied screen per UX-DR21). RLS scopes
 * the list to the caller's moderated professions (the founder mods all → sees everything). The
 * full per-profession mod-queue UI is deferred (Epic 7).
 */
export default async function AdminReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin/reports");
  if (!(await isModeratorAnywhere())) notFound();

  const reports = await listOpenReports();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-bold font-heading text-2xl tracking-tight">
          Reports
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {reports.length} open · most content is auto-gated — these are the
          human-escalated cases.
        </p>
      </header>
      <ReportsQueue reports={reports} />
    </div>
  );
}
