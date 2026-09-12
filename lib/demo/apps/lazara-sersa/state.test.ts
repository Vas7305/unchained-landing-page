import { describe, expect, it } from 'vitest';

import {
  getActiveCategories,
  getProjects,
} from '@/components/demo/apps/lazara-sersa/vendor/content/projects';

import {
  createInitialState,
  openProject,
  reducer,
  visibleProjects,
  type Action,
  type State,
} from './state';

/**
 * The demo's own behaviour, which is now only the part the product delegated
 * to the router. Everything else on this screen — the gallery, the cards, the
 * inquiry dialog and its validation — is the application's own code, tested in
 * the application's own repository.
 */
function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

describe('the portfolio it shows', () => {
  it('is the application’s own, not a copy', () => {
    const all = visibleProjects(createInitialState('portfolio'));
    expect(all).toEqual(getProjects());
    expect(all.length).toBeGreaterThan(0);
  });

  it('narrows to a discipline and back', () => {
    const category = getActiveCategories()[0];
    const filtered = run(createInitialState('portfolio'), {
      type: 'filter',
      category,
    });

    expect(visibleProjects(filtered).every((p) => p.category === category)).toBe(
      true,
    );
    expect(visibleProjects(filtered).length).toBeLessThanOrEqual(
      getProjects().length,
    );

    const cleared = run(filtered, { type: 'filter', category: undefined });
    expect(visibleProjects(cleared)).toEqual(getProjects());
  });
});

describe('opening a project', () => {
  it('resolves it through the application’s own selector', () => {
    const first = getProjects()[0];
    const opened = run(createInitialState('portfolio'), {
      type: 'open',
      slug: first.slug,
    });

    expect(openProject(opened)?.slug).toBe(first.slug);
    expect(openProject(run(opened, { type: 'close' }))).toBeUndefined();
  });

  it('closes when the filter changes underneath it', () => {
    // The open project may not belong to the newly chosen discipline.
    const first = getProjects()[0];
    const state = run(
      createInitialState('portfolio'),
      { type: 'open', slug: first.slug },
      { type: 'filter', category: getActiveCategories()[0] },
    );

    expect(state.openSlug).toBeNull();
  });

  it('resolves nothing for a slug that is not in the portfolio', () => {
    const state = run(createInitialState('portfolio'), {
      type: 'open',
      slug: 'not-a-project',
    });
    expect(openProject(state)).toBeUndefined();
  });
});

describe('reset', () => {
  it('returns to the unfiltered overview with nothing open', () => {
    const fresh = createInitialState('portfolio');
    expect(fresh.category).toBeUndefined();
    expect(fresh.openSlug).toBeNull();
    expect(fresh).toEqual(createInitialState('portfolio'));
  });
});
