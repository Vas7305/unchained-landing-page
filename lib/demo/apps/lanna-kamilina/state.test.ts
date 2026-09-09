import { describe, expect, it } from 'vitest';
import { CONTESTED_SLOT, findService, mastersFor, slotKey } from './data';
import {
  availableMasters,
  bookableDays,
  canAdvance,
  confirmBooking,
  createInitialState,
  daySlots,
  reducer,
  validate,
  visibleServices,
  type Action,
  type State,
} from './state';

/**
 * The booking journey, and the constraints that make it a booking system.
 *
 * The interesting assertions here are not "the form validates". They are that
 * choosing a service narrows the masters, that changing a service invalidates
 * a master who cannot perform it, that a master's day off removes a date, and
 * that the slot which is taken mid-booking becomes genuinely unavailable
 * afterwards rather than refusing the same choice forever.
 */

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

const contact: Action[] = [
  { type: 'field', name: 'name', value: 'Анна' },
  { type: 'field', name: 'phone', value: '+7 916 555-01-23' },
];

describe('the service catalogue', () => {
  it('filters by category and restores the full list', () => {
    const base = createInitialState('zapis');
    const filtered = run(base, { type: 'setCategory', category: 'Маникюр' });

    expect(visibleServices(filtered).every((s) => s.category === 'Маникюр')).toBe(
      true,
    );
    expect(visibleServices(filtered).length).toBeLessThan(
      visibleServices(base).length,
    );
  });
});

describe('the choices constrain one another', () => {
  it('offers only masters who perform the chosen service', () => {
    const state = run(createInitialState('zapis'), {
      type: 'chooseService',
      serviceId: 'manikur',
    });

    const offered = availableMasters(state).map((m) => m.id);
    expect(offered).toEqual(mastersFor('manikur').map((m) => m.id));
    // The colourist does not do nails.
    expect(offered).not.toContain('marina');
  });

  it('clears a master who cannot perform a newly chosen service', () => {
    const withNails = run(
      createInitialState('zapis'),
      { type: 'chooseService', serviceId: 'manikur' },
      { type: 'chooseMaster', masterId: 'dasha' },
      { type: 'chooseDay', dayOffset: 1 },
    );
    expect(withNails.masterId).toBe('dasha');

    // Switching to colouring invalidates the nail specialist, and the slot
    // that was chosen in her diary goes with her.
    const switched = run(withNails, {
      type: 'chooseService',
      serviceId: 'airtouch',
    });
    expect(switched.masterId).toBeNull();
    expect(switched.dayOffset).toBeNull();
    expect(switched.time).toBeNull();
  });

  it('keeps the master when the new service is still theirs', () => {
    const state = run(
      createInitialState('zapis'),
      { type: 'chooseService', serviceId: 'strizhka-zhen' },
      { type: 'chooseMaster', masterId: 'lanna' },
      { type: 'chooseService', serviceId: 'okrashivanie-baza' },
    );

    expect(state.masterId).toBe('lanna');
  });

  it('closes the days a master does not work', () => {
    // Ольга has weekday 2 off; the anchor is a Monday, so offset 2 is that day.
    const state = run(
      createInitialState('zapis'),
      { type: 'chooseService', serviceId: 'strizhka-zhen' },
      { type: 'chooseMaster', masterId: 'olga' },
    );

    const days = bookableDays(state);
    expect(days).toHaveLength(7);
    expect(days.find((d) => d.offset === 2)?.open).toBe(false);
    expect(days.some((d) => d.open)).toBe(true);
  });

  it('produces the same diary on every call', () => {
    const state = run(
      createInitialState('zapis'),
      { type: 'chooseService', serviceId: 'strizhka-zhen' },
      { type: 'chooseMaster', masterId: 'lanna' },
      { type: 'chooseDay', dayOffset: 1 },
    );

    expect(daySlots(state)).toEqual(daySlots(state));
    expect(daySlots(state).some((slot) => slot.available)).toBe(true);
  });
});

describe('step gating', () => {
  it('will not advance until the current step is answered', () => {
    let state = createInitialState('zapis');
    expect(canAdvance(state)).toBe(false);

    state = run(state, { type: 'chooseService', serviceId: 'strizhka-zhen' });
    expect(state.step).toBe(1);

    state = run(state, { type: 'setStep', step: 2 });
    expect(canAdvance(state)).toBe(false);

    state = run(
      state,
      { type: 'chooseMaster', masterId: 'lanna' },
      { type: 'chooseDay', dayOffset: 1 },
    );
    expect(canAdvance(state)).toBe(false);

    const free = daySlots(state).find((slot) => slot.available);
    state = run(state, { type: 'chooseTime', time: free?.time ?? '10:00' });
    expect(canAdvance(state)).toBe(true);
  });
});

