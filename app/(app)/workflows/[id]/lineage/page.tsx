import Link from "next/link";
import { notFound } from "next/navigation";
import { LineageView } from "@/components/workflows/lineage-view";
import { getAncestry, getLineageTree } from "@/lib/services/lineage";
import { getPublishedWorkflow } from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const wf = await getPublishedWorkflow(id);
  if (!wf) {
    return { title: "Lineage — idea", robots: { index: false } };
  }
  return { title: `Lineage · ${wf.title} — idea` };
}

/**
 * The lineage tree view (Story 5.3 / FR16 / UX-DR14). Public, anon-readable for a PUBLISHED
 * workflow (a draft/unknown id → notFound via RLS, like the detail page). Resolves the workflow's
 * ancestry to the origin root, then reads the whole tree from that origin (the closure table — ONE
 * indexed query, no recursion), and renders the focus+context graph (centred on this workflow) + the
 * indented a11y list. The descendant-visibility RLS already filters private forks out of the tree.
 */
export default async function LineagePage({ params }: Params) {
  const { id } = await params;

  const [wf, ancestry] = await Promise.all([
    getPublishedWorkflow(id),
    getAncestry(id),
  ]);
  if (!wf) notFound();

  // The origin root = the top of the ancestry chain (depth-desc); the tree is read from there so
  // the focus+context view shows the full lineage, not just this node's subtree.
  const originId = ancestry.length > 0 ? ancestry[0].id : id;
  const nodes = await getLineageTree(originId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <Link
        href={`/workflows/${id}`}
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to workflow
      </Link>

      <LineageView
        nodes={nodes}
        rootId={originId}
        currentId={id}
        ancestryIds={ancestry.map((n) => n.id)}
        signedIn={user != null}
      />
    </div>
  );
}
