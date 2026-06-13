/**
 * Shared navigation config + active-state logic, so the top nav and the bottom
 * tab bar agree on destinations and which route counts as "active" — no
 * per-component drift.
 */

/** Primary destinations shown in the desktop top nav. */
export const PRIMARY_NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/communities", label: "Communities" },
  { href: "/forked", label: "Forked" },
  { href: "/boards", label: "Saved" },
] as const;

/**
 * Is `href` the active route for the current `pathname`? Sub-routes count as
 * active (e.g. `/boards/123` activates `/boards`). Pass `exact` for roots like
 * `/` or `/me` that would otherwise match every nested path.
 */
export function isActivePath(
  pathname: string,
  href: string,
  exact = false,
): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
