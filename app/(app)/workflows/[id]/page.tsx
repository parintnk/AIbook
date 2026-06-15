import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { TrustRow } from "@/components/workflows/trust-row";
import { WorkflowViewerSurface } from "@/components/workflows/workflow-viewer-surface";
import { listOutputViewsForWorkflow } from "@/lib/services/node-outputs";
import { listPublishedEdges } from "@/lib/services/workflow-edges";
import { listPublishedNodes } from "@/lib/services/workflow-nodes";
import { getPublishedWorkflow } from "@/lib/services/workflows";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const wf = await getPublishedWorkflow(id);
  // Not-available (draft/removed/unknown) → a not-found-ish title + noindex, so a
  // soft-404 isn't indexed as a real "Workflow" page.
  if (!wf) {
    return { title: "Workflow not available — idea", robots: { index: false } };
  }
  return {
    title: `${wf.title} — idea`,
    description: wf.summary ?? undefined,
  };
}

/**
 * Public workflow detail page (Story 3.1 / FR6). Anyone — signed in or not — can
 * read a PUBLISHED workflow on the read-only React Flow canvas. A draft / unknown /
 * inaccessible id resolves to null via RLS → notFound(). The trust row (3.3), the
 * linear-list + canvas toggle (3.2), skeletons (3.4), and votes/comments/save/fork
 * (Epics 4/8/5) are intentionally NOT here yet — their header slot is reserved.
 */
export default async function WorkflowDetailPage({ params }: Params) {
  const { id } = await params;

  const wf = await getPublishedWorkflow(id);
  if (!wf) notFound();

  const [nodes, edges, outputs] = await Promise.all([
    listPublishedNodes(id),
    listPublishedEdges(id),
    listOutputViewsForWorkflow(id),
  ]);

  const author = wf.author;
  const authorName =
    author?.display_name ?? (author ? `@${author.handle}` : "Unknown");

  return (
    <div>
      <header className="flex flex-col gap-4">
        {wf.profession ? (
          // Plain pill for now — the per-profession landing page is Epic 6/7.
          <span className="self-start rounded-full bg-accent px-2.5 py-0.5 font-medium text-accent-foreground text-xs">
            {wf.profession.name}
          </span>
        ) : null}

        <div>
          <h1 className="font-bold font-heading text-2xl tracking-tight">
            {wf.title}
          </h1>
          {wf.summary ? (
            <p className="mt-2 max-w-2xl text-muted-foreground">{wf.summary}</p>
          ) : null}
        </div>

        {author ? (
          <Link
            href={`/u/${author.handle}`}
            className="flex items-center gap-2.5 self-start"
          >
            <ProfileAvatar
              avatarUrl={author.avatar_url}
              displayName={author.display_name}
              handle={author.handle}
              className="size-8 text-xs"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-medium text-sm">{authorName}</span>
              <span className="text-muted-foreground text-xs">
                @{author.handle}
              </span>
            </span>
          </Link>
        ) : null}

        {/* Read-only trust signals (Story 3.3). Outcome vote (Epic 4) + Save/Fork
            (Epics 8/5) action affordances still land here — reserved. */}
        <TrustRow
          triedCount={wf.tried_count}
          forkCount={wf.fork_count}
          parentId={wf.parent_id}
          lastVerifiedAt={wf.last_verified_at}
          publishedAt={wf.published_at}
        />
      </header>

      <WorkflowViewerSurface
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
      />
    </div>
  );
}
