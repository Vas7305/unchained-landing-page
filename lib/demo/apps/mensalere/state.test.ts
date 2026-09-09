import { describe, expect, it } from 'vitest';
import { CONTESTED, professionals, slotKey } from './data';
import {
  activeFilterCount,
  bookAppointment,
  canBook,
  createInitialState,
  daySlots,
  matches,
  reducer,
  validate,
  type Action,
  type State,
} from './state';

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

const details: Action[] = [
  { type: 'field', name: 'name', value: 'Irene Wells' },
  { type: 'field', name: 'email', value: 'irene@example.es' },
  { type: 'field', name: 'consent', value: true },
];

describe('the directory', () => {
  it('shows everyone with no filters applied', () => {
    const state = createInitialState('find');
    expect(matches(state)).toHaveLength(professionals.length);
    expect(activeFilterCount(state)).toBe(0);
  });

  it('applies every filter, including combinations that find nobody', () => {
    const bySpecialty = run(createInitialState('find'), {
      type: 'filter',
      name: 'specialty',
      value: 'Couples therapy',
    });
    expect(matches(bySpecialty).map((p) => p.id)).toEqual(['m-iribarne']);

    // That professional works online only and in Spanish only, so adding
    // either contradicting criterion has to empty the list rather than
    // quietly dropping a filter.
    const contradicted = run(bySpecialty, {
      type: 'filter',
      name: 'modality',
      value: 'presencial',
    });
    expect(matches(contradicted)).toHaveLength(0);
    expect(activeFilterCount(contradicted)).toBe(2);
  });

  it('filters by language and by fee ceiling', () => {
    const english = run(createInitialState('find'), {
      type: 'filter',
      name: 'language',
      value: 'English',
    });
    expect(matches(english).every((p) => p.languages.includes('English'))).toBe(
      true,
    );

    const cheap = run(createInitialState('find'), {
      type: 'filter',
      name: 'maxFee',
      value: 6000,
    });
    expect(matches(cheap).every((p) => p.fee <= 6000)).toBe(true);
    expect(matches(cheap).length).toBeLessThan(professionals.length);
  });

  it('clears every filter at once', () => {
    const state = run(
      createInitialState('find'),
      { type: 'filter', name: 'specialty', value: 'Depression' },
      { type: 'filter', name: 'maxFee', value: 6000 },
      { type: 'clearFilters' },
    );

    expect(activeFilterCount(state)).toBe(0);
    expect(matches(state)).toHaveLength(professionals.length);
  });
});

describe('the profile', () => {
  it('preselects the only modality a professional offers', () => {
    // Marcos works online only.
    const single = run(createInitialState('find'), {
      type: 'openProfile',
      professionalId: 'm-iribarne',
    });
    expect(single.modality).toBe('online');

    // Elena offers both, so the choice is left to the visitor.
    const both = run(createInitialState('find'), {
      type: 'openProfile',
      professionalId: 'e-ferran',
    });
    expect(both.modality).toBeNull();
  });

  it('needs a professional, a modality and a time before booking', () => {
    let state = run(createInitialState('find'), {
      type: 'openProfile',
      professionalId: 'e-ferran',
    });
    expect(canBook(state)).toBe(false);

    state = run(state, { type: 'setModality', modality: 'online' });
    expect(canBook(state)).toBe(false);

    const free = daySlots(state).find((slot) => slot.available);
    state = run(state, { type: 'setTime', time: free?.time ?? '09:00' });
    expect(canBook(state)).toBe(true);
  });

  it('clears the chosen time when the day changes', () => {
    const state = run(
      createInitialState('find'),
      { type: 'openProfile', professionalId: 'e-ferran' },
      { type: 'setModality', modality: 'online' },
      { type: 'setTime', time: '13:00' },
      { type: 'setDay', dayOffset: 2 },
    );

    expect(state.time).toBeNull();
  });

  it('renders the same diary every time', () => {
    const state = run(createInitialState('find'), {
      type: 'openProfile',
      professionalId: 'c-nieto',
    });
    expect(daySlots(state)).toEqual(daySlots(state));
  });
});

describe('consent and validation', () => {
  it('will not book without explicit consent', () => {
    const form = { name: 'Irene', email: 'irene@example.es', reason: '', consent: false };
    expect(validate(form).consent).toBeTruthy();
    expect(validate({ ...form, consent: true }).consent).toBeUndefined();
  });

  it('starts with consent unticked', () => {
    expect(createInitialState('find').form.consent).toBe(false);
  });
});

describe('booking', () => {
  function ready(professionalId: string, dayOffset: number, time: string): State {
    return run(
      createInitialState('find'),
      { type: 'openProfile', professionalId },
      { type: 'setModality', modality: 'online' },
      { type: 'setDay', dayOffset },
      { type: 'setTime', time },
      { type: 'goto', screen: 'reserva' },
      ...details,
    );
  }

  it('refuses an incomplete selection', () => {
    const result = bookAppointment(createInitialState('find'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('incomplete');
  });

  it('books a free slot with a stable reference', () => {
    const state = ready('a-puig', 1, '11:00');
    const first = bookAppointment(state);
    const second = bookAppointment(state);

    expect(first.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.code).toMatch(/^MS-\d{4}$/);
      expect(first.value.code).toBe(second.value.code);
      expect(first.value.modality).toBe('online');
    }
  });

  it('loses the contested slot and lets the visitor rebook', () => {
    let state = ready(
      CONTESTED.professionalId,
      CONTESTED.dayOffset,
      CONTESTED.time,
    );

    const refused = bookAppointment(state);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.failure.code).toBe('taken');

    state = run(state, {
      type: 'submitFailed',
      message: 'taken',
      blockSlot: slotKey(
        CONTESTED.professionalId,
        CONTESTED.dayOffset,
        CONTESTED.time,
      ),
    });

    expect(state.screen).toBe('perfil');
    expect(state.time).toBeNull();
    expect(
      daySlots(state).find((slot) => slot.time === CONTESTED.time)?.available,
    ).toBe(false);

    const other = daySlots(state).find((slot) => slot.available);
    expect(other).toBeDefined();
    const retried = run(state, { type: 'setTime', time: other?.time ?? '' });
    expect(bookAppointment(retried).ok).toBe(true);
  });
});

describe('reset', () => {
  it('clears filters, selection, form and the confirmed appointment', () => {
    const used = (() => {
      const s = ready('a-puig', 1, '11:00');
      const result = bookAppointment(s);
      if (!result.ok) throw new Error('fixture should have been bookable');
      return run(s, { type: 'submitSucceeded', appointment: result.value });
    })();

    function ready(id: string, day: number, time: string): State {
      return run(
        createInitialState('find'),
        { type: 'filter', name: 'specialty', value: 'Adult ADHD' },
        { type: 'openProfile', professionalId: id },
        { type: 'setModality', modality: 'online' },
        { type: 'setDay', dayOffset: day },
        { type: 'setTime', time },
        ...details,
      );
    }

    expect(used.appointment).not.toBeNull();

    const fresh = createInitialState('find');
    expect(fresh.appointment).toBeNull();
    expect(fresh.professionalId).toBeNull();
    expect(fresh.form.consent).toBe(false);
    expect(activeFilterCount(fresh)).toBe(0);
    expect(fresh).toEqual(createInitialState('find'));
  });
});
