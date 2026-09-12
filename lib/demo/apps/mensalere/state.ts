import type { PsychologistFilters } from '@/components/demo/apps/mensalere/vendor/services/psychologistService';

/**
 * Mensalere — the demo's data layer.
 *
 * ─── Almost nothing, on purpose ───────────────────────────────────────────
 * This module used to hold a directory, a diary, a booking form and its
 * validation — a parallel implementation of a product nobody had read. The
 * product turned out to ship its own service layer already backed by a mock
 * store (`vendor/services/mock/`), with simulated latency and no network
 * anywhere in it. That layer is the demo's data layer now, imported rather
 * than rewritten.
 *
 * What is left here is the selection the product keeps in its URL: which
 * filters are set, whose profile is open, and which day and slot are chosen.
 */
export interface State {
  scenarioId: string;
  filters: PsychologistFilters;
  /** The professional whose profile is open. */
  selectedId: string | null;
  selectedDate: string | null;
  selectedSlotId: string | null;
  /** The reference of a booking that has been made. */
  bookedRef: string | null;
}

export type Action =
  | { type: 'filter'; filters: PsychologistFilters }
  | { type: 'clearFilters' }
  | { type: 'openProfile'; id: string }
  | { type: 'closeProfile' }
  | { type: 'selectDate'; date: string }
  | { type: 'selectSlot'; slotId: string }
  | { type: 'booked'; reference: string };

const NO_FILTERS: PsychologistFilters = {
  query: '',
  category: 'all',
  language: 'all',
};

export function createInitialState(scenarioId: string): State {
  return {
    scenarioId,
    filters: { ...NO_FILTERS },
    selectedId: null,
    selectedDate: null,
    selectedSlotId: null,
    bookedRef: null,
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'filter':
      return { ...state, filters: { ...state.filters, ...action.filters } };

    case 'clearFilters':
      return { ...state, filters: { ...NO_FILTERS } };

    case 'openProfile':
      // A new profile means a new diary: nothing chosen in the old one carries.
      return {
        ...state,
        selectedId: action.id,
        selectedDate: null,
        selectedSlotId: null,
        bookedRef: null,
      };

    case 'closeProfile':
      return {
        ...state,
        selectedId: null,
        selectedDate: null,
        selectedSlotId: null,
        bookedRef: null,
      };

    case 'selectDate':
      // Slots belong to a day; choosing another day discards the chosen slot.
      return { ...state, selectedDate: action.date, selectedSlotId: null };

    case 'selectSlot':
      return { ...state, selectedSlotId: action.slotId };

    case 'booked':
      return { ...state, bookedRef: action.reference };

    default:
      return state;
  }
}

/** Whether the visitor has chosen enough to book. */
export function canBook(state: State): boolean {
  return (
    state.selectedId !== null &&
    state.selectedDate !== null &&
    state.selectedSlotId !== null
  );
}

export function activeFilterCount(state: State): number {
  const { query, category, language } = state.filters;
  return [
    query && query.trim() !== '',
    category && category !== 'all',
    language && language !== 'all',
  ].filter(Boolean).length;
}
