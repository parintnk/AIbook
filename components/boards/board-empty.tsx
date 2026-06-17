import { Bookmark, Search } from "lucide-react";
import Link from "next/link";
import styles from "./boards.module.css";

/** Story 8.2 — an empty board ("Nothing saved here yet."). Reused on /boards + /boards/[id]. */
export function EmptyBoardCard() {
  return (
    <div className={styles.emptycard}>
      <div className={styles.emptyGlyph}>
        <Bookmark width={28} height={28} aria-hidden="true" />
      </div>
      <h3>Nothing saved here yet</h3>
      <p>
        Save a workflow from anywhere with the bookmark and it lands on this
        board. Saving is a lightweight bookmark — no copy, no edit.
      </p>
      <Link className={styles.explorelink} href="/explore">
        <Search width={16} height={16} aria-hidden="true" />
        Browse Explore
      </Link>
    </div>
  );
}

/** Story 8.2 — the whole-page zero-state when a user has no boards yet (not in the mockup). */
export function NoBoardsState() {
  return (
    <div className={styles.emptycard}>
      <div className={styles.emptyGlyph}>
        <Bookmark width={28} height={28} aria-hidden="true" />
      </div>
      <h3>No boards yet</h3>
      <p>
        Create a board to organize the workflows you save. Make a board public
        so others can follow it and see your new saves.
      </p>
      <Link className={styles.explorelink} href="/explore">
        <Search width={16} height={16} aria-hidden="true" />
        Browse Explore
      </Link>
    </div>
  );
}
