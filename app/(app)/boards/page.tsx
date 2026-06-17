import { Bookmark } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyBoardCard, NoBoardsState } from "@/components/boards/board-empty";
import { BoardHeader } from "@/components/boards/board-header";
import { BoardSwitcher } from "@/components/boards/board-switcher";
import styles from "@/components/boards/boards.module.css";
import { NewBoardButton } from "@/components/boards/new-board-dialog";
import { SortableBoardItems } from "@/components/boards/sortable-board-items";
import { getBoard, listBoardItems, listMyBoards } from "@/lib/services/boards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Saved — idea" };

/**
 * Story 8.2 — the Boards management page (FR4 / UX-DR3). Auth-gated (my content): a left switcher
 * rail of my boards + the active board (selected via `?board=<id>`, default = newest) with its
 * editable header (Public/Private toggle + ••• rename/delete + Share + follower stat) and a
 * drag-reorderable, paginated saved-workflow grid. A no-boards user gets a zero-state.
 */
export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/boards");

  const { board: boardParam } = await searchParams;
  const { items: boards, total } = await listMyBoards();

  const heading = (
    <div className={styles.savedhead}>
      <div>
        <h1>
          <span className={styles.ic}>
            <Bookmark width={22} height={22} aria-hidden="true" />
          </span>
          Saved · Boards
        </h1>
        <div className={styles.sub}>
          Collections of bookmarked workflows. Follow boards to get new saves in
          your feed.
        </div>
      </div>
      <NewBoardButton variant="header" />
    </div>
  );

  if (boards.length === 0) {
    return (
      <div>
        {heading}
        <NoBoardsState />
      </div>
    );
  }

  // Resolve the active board: a `?board` target that is genuinely MINE — verified beyond the first
  // switcher page + ownership-gated via getBoard (so a deep-link to a board on a later page still
  // resolves, and the manage UI never targets a public board owned by someone else) — else the
  // newest board (listMyBoards is newest-first).
  const requested = boardParam ? await getBoard(boardParam) : null;
  const ownedRequest =
    requested?.ok && requested.board.isOwner ? requested : null;
  const activeId = ownedRequest
    ? ownedRequest.board.id
    : (boards[0]?.id as string);
  const boardRes = ownedRequest ?? (await getBoard(activeId));
  const itemsRes = await listBoardItems(activeId);

  return (
    <div>
      {heading}
      <div className={styles.layout}>
        <BoardSwitcher boards={boards} total={total} activeId={activeId} />
        <div>
          {boardRes.ok ? (
            <BoardHeader board={boardRes.board} mode="manage" signedIn />
          ) : null}
          {itemsRes.items.length === 0 ? (
            <EmptyBoardCard />
          ) : (
            <SortableBoardItems
              boardId={activeId}
              initialItems={itemsRes.items}
              total={itemsRes.total}
            />
          )}
        </div>
      </div>
    </div>
  );
}
