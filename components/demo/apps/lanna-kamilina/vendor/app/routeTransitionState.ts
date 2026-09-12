/**
 * Coordinates the commit signal between a navigation's `awaitCommit` call and
 * the `commitReached` call fired once the new route is on screen. Split out
 * of `routeTransition.tsx` so that file exports only the `RouteTransitionRunner`
 * component (required for Fast Refresh to preserve its state across edits).
 */

let pendingCommit: (() => void) | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

/** How long to wait for a route to commit before giving up on the animation. */
const COMMIT_TIMEOUT = 1500;

/**
 * Registers the resolver for the navigation now in flight. A transition that
 * never resolves leaves the page frozen under the overlay, so the timer is not
 * optional — a route can fail to commit for reasons that have nothing to do
 * with this (a redirect, a slow chunk, a click on the current page).
 */
export function awaitCommit(resolve: () => void) {
  clearPending();

  pendingCommit = resolve;
  safetyTimer = setTimeout(() => {
    const commit = pendingCommit;
    pendingCommit = null;
    safetyTimer = null;
    commit?.();
  }, COMMIT_TIMEOUT);
}

/** Called once the new route is on screen. */
export function commitReached() {
  const commit = pendingCommit;
  clearPending();
  commit?.();
}

function clearPending() {
  if (safetyTimer !== null) clearTimeout(safetyTimer);
  safetyTimer = null;
  pendingCommit = null;
}
