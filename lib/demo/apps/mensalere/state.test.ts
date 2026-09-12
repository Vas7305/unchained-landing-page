import { describe, expect, it } from 'vitest';

import { psychologistService } from '@/components/demo/apps/mensalere/vendor/services/psychologistService';

import {
  activeFilterCount,
  canBook,
  createInitialState,
  reducer,
  type Action,
  type State,
} from './state';

/**
 * The demo's own behaviour, which is only the selection the product keeps in
 * its URL. The directory, the filtering, the diary and the booking rules are
 * the application's own service layer and are tested in its own repository —
 * so what is checked here is that this demo drives that layer, and that it
 * discards what a change invalidates.
 */
function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

describe('the directory it shows', () => {
  it('comes from the application’s own service, not a copy', async () => {
    const all = await psychologistService.list();

    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty('specialties');
  });

  it('filters through that same service', async () => {
    const all = await psychologistService.list();
    const filtered = await psychologistService.list({ query: all[0].name });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    expect(filtered.some((p) => p.name === all[0].name)).toBe(true);
  });
});

describe('selection', () => {
  it('counts only the filters that are actually narrowing', () => {
    const base = createInitialState('find');
    expect(activeFilterCount(base)).toBe(0);

    const narrowed = run(base, { type: 'filter', filters: { query: 'anx' } });
    expect(activeFilterCount(narrowed)).toBe(1);
    expect(activeFilterCount(run(narrowed, { type: 'clearFilters' }))).toBe(0);
  });

  it('discards the chosen slot when the day changes', () => {
    const state = run(
      createInitialState('find'),
      { type: 'openProfile', id: 'p-1' },
      { type: 'selectDate', date: '2026-09-14' },
      { type: 'selectSlot', slotId: 's-1' },
    );
    expect(canBook(state)).toBe(true);

    const moved = run(state, { type: 'selectDate', date: '2026-09-15' });
    expect(moved.selectedSlotId).toBeNull();
    expect(canBook(moved)).toBe(false);
  });

  it('discards the whole diary selection when another profile opens', () => {
    const state = run(
      createInitialState('find'),
      { type: 'openProfile', id: 'p-1' },
      { type: 'selectDate', date: '2026-09-14' },
      { type: 'selectSlot', slotId: 's-1' },
      { type: 'openProfile', id: 'p-2' },
    );

    expect(state.selectedId).toBe('p-2');
    expect(state.selectedDate).toBeNull();
    expect(state.selectedSlotId).toBeNull();
    expect(canBook(state)).toBe(false);
  });

  it('will not book without a professional, a day and a slot', () => {
    let state = createInitialState('find');
    expect(canBook(state)).toBe(false);

    state = run(state, { type: 'openProfile', id: 'p-1' });
    expect(canBook(state)).toBe(false);

    state = run(state, { type: 'selectDate', date: '2026-09-14' });
    expect(canBook(state)).toBe(false);

    state = run(state, { type: 'selectSlot', slotId: 's-1' });
    expect(canBook(state)).toBe(true);
  });
});

describe('reset', () => {
  it('returns to the unfiltered directory with nothing open', () => {
    const fresh = createInitialState('find');

    expect(fresh.selectedId).toBeNull();
    expect(fresh.bookedRef).toBeNull();
    expect(activeFilterCount(fresh)).toBe(0);
    expect(fresh).toEqual(createInitialState('find'));
  });
});
