import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyBoardCard } from "@/components/boards/board-empty";
import { BoardHeader } from "@/components/boards/board-header";
import { BoardItemsView } from "@/components/boards/board-items-view";
import {
  getBoard,
  getSavedWorkflowIds,
  listBoardItems,
} from "@/lib/services/boards";
import { createClient } from "@/lib/supabase/server";

/**
 * Story 8.2 / FR21 — a single board's PUBLIC permalink + follow surface. Public-readable: RLS
 * returns the board only when it is public OR owned by the viewer, so a private board is a 404 for
 * a non-owner. The owner sees a read-only view + a "Manage in Saved →" link (management lives on
 * /boards); a non-owner sees Follow + the follower count. Anon can read a public board (Follow → sign-in).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await getBoard(id);
  if (!res.ok) return { title: "Board not found — idea" };
  return {
    title: `${res.board.name} — idea`,
    // Only public boards are indexable (a private/owner-only board must never be crawled).
    robots: { index: res.board.isPublic, follow: res.board.isPublic },
  };
}

export default async function BoardViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const res = await getBoard(id);
  if (!res.ok) notFound();

  const { items: rawItems, total } = await listBoardItems(id);
  const signedIn = Boolean(user);
  // Thread the viewer's saved-state so an already-saved card shows a filled bookmark — the 8.1
  // saved-state lesson, applied to this NEW card surface (anon → empty set → all unsaved).
  const savedIds = signedIn
    ? await getSavedWorkflowIds(rawItems.map((i) => i.id))
    : new Set<string>();
  const items = rawItems.map((i) => ({ ...i, saved: savedIds.has(i.id) }));

  return (
    <div>
      <BoardHeader board={res.board} mode="view" signedIn={signedIn} />
      {items.length === 0 ? (
        <EmptyBoardCard />
      ) : (
        <BoardItemsView
          boardId={id}
          initialItems={items}
          total={total}
          signedIn={signedIn}
        />
      )}
    </div>
  );
}
