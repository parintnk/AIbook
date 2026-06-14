import { notFound, redirect } from "next/navigation";
import { WorkflowForm } from "@/components/workflows/workflow-form";
import { WorkflowSteps } from "@/components/workflows/workflow-steps";
import { listProfessions } from "@/lib/services/professions";
import { listDraftNodes } from "@/lib/services/workflow-nodes";
import { getMyDraft } from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit draft — idea" };

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/workflows/${id}/edit`)}`);
  }

  const draft = await getMyDraft(id);
  if (!draft) notFound();

  const [professions, nodes] = await Promise.all([
    listProfessions(),
    listDraftNodes(id),
  ]);

  return (
    <div>
      <h1 className="font-heading text-xl font-bold tracking-tight">
        Edit draft
      </h1>
      <p className="mt-1 text-muted-foreground">
        Update the basics, then build the recipe step by step.
      </p>
      <div className="mt-8">
        <WorkflowForm
          professions={professions.map((p) => ({ id: p.id, name: p.name }))}
          draftId={draft.id}
          defaultValues={{
            title: draft.title,
            summary: draft.summary ?? "",
            profession_id: draft.profession_id,
          }}
        />
      </div>
      <WorkflowSteps workflowId={draft.id} nodes={nodes} />
    </div>
  );
}
