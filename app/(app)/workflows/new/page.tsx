import { redirect } from "next/navigation";
import { WorkflowForm } from "@/components/workflows/workflow-form";
import { listProfessions } from "@/lib/services/professions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New workflow — idea" };

export default async function NewWorkflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/workflows/new");

  const professions = await listProfessions();

  return (
    <div>
      <h1 className="font-heading text-xl font-bold tracking-tight">
        New workflow
      </h1>
      <p className="mt-1 text-muted-foreground">
        Start a private draft. You can build the recipe and publish it later.
      </p>
      <div className="mt-8">
        <WorkflowForm
          professions={professions.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
