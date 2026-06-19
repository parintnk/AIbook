import { Workflow } from "lucide-react";
import { redirect } from "next/navigation";
import { NewWorkflowDialog } from "@/components/workflows/new-workflow-dialog";
import { listProfessions } from "@/lib/services/professions";
import { listTags } from "@/lib/services/tags";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New workflow — idea" };

export default async function NewWorkflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/workflows/new");

  const [professions, allTags] = await Promise.all([
    listProfessions(),
    listTags(),
  ]);

  return (
    <div className="relative px-4 py-4 xl:h-[calc(100svh-4rem)] xl:overflow-hidden xl:p-0">
      {/* Editor silhouette (decorative) — so /new reads as the editor with the
          create modal on top; the canvas comes alive once the draft exists. */}
      <div
        aria-hidden="true"
        className="flex h-[calc(100svh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card xl:h-full xl:rounded-none xl:border-0"
      >
        <div className="flex shrink-0 items-center gap-4 border-border border-b bg-background/60 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] text-white shadow-[0_6px_18px_rgba(109,94,240,0.35)]">
            <Workflow width={18} height={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] text-muted-foreground">
              Workflows <span className="text-muted-foreground/50">/</span> New
            </div>
            <div className="mt-1.5 h-8 w-[min(340px,60%)] rounded-xl border border-border bg-foreground/[0.03]" />
          </div>
          <div className="h-9 w-24 rounded-md bg-foreground/[0.04]" />
        </div>
        <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_320px]">
          <div
            className="flex min-w-0 items-center justify-center bg-[#f7f9fd] dark:bg-transparent"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(128,128,150,0.18) 1.1px, transparent 1.1px)",
              backgroundSize: "24px 24px",
            }}
          >
            <p className="text-muted-foreground text-sm">
              Your canvas starts once you add the basics →
            </p>
          </div>
          <div className="hidden border-border border-l bg-card xl:block" />
        </div>
      </div>

      <NewWorkflowDialog
        professions={professions.map((p) => ({ id: p.id, name: p.name }))}
        allTags={allTags}
      />
    </div>
  );
}
