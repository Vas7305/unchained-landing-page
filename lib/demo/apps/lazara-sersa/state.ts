import {
  getProject,
  getProjects,
} from '@/components/demo/apps/lazara-sersa/vendor/content/projects';
import type {
  Project,
  ProjectCategory,
} from '@/components/demo/apps/lazara-sersa/vendor/content/types';

/**
 * Lazara Sersa — the demo's data layer.
 *
 * ─── Much smaller than it used to be, on purpose ──────────────────────────
 * This module previously carried a filter, a lightbox index, an enquiry form,
 * its validation and a diary of committed dates — a parallel implementation of
 * a product we had not read. The demo now runs the product's own components,
 * and those already own their form state, their validation and their layout.
 * What is left here is the only thing the product delegated to the router:
 * which discipline is selected, and which project is open.
 *
 * The portfolio itself is not duplicated either. `getProjects` and
 * `getProject` are the application's own selectors over its own content file,
 * imported rather than re-typed, so the demo cannot drift from the real work.
 */
export interface State {
  scenarioId: string;
  /** `undefined` is the unfiltered overview, exactly as the product means it. */
  category?: ProjectCategory;
  /** The project whose images are open, by slug. */
  openSlug: string | null;
}

export type Action =
  | { type: 'filter'; category?: ProjectCategory }
  | { type: 'open'; slug: string }
  | { type: 'close' };

export function createInitialState(scenarioId: string): State {
  return { scenarioId, category: undefined, openSlug: null };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'filter':
      // Changing the filter closes an open project: it may not be in the new
      // set, and leaving it open would show work the filter excludes.
      return { ...state, category: action.category, openSlug: null };

    case 'open':
      return { ...state, openSlug: action.slug };

    case 'close':
      return { ...state, openSlug: null };

    default:
      return state;
  }
}

/** The product's own selector, applied to the demo's selection. */
export function visibleProjects(state: State): Project[] {
  return getProjects(state.category);
}

export function openProject(state: State): Project | undefined {
  return state.openSlug ? getProject(state.openSlug) : undefined;
}