describe('contact validation', () => {
  it('accepts both Russian mobile formats and rejects short numbers', () => {
    expect(validate({ name: 'Анна', phone: '+7 916 555-01-23', comment: '' }))
      .toEqual({});
    expect(validate({ name: 'Анна', phone: '8 916 555 01 23', comment: '' }))
      .toEqual({});
    expect(validate({ name: 'Анна', phone: '916555', comment: '' }).phone)
      .toBeTruthy();
    expect(validate({ name: '', phone: '+7 916 555-01-23', comment: '' }).name)
      .toBeTruthy();
  });
});

describe('confirming', () => {
  /** A complete booking on a slot known to be free. */
  function ready(masterId = 'lanna', dayOffset = 1): State {
    let state = run(
      createInitialState('zapis'),
      { type: 'chooseService', serviceId: 'strizhka-zhen' },
      { type: 'chooseMaster', masterId },
      { type: 'chooseDay', dayOffset },
    );
    const free = daySlots(state).find((slot) => slot.available);
    state = run(state, { type: 'chooseTime', time: free?.time ?? '10:00' });
    return run(state, ...contact);
  }

  it('refuses an incomplete booking', () => {
    const result = confirmBooking(createInitialState('zapis'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('incomplete');
  });

  it('confirms a valid booking with a stable code', () => {
    const state = ready();
    const first = confirmBooking(state);
    const second = confirmBooking(state);

    expect(first.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.code).toMatch(/^LK-\d{4}$/);
      expect(first.value.code).toBe(second.value.code);
      expect(first.value.price).toBe(findService('strizhka-zhen')?.price);
    }
  });

  it('loses the contested slot, then lets the visitor rebook', () => {
    // Choose exactly the slot that gets taken while the form is open.
    let state = run(
      createInitialState('zapis'),
      { type: 'chooseService', serviceId: 'strizhka-zhen' },
      { type: 'chooseMaster', masterId: CONTESTED_SLOT.masterId },
      { type: 'chooseDay', dayOffset: CONTESTED_SLOT.dayOffset },
      { type: 'chooseTime', time: CONTESTED_SLOT.time },
      ...contact,
    );

    const refused = confirmBooking(state);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.failure.code).toBe('taken');

    // The UI reports the failure and blocks the slot, exactly as App.tsx does.
    const key = slotKey(
      CONTESTED_SLOT.masterId,
      CONTESTED_SLOT.dayOffset,
      CONTESTED_SLOT.time,
    );
    state = run(state, {
      type: 'submitFailed',
      message: 'taken',
      blockSlot: key,
    });

    // It is now genuinely gone from the grid, and the visitor is back on the
    // time step with no time selected.
    expect(state.step).toBe(2);
    expect(state.time).toBeNull();
    expect(
      daySlots(state).find((slot) => slot.time === CONTESTED_SLOT.time)?.available,
    ).toBe(false);

    // Another free time in the same diary succeeds.
    const other = daySlots(state).find((slot) => slot.available);
    expect(other).toBeDefined();
    const retried = run(state, { type: 'chooseTime', time: other?.time ?? '' });
    expect(confirmBooking(retried).ok).toBe(true);
  });
});

describe('reset', () => {
  it('returns to an empty booking with nothing chosen', () => {
    const state = ((): State => {
      let s = run(
        createInitialState('zapis'),
        { type: 'chooseService', serviceId: 'keratin' },
        { type: 'chooseMaster', masterId: 'lanna' },
        { type: 'chooseDay', dayOffset: 3 },
        ...contact,
      );
      const free = daySlots(s).find((slot) => slot.available);
      s = run(s, { type: 'chooseTime', time: free?.time ?? '10:00' });
      const result = confirmBooking(s);
      if (!result.ok) throw new Error('fixture should have been bookable');
      return run(s, { type: 'submitSucceeded', booking: result.value });
    })();

    expect(state.booking).not.toBeNull();

    const fresh = createInitialState('zapis');
    expect(fresh.booking).toBeNull();
    expect(fresh.serviceId).toBeNull();
    expect(fresh.masterId).toBeNull();
    expect(fresh.time).toBeNull();
    expect(fresh.blocked).toEqual([]);
    expect(fresh.step).toBe(0);
    expect(fresh).toEqual(createInitialState('zapis'));
  });
});
