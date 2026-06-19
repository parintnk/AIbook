import { notFound, redirect } from "next/navigation";
import { WorkflowDetailsForm } from "@/components/workflows/workflow-details-form";
import { WorkflowEditorSurface } from "@/components/workflows/workflow-editor-surface";
import { getAiUsageToday } from "@/lib/services/ai/rate-limit";
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

  const [
    professions,
    allTags,
    nodes,
    edges,
    outputs,
    skeletonUsed,
    doctorUsed,
  ] = await Promise.all([
    listProfessions(),
    listTags(),
    listDraftNodes(id),
    listEdges(id),
    listOutputViewsForWorkflow(id),
    getAiUsageToday("skeleton"),
    getAiUsageToday("doctor"),
  ]);

  return (
    <div>
      {/* The fused editor surface (workflow-editor mockup): editbar + tool rail +
          canvas + Doctor in one container. Metadata lives in the disclosure below. */}
      <WorkflowEditorSurface
        workflowId={draft.id}
        title={draft.title}
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
        professionName={draft.profession?.name ?? null}
        skeletonUsedToday={skeletonUsed}
        doctorUsedToday={doctorUsed}
      />
      <WorkflowDetailsForm
        workflowId={draft.id}
        professions={professions.map((p) => ({ id: p.id, name: p.name }))}
        allTags={allTags}
        defaultValues={{
          summary: draft.summary ?? "",
          profession_id: draft.profession_id,
          tags: draft.tagIds,
        }}
      />
    </div>
  );
}
