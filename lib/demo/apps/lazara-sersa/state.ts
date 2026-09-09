import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  ENQUIRY_WINDOW_DAYS,
  bookedOffsets,
  findService,
  nextFreeOffset,
  works,
  type DemoWork,
  type Discipline,
} from './data';

/**
 * Lazara Sersa — a portfolio with a diary behind it.
 *
 * ─── Why a portfolio site is worth demonstrating at all ───────────────────
 * A gallery on its own is a static page and §5 rules out shipping one. What
 * makes this product a product is what surrounds the pictures: filtering that
 * keeps its place, a viewer that can be driven from the keyboard, and an
 * enquiry form that knows which dates are already committed and says so
 * instead of accepting a booking that cannot happen. That last part is the
 * whole reason the artist needed software rather than an inbox.
 */

export interface EnquiryForm {
  name: string;
  email: string;
  serviceId: string;
  /** Days from the demo anchor, as a string because it comes from a <select>. */
  dateOffset: string;
  message: string;
}

export interface Enquiry {
  reference: string;
  name: string;
  serviceId: string;
  dateOffset: number;
}

export interface State {
  scenarioId: string;
  /** Null shows every discipline. */
  discipline: Discipline | null;
  /** Index into the *filtered* list, or null when the viewer is closed. */
  lightbox: number | null;
  enquiryOpen: boolean;
  form: EnquiryForm;
  errors: Partial<Record<keyof EnquiryForm, string>>;
  submitting: boolean;
  failure: string | null;
  /** A date the diary suggested after refusing the one that was asked for. */
  suggestion: number | null;
  enquiry: Enquiry | null;
}

export function createInitialState(scenarioId: string): State {
  return {
    scenarioId,
    discipline: null,
    lightbox: null,
    enquiryOpen: false,
    form: {
      name: '',
      email: '',
      serviceId: 'bridal',
      dateOffset: '',
      message: '',
    },
    errors: {},
    submitting: false,
    failure: null,
    suggestion: null,
    enquiry: null,
  };
}

export type Action =
  | { type: 'filter'; discipline: Discipline | null }
  | { type: 'openLightbox'; index: number }
  | { type: 'closeLightbox' }
  | { type: 'step'; delta: number }
  | { type: 'openEnquiry'; serviceId?: string }
  | { type: 'closeEnquiry' }
  | { type: 'field'; name: keyof EnquiryForm; value: string }
  | { type: 'acceptSuggestion' }
  | { type: 'submit' }
  | { type: 'submitFailed'; message: string; field?: keyof EnquiryForm; suggestion?: number }
  | { type: 'submitSucceeded'; enquiry: Enquiry };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'filter':
      // Closing the viewer matters: its index refers to the filtered list, and
      // a new filter makes that index mean a different picture.
      return { ...state, discipline: action.discipline, lightbox: null };

    case 'openLightbox':
      return { ...state, lightbox: action.index };

    case 'closeLightbox':
      return { ...state, lightbox: null };

    case 'step': {
      if (state.lightbox === null) return state;
      const list = visibleWorks(state);
      if (list.length === 0) return state;
      // Wraps, so the arrow keys never dead-end at either edge.
      const next = (state.lightbox + action.delta + list.length) % list.length;
      return { ...state, lightbox: next };
    }

    case 'openEnquiry':
      return {
        ...state,
        enquiryOpen: true,
        lightbox: null,
        form: action.serviceId
          ? { ...state.form, serviceId: action.serviceId }
          : state.form,
      };

    case 'closeEnquiry':
      return { ...state, enquiryOpen: false, failure: null };

    case 'field': {
      const errors = { ...state.errors };
      delete errors[action.name];
      return {
        ...state,
        form: { ...state.form, [action.name]: action.value },
        errors,
        failure: null,
        // The suggestion belonged to the date that was just changed.
        suggestion: action.name === 'dateOffset' ? null : state.suggestion,
      };
    }

    case 'acceptSuggestion':
      return state.suggestion === null
        ? state
        : {
            ...state,
            form: { ...state.form, dateOffset: String(state.suggestion) },
            suggestion: null,
            failure: null,
            errors: {},
          };

    case 'submit':
      return { ...state, submitting: true, failure: null, errors: {} };

    case 'submitFailed':
      return {
        ...state,
        submitting: false,
        failure: action.field ? null : action.message,
        errors: action.field ? { [action.field]: action.message } : {},
        suggestion: action.suggestion ?? null,
      };

    case 'submitSucceeded':
      return {
        ...state,
        submitting: false,
        enquiry: action.enquiry,
        failure: null,
        suggestion: null,
      };

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function visibleWorks(state: State): DemoWork[] {
  return state.discipline === null
    ? [...works]
    : works.filter((work) => work.discipline === state.discipline);
}

export function lightboxWork(state: State): DemoWork | undefined {
  if (state.lightbox === null) return undefined;
  return visibleWorks(state)[state.lightbox];
}

/** The dates the enquiry form offers, with the committed ones marked. */
export function enquiryDates(): { offset: number; booked: boolean }[] {
  return Array.from({ length: ENQUIRY_WINDOW_DAYS }, (_, offset) => ({
    offset,
    booked: bookedOffsets.includes(offset),
  }));
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function validate(
  form: EnquiryForm,
): Partial<Record<keyof EnquiryForm, string>> {
  const errors: Partial<Record<keyof EnquiryForm, string>> = {};

  if (form.name.trim().length < 2) {
    errors.name = 'Please tell me who you are.';
  }

  // Deliberately permissive: something@something.something. A stricter
  // pattern rejects real addresses, which is a worse failure than accepting
  // a typo the reply will bounce off.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = 'A valid email address, so I can reply.';
  }

  if (form.dateOffset === '') {
    errors.dateOffset = 'Pick the date you have in mind.';
  }

  if (form.message.trim().length < 12) {
    errors.message = 'A sentence about the job helps me answer properly.';
  }

  return errors;
}

export function sendEnquiry(state: State): DemoResult<Enquiry> {
  const errors = validate(state.form);
  const firstBad = (Object.keys(errors) as (keyof EnquiryForm)[])[0];
  if (firstBad) {
    return fail('invalid', errors[firstBad] as string, firstBad);
  }

  const offset = Number(state.form.dateOffset);

  if (bookedOffsets.includes(offset)) {
    return fail(
      'unavailable',
      'That date is already committed. The nearest free date is offered below.',
      'dateOffset',
    );
  }

  const service = findService(state.form.serviceId);

  return ok({
    reference: `LS-${(offset * 137 + (service?.name.length ?? 0) * 11 + 200).toString(36).toUpperCase().padStart(4, '0')}`,
    name: state.form.name.trim(),
    serviceId: state.form.serviceId,
    dateOffset: offset,
  });
}

/** What to offer when a date is refused. */
export function suggestionFor(offset: number): number | null {
  return nextFreeOffset(offset + 1);
}
