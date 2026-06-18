/**
 * Client-safe follow types (Story 9.1). No `server-only` / `next/*` imports so a client component
 * (the follow-list dialog, the follow button) can import these. The runtime queries live in
 * `lib/services/follows.ts` (server-only). Mirrors the `lib/explore.ts` server/client split.
 */

/** A user row in the Followers / Following list — avatar + name + @handle + profession + my follow state. */
export type ProfileCardData = {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  professionName: string | null;
  /** Whether the SIGNED-IN viewer follows this user (so the list can offer Follow-back). */
  isFollowing: boolean;
};
