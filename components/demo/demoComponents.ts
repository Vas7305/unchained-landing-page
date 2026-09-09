'use client';

import { lazy, type ComponentType } from 'react';
import { demoRegistry } from '@/lib/demo/registry';
import type { DemoAppProps } from '@/lib/demo/types';

/**
 * Every demo as a lazy component, built once when this module is evaluated.
 *
 * ─── Why this is not done inside DemoStage ────────────────────────────────
 * Because `lazy()` creates a component, and a component created during render
 * is a new component on every render: React unmounts the old subtree, throws
 * away its state and re-fetches the chunk. Wrapping it in `useMemo` hides the
 * symptom without fixing the cause — a memo is a cache, not a guarantee, and
 * React is explicitly allowed to drop one. The lint rule that flagged it
 * (`react-hooks/static-components`) is right.
 *
 * Building the map at module scope makes each entry a stable identity for the
 * life of the page, which is what a component identity is supposed to be.
 *
 * ─── This does not load anything ──────────────────────────────────────────
 * `lazy` stores the loader; it does not call it. No demo module is evaluated
 * until the corresponding component is rendered, which happens only on that
 * project's demo route. The homepage and /work therefore ship no demo code at
 * all, which is the requirement §11 is actually about, and it is verified in
 * the build output rather than assumed — see docs/interactive-demos.md.
 *
 * ─── What the bundler does with the eight imports, measured ───────────────
 * Not what one would hope. Turbopack puts all eight demos in ONE async chunk
 * group for this route rather than eight independently fetched ones, so every
 * demo page currently downloads roughly 185 KB covering all eight instead of
 * the ~25 KB of the one being viewed. Both `React.lazy` and `next/dynamic`
 * were built and measured; the chunk sets they produce are byte-identical, so
 * this is the bundler's grouping policy for sibling async imports reachable
 * from one route, not a consequence of the primitive chosen here.
 *
 * `lazy` is kept because it suspends, which lets <DemoStage> show a loading
 * state in the visitor's own language; `next/dynamic` with `ssr: false` and no
 * `loading` renders nothing while it fetches.
 *
 * The fix, if this ever matters, is to stop asking one route to be able to
 * render any of eight demos: give each project's demo its own route segment,
 * so the bundler splits along the route boundary it already understands. That
 * trades eight small route files for the saving, and at the current sizes the
 * saving does not pay for them — the whole demo payload is smaller than the
 * site's existing animation library. It is written down here so the decision
 * is a decision.
 *
 * ─── Derived, not duplicated ──────────────────────────────────────────────
 * The keys come from lib/demo/registry.ts rather than being listed again. A
 * second hand-written list of slugs is a second thing to keep in step, and the
 * failure mode — a demo that exists but never loads — is silent.
 *
 * ─── Why the map has a null prototype ─────────────────────────────────────
 * So that `demoComponents[slug]` can be read directly, with no membership
 * check, and still be safe. A plain object would answer `demoComponents
 * ['toString']` with a function, and rendering that as a component would be a
 * strange crash reachable from a URL. With no prototype there is nothing to
 * inherit, so an unknown slug is `undefined` and the caller renders nothing.
 *
 * Reading it by index rather than through a lookup function is also what lets
 * React's lint rules see that these components are stable module constants
 * rather than something conjured up mid-render.
 */
export const demoComponents: Record<string, ComponentType<DemoAppProps>> =
  Object.assign(
    Object.create(null) as Record<string, ComponentType<DemoAppProps>>,
    Object.fromEntries(
      Object.entries(demoRegistry).map(([slug, definition]) => [
        slug,
        lazy(definition.load),
      ]),
    ),
  );
