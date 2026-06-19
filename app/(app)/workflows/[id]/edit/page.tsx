import { ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PublishBar } from "@/components/workflows/publish-bar";
import { WorkflowEditorSurface } from "@/components/workflows/workflow-editor-surface";
import { WorkflowForm } from "@/components/workflows/workflow-form";
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
      {/* Editor shell (workflow-editor mockup): the editbar carries the inline title,
          autosave indicator, and the publish cluster; metadata tucks into a disclosure;
          the canvas + Doctor own the page below. */}
      <WorkflowForm
        variant="editor"
        professions={professions.map((p) => ({ id: p.id, name: p.name }))}
        allTags={allTags}
        draftId={draft.id}
        professionName={draft.profession?.name ?? null}
        defaultValues={{
          title: draft.title,
          summary: draft.summary ?? "",
          profession_id: draft.profession_id,
          tags: draft.tagIds,
        }}
        actionsSlot={
          <>
            <a
              href="#doctor"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 font-medium text-sm transition-colors hover:bg-accent"
            >
              <ShieldCheck width={15} height={15} aria-hidden="true" />
              <span className="hidden sm:inline">Review with Doctor</span>
            </a>
            <PublishBar
              workflowId={draft.id}
              nodes={nodes}
              outputsByNodeId={outputs}
            />
          </>
        }
      />
      <WorkflowEditorSurface
        workflowId={draft.id}
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
        professionName={draft.profession?.name ?? null}
        skeletonUsedToday={skeletonUsed}
        doctorUsedToday={doctorUsed}
      />
    </div>
  );
}
