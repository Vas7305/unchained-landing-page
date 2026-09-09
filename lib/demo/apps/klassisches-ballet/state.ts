import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  HANDLING_FEE,
  MAX_PER_ORDER,
  categories,
  findCategory,
  remainingFor,
} from './data';

/**
 * Klassisches Ballett — one night, a fixed number of seats.
 *
 * ─── The constraint that makes this a system ──────────────────────────────
 * A ticket page is a form; a ticketing system is inventory. Everything
 * interesting here is a limit: what is left in a category, the house limit per
 * order, and the fact that both have to be enforced when the reservation is
 * made and not merely suggested by the stepper. The `endspurt` scenario exists
 * so the visitor can see the system say no — which is the behaviour worth
 * demonstrating for a single-night event, where saying yes twice to the same
 * seat is the failure that matters.
 */

export type Screen = 'programm' | 'tickets' | 'daten' | 'bestaetigt';

export interface ReservationForm {
  name: string;
  email: string;
  phone: string;
}

export interface Reservation {
  code: string;
  lines: { categoryId: string; qty: number }[];
  seats: number;
  subtotal: number;
  fee: number;
  total: number;
  name: string;
}

export interface State {
  scenarioId: string;
  screen: Screen;
  /** Category id → seats requested. Absent means none. */
  selection: Record<string, number>;
  /** Seats left, per category. Reduced when a reservation is confirmed. */
  remaining: Record<string, number>;
  form: ReservationForm;
  errors: Partial<Record<keyof ReservationForm, string>>;
  submitting: boolean;
  failure: string | null;
  reservation: Reservation | null;
}

export function createInitialState(scenarioId: string): State {
  return {
    scenarioId,
    screen: 'programm',
    selection: {},
    // Copied, not referenced: confirming a reservation reduces this, and a
    // reset has to hand back the untouched fixture.
    remaining: { ...remainingFor(scenarioId) },
    form: { name: '', email: '', phone: '' },
    errors: {},
    submitting: false,
    failure: null,
    reservation: null,
  };
}

export type Action =
  | { type: 'goto'; screen: Screen }
  | { type: 'setQty'; categoryId: string; qty: number }
  | { type: 'field'; name: keyof ReservationForm; value: string }
  | { type: 'submit' }
  | { type: 'submitFailed'; message: string; field?: keyof ReservationForm }
  | { type: 'submitSucceeded'; reservation: Reservation };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'goto':
      return { ...state, screen: action.screen, failure: null };

    case 'setQty': {
      const available = state.remaining[action.categoryId] ?? 0;
      const others = seatCount(state) - (state.selection[action.categoryId] ?? 0);
      // Clamped by three things at once: what is left in this category, the
      // house limit across the whole order, and zero.
      const qty = Math.max(
        0,
        Math.min(action.qty, available, MAX_PER_ORDER - others),
      );

      const selection = { ...state.selection };
      if (qty === 0) delete selection[action.categoryId];
      else selection[action.categoryId] = qty;

      return { ...state, selection, failure: null };
    }

    case 'field': {
      const errors = { ...state.errors };
      delete errors[action.name];
      return {
        ...state,
        form: { ...state.form, [action.name]: action.value },
        errors,
        failure: null,
      };
    }

    case 'submit':
      return { ...state, submitting: true, failure: null, errors: {} };

    case 'submitFailed':
      return {
        ...state,
        submitting: false,
        failure: action.field ? null : action.message,
        errors: action.field ? { [action.field]: action.message } : {},
      };

    case 'submitSucceeded': {
      // The seats are now gone. A second reservation in the same session sees
      // the reduced inventory, which is what makes the demo internally honest.
      const remaining = { ...state.remaining };
      for (const line of action.reservation.lines) {
        remaining[line.categoryId] = Math.max(
          0,
          (remaining[line.categoryId] ?? 0) - line.qty,
        );
      }

      return {
        ...state,
        submitting: false,
        reservation: action.reservation,
        remaining,
        selection: {},
        screen: 'bestaetigt',
        failure: null,
      };
    }

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function seatCount(state: State): number {
  return Object.values(state.selection).reduce((sum, qty) => sum + qty, 0);
}

export function subtotal(state: State): number {
  return Object.entries(state.selection).reduce((sum, [id, qty]) => {
    const category = findCategory(id);
    return sum + (category ? category.price * qty : 0);
  }, 0);
}

export function total(state: State): number {
  return seatCount(state) === 0 ? 0 : subtotal(state) + HANDLING_FEE;
}

export interface CategoryRow {
  id: string;
  name: string;
  detail: string;
  price: number;
  remaining: number;
  qty: number;
  soldOut: boolean;
  /** True when the house limit — not this category — blocks another seat. */
  limitReached: boolean;
}

export function categoryRows(state: State): CategoryRow[] {
  const seats = seatCount(state);

  return categories.map((category) => {
    const remaining = state.remaining[category.id] ?? 0;
    const qty = state.selection[category.id] ?? 0;

    return {
      id: category.id,
      name: category.name,
      detail: category.detail,
      price: category.price,
      remaining,
      qty,
      soldOut: remaining === 0,
      limitReached: seats >= MAX_PER_ORDER && qty < remaining,
    };
  });
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function validate(
  form: ReservationForm,
): Partial<Record<keyof ReservationForm, string>> {
  const errors: Partial<Record<keyof ReservationForm, string>> = {};

  if (form.name.trim().length < 3) {
    errors.name = 'Please give your full name.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = 'Please give a valid email address.';
  }

  if (form.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Please give a phone number for any queries.';
  }

  return errors;
}

export function reserve(state: State): DemoResult<Reservation> {
  const seats = seatCount(state);

  if (seats === 0) {
    return fail('empty', 'Please choose at least one seat.');
  }

  if (seats > MAX_PER_ORDER) {
    return fail(
      'limit',
      `A single reservation can hold at most ${MAX_PER_ORDER} seats.`,
    );
  }

  // Checked again at the moment of reserving, not only in the stepper: the
  // inventory can have changed since the seats were chosen.
  for (const [id, qty] of Object.entries(state.selection)) {
    const left = state.remaining[id] ?? 0;
    const category = findCategory(id);
    if (qty > left) {
      return fail(
        'unavailable',
        left === 0
          ? `${category?.name} has sold out.`
          : `Only ${left} seats remain in ${category?.name}.`,
      );
    }
  }

  const errors = validate(state.form);
  const firstBad = (Object.keys(errors) as (keyof ReservationForm)[])[0];
  if (firstBad) {
    return fail('invalid', errors[firstBad] as string, firstBad);
  }

  const goods = subtotal(state);

  return ok({
    code: reservationCode(state),
    lines: Object.entries(state.selection).map(([categoryId, qty]) => ({
      categoryId,
      qty,
    })),
    seats,
    subtotal: goods,
    fee: HANDLING_FEE,
    total: goods + HANDLING_FEE,
    name: state.form.name.trim(),
  });
}

/** Derived from the order, so the same reservation always has the same code. */
function reservationCode(state: State): string {
  const seed = Object.entries(state.selection).reduce(
    (acc, [id, qty]) => acc + id.length * 13 + qty * 29,
    seatCount(state) * 7,
  );
  return `KB-${(100 + (seed % 900)).toString()}`;
}
