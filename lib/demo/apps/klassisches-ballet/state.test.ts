import { describe, expect, it } from 'vitest';
import { HANDLING_FEE, MAX_PER_ORDER, findCategory } from './data';
import {
  categoryRows,
  createInitialState,
  reducer,
  reserve,
  seatCount,
  subtotal,
  total,
  type Action,
  type State,
} from './state';

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

const details: Action[] = [
  { type: 'field', name: 'name', value: 'Hannah Weiler' },
  { type: 'field', name: 'email', value: 'hannah@example.de' },
  { type: 'field', name: 'phone', value: '+49 611 998877' },
];

describe('scenarios', () => {
  it('start from different inventories', () => {
    const early = createInitialState('vorverkauf');
    const late = createInitialState('endspurt');

    expect(early.remaining['rang-1']).toBeGreaterThan(0);
    expect(late.remaining['rang-1']).toBe(0);
    expect(late.remaining.loge).toBe(0);
  });

  it('marks the gone categories as sold out', () => {
    const rows = categoryRows(createInitialState('endspurt'));
    expect(rows.find((r) => r.id === 'rang-1')?.soldOut).toBe(true);
    expect(rows.find((r) => r.id === 'rang-2')?.soldOut).toBe(false);
  });
});

describe('choosing seats', () => {
  it('keeps count and money in step', () => {
    const state = run(
      createInitialState('vorverkauf'),
      { type: 'setQty', categoryId: 'parkett', qty: 2 },
      { type: 'setQty', categoryId: 'rang-2', qty: 1 },
    );

    const parkett = findCategory('parkett')?.price ?? 0;
    const rang2 = findCategory('rang-2')?.price ?? 0;

    expect(seatCount(state)).toBe(3);
    expect(subtotal(state)).toBe(parkett * 2 + rang2);
    expect(total(state)).toBe(subtotal(state) + HANDLING_FEE);
  });

  it('charges no handling fee for an empty order', () => {
    expect(total(createInitialState('vorverkauf'))).toBe(0);
  });

  it('cannot exceed what is left in a category', () => {
    // Three seats left in Parkett in the late scenario.
    const state = run(createInitialState('endspurt'), {
      type: 'setQty',
      categoryId: 'parkett',
      qty: 10,
    });

    expect(state.selection.parkett).toBe(3);
  });

  it('cannot select a sold-out category at all', () => {
    const state = run(createInitialState('endspurt'), {
      type: 'setQty',
      categoryId: 'loge',
      qty: 2,
    });

    expect(state.selection.loge).toBeUndefined();
    expect(seatCount(state)).toBe(0);
  });

  it('enforces the house limit across categories', () => {
    const state = run(
      createInitialState('vorverkauf'),
      { type: 'setQty', categoryId: 'parkett', qty: 4 },
      { type: 'setQty', categoryId: 'rang-2', qty: 5 },
    );

    expect(seatCount(state)).toBe(MAX_PER_ORDER);
    expect(state.selection['rang-2']).toBe(MAX_PER_ORDER - 4);

    // And the row reports why the stepper stopped.
    const rows = categoryRows(state);
    expect(rows.find((r) => r.id === 'rang-1')?.limitReached).toBe(true);
  });

  it('removes a category when its quantity returns to zero', () => {
    const state = run(
      createInitialState('vorverkauf'),
      { type: 'setQty', categoryId: 'loge', qty: 1 },
      { type: 'setQty', categoryId: 'loge', qty: 0 },
    );

    expect(state.selection).toEqual({});
  });
});

describe('reserving', () => {
  function ready(scenario = 'vorverkauf'): State {
    return run(
      createInitialState(scenario),
      { type: 'setQty', categoryId: 'parkett', qty: 2 },
      { type: 'goto', screen: 'daten' },
      ...details,
    );
  }

  it('refuses an empty order', () => {
    const result = reserve(run(createInitialState('vorverkauf'), ...details));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('empty');
  });

  it('refuses incomplete details and names the field', () => {
    const state = run(ready(), { type: 'field', name: 'email', value: 'nope' });
    const result = reserve(state);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('invalid');
      expect(result.failure.field).toBe('email');
    }
  });

  it('re-checks inventory at the moment of reserving, not only in the stepper', () => {
    // A selection built while seats existed, against an inventory that no
    // longer has them — the case the stepper alone cannot catch.
    const state: State = {
      ...ready('endspurt'),
      selection: { parkett: 3 },
      remaining: { parkett: 1, 'rang-1': 0, 'rang-2': 11, loge: 0 },
    };

    const result = reserve(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('unavailable');
  });

  it('confirms, prices and then removes the seats from inventory', () => {
    const state = ready();
    const before = state.remaining.parkett;

    const result = reserve(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reservation = result.value;
    expect(reservation.seats).toBe(2);
    expect(reservation.total).toBe(reservation.subtotal + HANDLING_FEE);
    expect(reservation.code).toMatch(/^KB-\d{3}$/);

    const after = run(state, { type: 'submitSucceeded', reservation });
    expect(after.screen).toBe('bestaetigt');
    expect(after.remaining.parkett).toBe(before - 2);
    // The basket is emptied, so a second reservation starts clean.
    expect(after.selection).toEqual({});
    expect(seatCount(after)).toBe(0);
  });

  it('gives the same order the same reservation code', () => {
    expect(reserve(ready()).ok).toBe(true);
    const a = reserve(ready());
    const b = reserve(ready());
    if (a.ok && b.ok) expect(a.value.code).toBe(b.value.code);
  });
});

describe('reset', () => {
  it('restores the scenario’s original inventory', () => {
    const state = (() => {
      const s = run(
        createInitialState('endspurt'),
        { type: 'setQty', categoryId: 'parkett', qty: 2 },
        { type: 'goto', screen: 'daten' },
        ...details,
      );
      const result = reserve(s);
      if (!result.ok) throw new Error('fixture should have been reservable');
      return run(s, { type: 'submitSucceeded', reservation: result.value });
    })();

    expect(state.remaining.parkett).toBe(1);

    const fresh = createInitialState('endspurt');
    expect(fresh.remaining.parkett).toBe(3);
    expect(fresh.reservation).toBeNull();
    expect(fresh.screen).toBe('programm');
    expect(fresh).toEqual(createInitialState('endspurt'));
  });
});
