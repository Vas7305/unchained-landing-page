import { describe, expect, it } from 'vitest';
import { bookedOffsets, works } from './data';
import {
  createInitialState,
  enquiryDates,
  lightboxWork,
  reducer,
  sendEnquiry,
  suggestionFor,
  validate,
  visibleWorks,
  type Action,
  type State,
} from './state';

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

const filled: Action[] = [
  { type: 'field', name: 'name', value: 'Renata Alvi' },
  { type: 'field', name: 'email', value: 'renata@example.com' },
  { type: 'field', name: 'message', value: 'Bridal party of four, morning call.' },
];

describe('the gallery', () => {
  it('filters by discipline and can be cleared', () => {
    const base = createInitialState('portfolio');
    const editorial = run(base, { type: 'filter', discipline: 'Editorial' });

    expect(visibleWorks(editorial).every((w) => w.discipline === 'Editorial'))
      .toBe(true);
    expect(visibleWorks(run(editorial, { type: 'filter', discipline: null })))
      .toHaveLength(works.length);
  });

  it('closes the viewer when the filter changes underneath it', () => {
    // The viewer index points into the filtered list, so leaving it open
    // across a filter change would show a different picture than the one
    // that was opened.
    const state = run(
      createInitialState('portfolio'),
      { type: 'openLightbox', index: 5 },
      { type: 'filter', discipline: 'Bridal' },
    );

    expect(state.lightbox).toBeNull();
    expect(lightboxWork(state)).toBeUndefined();
  });

  it('wraps at both ends when stepping through works', () => {
    const bridal = run(createInitialState('portfolio'), {
      type: 'filter',
      discipline: 'Bridal',
    });
    const count = visibleWorks(bridal).length;
    expect(count).toBeGreaterThan(1);

    const atStart = run(bridal, { type: 'openLightbox', index: 0 });
    expect(run(atStart, { type: 'step', delta: -1 }).lightbox).toBe(count - 1);

    const atEnd = run(bridal, { type: 'openLightbox', index: count - 1 });
    expect(run(atEnd, { type: 'step', delta: 1 }).lightbox).toBe(0);
  });

  it('ignores stepping while the viewer is closed', () => {
    const state = run(createInitialState('portfolio'), { type: 'step', delta: 1 });
    expect(state.lightbox).toBeNull();
  });
});

describe('the enquiry', () => {
  function ready(dateOffset: number): State {
    return run(
      createInitialState('portfolio'),
      { type: 'openEnquiry' },
      ...filled,
      { type: 'field', name: 'dateOffset', value: String(dateOffset) },
    );
  }

  it('carries the chosen service into the form', () => {
    const state = run(createInitialState('portfolio'), {
      type: 'openEnquiry',
      serviceId: 'fashion',
    });
    expect(state.enquiryOpen).toBe(true);
    expect(state.form.serviceId).toBe('fashion');
  });

  it('reports every missing field before anything is sent', () => {
    const empty = validate(createInitialState('portfolio').form);
    expect(Object.keys(empty).sort()).toEqual([
      'dateOffset',
      'email',
      'message',
      'name',
    ]);
  });

  it('rejects a malformed email but accepts an ordinary one', () => {
    expect(validate({ ...ready(1).form, email: 'not-an-email' }).email)
      .toBeTruthy();
    expect(validate(ready(1).form).email).toBeUndefined();
  });

  it('refuses a committed date and offers the next free one', () => {
    const taken = bookedOffsets[0];
    const state = ready(taken);

    const result = sendEnquiry(state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('unavailable');
      expect(result.failure.field).toBe('dateOffset');
    }

    const suggestion = suggestionFor(taken);
    expect(suggestion).not.toBeNull();
    expect(bookedOffsets).not.toContain(suggestion);

    // Accepting the suggestion makes the same enquiry send.
    const withSuggestion = run(
      state,
      { type: 'submitFailed', message: 'unavailable', field: 'dateOffset', suggestion: suggestion as number },
      { type: 'acceptSuggestion' },
    );
    expect(withSuggestion.form.dateOffset).toBe(String(suggestion));
    expect(sendEnquiry(withSuggestion).ok).toBe(true);
  });

  it('marks committed dates in the picker', () => {
    const dates = enquiryDates();
    expect(dates.filter((d) => d.booked).map((d) => d.offset)).toEqual([
      ...bookedOffsets,
    ]);
  });

  it('sends a complete enquiry with a stable reference', () => {
    const state = ready(1);
    const first = sendEnquiry(state);
    const second = sendEnquiry(state);

    expect(first.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.reference).toBe(second.value.reference);
      expect(first.value.dateOffset).toBe(1);
    }
  });
});

describe('reset', () => {
  it('clears the filter, the viewer, the form and the sent enquiry', () => {
    const used = run(
      createInitialState('portfolio'),
      { type: 'filter', discipline: 'Fashion' },
      { type: 'openLightbox', index: 1 },
      { type: 'openEnquiry', serviceId: 'lesson' },
      ...filled,
    );

    const fresh = createInitialState('portfolio');
    expect(fresh.discipline).toBeNull();
    expect(fresh.lightbox).toBeNull();
    expect(fresh.enquiryOpen).toBe(false);
    expect(fresh.enquiry).toBeNull();
    expect(fresh.form.name).toBe('');
    expect(fresh).not.toEqual(used);
    expect(fresh).toEqual(createInitialState('portfolio'));
  });
});
