import { Workflow } from "lucide-react";
import { redirect } from "next/navigation";
import { WorkflowForm } from "@/components/workflows/workflow-form";
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
    <div className="mx-auto max-w-2xl">
      {/* Editbar-style header (mockup brand mark + title). */}
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] text-white shadow-[0_8px_20px_rgba(109,94,240,0.28)]">
          <Workflow width={22} height={22} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading font-bold text-xl tracking-tight">
            New workflow
          </h1>
          <p className="mt-0.5 text-muted-foreground text-sm">
            Start a private draft — build the recipe and publish it later.
          </p>
        </div>
      </div>
      <div className="mt-7">
        <WorkflowForm
          professions={professions.map((p) => ({ id: p.id, name: p.name }))}
          allTags={allTags}
        />
      </div>
    </div>
  );
}
