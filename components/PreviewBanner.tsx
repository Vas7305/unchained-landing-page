'use client';

import type { PreviewState } from '@/lib/preview';

/**
 * The bar that says "this is not the live page".
 *
 * ─── Why it is not optional and not subtle ────────────────────────────────
 * A preview renders through the same components as the published page, which
 * is the point — an editor needs to see what visitors will see. The cost is
 * that the two are otherwise indistinguishable, and somebody who opens a
 * preview link, reads it, and comes back an hour later has no way to tell
 * whether they are looking at the site or at a draft of it.
 *
 * So the state is stated plainly, at the top, before the content: whether this
 * is published, and whether it has been archived.
 *
 * ─── Not translated ───────────────────────────────────────────────────────
 * Every other visible string on this site goes through `t()`. This one does
 * not, deliberately: it is operational chrome for the handful of people who
 * hold preview links, not content for visitors, and adding six translations of
 * "Draft preview" to the dictionaries would put words in front of every
 * translator for a bar no visitor will ever see.
 */
export default function PreviewBanner({ state }: { state: PreviewState }) {
  const label = state.archived
    ? 'Archived — this content is not on the public site'
    : state.published
      ? 'Preview of published content — this matches the live page'
      : 'Draft preview — this content is not on the public site';

  return (
    <div
      // `role="status"` rather than `alert`: it is a standing statement about
      // the page, not an interruption, so a screen reader announces it in turn
      // rather than cutting across whatever is being read.
      role='status'
      className='sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-center text-xs font-medium text-amber-200'
    >
      <span>{label}</span>
      {state.locale && (
        <span className='text-amber-200/70'>
          Language: {state.locale.toUpperCase()}
        </span>
      )}
      <span className='text-amber-200/70'>
        This link expires and can be revoked from the admin panel.
      </span>
    </div>
  );
}
