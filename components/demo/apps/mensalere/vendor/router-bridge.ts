/**
 * Where the adapted router sends a link activation.
 *
 * ─── Why this is its own module ───────────────────────────────────────────
 * It holds the demo's navigation sink, which is state and a setter rather than
 * a component. Keeping it beside `Link` in a `.tsx` file mixed component and
 * non-component exports, which breaks React Fast Refresh for that file — the
 * whole module reloads instead of the component hot-swapping. Splitting them is
 * the standard remedy and costs nothing here.
 */

/** Called with the `to` of whatever the visitor activated. */
export type Nav = (to: string) => void;

let navigate: Nav = () => {};

/** Set once by the demo App, read by every adapted control. */
export function setDemoNavigate(handler: Nav): void {
  navigate = handler;
}

/** @internal Used by the router adapter's `Link`. */
export function demoNavigate(to: string): void {
  navigate(to);
}
