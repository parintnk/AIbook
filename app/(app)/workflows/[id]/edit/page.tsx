import { notFound, redirect } from "next/navigation";
import { PublishBar } from "@/components/workflows/publish-bar";
import { WorkflowEditorSurface } from "@/components/workflows/workflow-editor-surface";
import { WorkflowForm } from "@/components/workflows/workflow-form";
import { listOutputViewsForWorkflow } from "@/lib/services/node-outputs";
import { listProfessions } from "@/lib/services/professions";
import { listTags } from "@/lib/services/tags";
import { listEdges } from "@/lib/services/workflow-edges";
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

  const [professions, allTags, nodes, edges, outputs] = await Promise.all([
    listProfessions(),
    listTags(),
    listDraftNodes(id),
    listEdges(id),
    listOutputViewsForWorkflow(id),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            Edit draft
          </h1>
          <p className="mt-1 text-muted-foreground">
            Update the basics, then build the recipe step by step.
          </p>
        </div>
        <PublishBar
          workflowId={draft.id}
          nodes={nodes}
          outputsByNodeId={outputs}
        />
      </div>
      <div className="mt-8">
        <WorkflowForm
          professions={professions.map((p) => ({ id: p.id, name: p.name }))}
          allTags={allTags}
          draftId={draft.id}
          defaultValues={{
            title: draft.title,
            summary: draft.summary ?? "",
            profession_id: draft.profession_id,
            tags: draft.tagIds,
          }}
        />
      </div>
      <WorkflowEditorSurface
        workflowId={draft.id}
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
      />
    </div>
  );
}
