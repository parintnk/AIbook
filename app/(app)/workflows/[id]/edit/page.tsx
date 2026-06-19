import { notFound, redirect } from "next/navigation";
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

  // Full-screen editor on xl: fill the viewport below the 4rem nav, no page scroll
  // (the surface owns its internal layout). Below xl it's a padded, scrollable card.
  return (
    <div className="px-4 py-4 xl:h-[calc(100svh-4rem)] xl:overflow-hidden xl:p-0">
      <WorkflowEditorSurface
        workflowId={draft.id}
        title={draft.title}
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
        professionName={draft.profession?.name ?? null}
        professions={professions.map((p) => ({ id: p.id, name: p.name }))}
        allTags={allTags}
        detailsDefaults={{
          summary: draft.summary ?? "",
          profession_id: draft.profession_id,
          tags: draft.tagIds,
        }}
        skeletonUsedToday={skeletonUsed}
        doctorUsedToday={doctorUsed}
      />
    </div>
  );
}
