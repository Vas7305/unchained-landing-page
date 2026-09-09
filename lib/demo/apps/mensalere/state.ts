import { fail, ok, type DemoResult } from '@/lib/demo/service';
import { demoDate } from '@/lib/demo/format';
import {
  CONTESTED,
  DIARY_DAYS,
  findProfessional,
  professionals,
  slotKey,
  slotsFor,
  type DemoProfessional,
  type DemoSlot,
  type Modality,
} from './data';

/**
 * Mensalere — finding a professional, then booking one.
 *
 * ─── Two halves, and the first one is the product ─────────────────────────
 * The booking is ordinary. What this product is actually for is the search
 * that precedes it: somebody who needs help does not want a list of everyone,
 * they want the three people who work on their problem, in their language, in
 * the format they can manage, at a fee they can meet. So the filters are the
 * substance here — four of them, combining, with a live count and an honest
 * empty state rather than a page of results that quietly ignores one of the
 * criteria.
 */

export type Screen = 'directorio' | 'perfil' | 'reserva' | 'confirmado';

export interface Filters {
  specialty: string;
  language: string;
  modality: '' | Modality;
  /** Maximum fee in cents. Zero means no ceiling. */
  maxFee: number;
}

export interface BookingForm {
  name: string;
  email: string;
  reason: string;
  /** Explicit, unticked by default: consent is never pre-given. */
  consent: boolean;
}

export interface Appointment {
  code: string;
  professionalId: string;
  dayOffset: number;
  time: string;
  modality: Modality;
  fee: number;
  name: string;
}

export interface State {
  scenarioId: string;
  screen: Screen;
  filters: Filters;
  professionalId: string | null;
  modality: Modality | null;
  dayOffset: number;
  time: string | null;
  form: BookingForm;
  errors: Partial<Record<keyof BookingForm, string>>;
  submitting: boolean;
  failure: string | null;
  blocked: string[];
  appointment: Appointment | null;
}

const noFilters: Filters = {
  specialty: '',
  language: '',
  modality: '',
  maxFee: 0,
};

export function createInitialState(scenarioId: string): State {
  return {
    scenarioId,
    screen: 'directorio',
    filters: noFilters,
    professionalId: null,
    modality: null,
    dayOffset: 0,
    time: null,
    form: { name: '', email: '', reason: '', consent: false },
    errors: {},
    submitting: false,
    failure: null,
    blocked: [],
    appointment: null,
  };
}

export type Action =
  | { type: 'filter'; name: keyof Filters; value: string | number }
  | { type: 'clearFilters' }
  | { type: 'openProfile'; professionalId: string }
  | { type: 'goto'; screen: Screen }
  | { type: 'setModality'; modality: Modality }
  | { type: 'setDay'; dayOffset: number }
  | { type: 'setTime'; time: string }
  | { type: 'field'; name: keyof BookingForm; value: string | boolean }
  | { type: 'submit' }
  | { type: 'submitFailed'; message: string; field?: keyof BookingForm; blockSlot?: string }
  | { type: 'submitSucceeded'; appointment: Appointment };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'filter':
      return {
        ...state,
        filters: { ...state.filters, [action.name]: action.value },
      };

    case 'clearFilters':
      return { ...state, filters: noFilters };

    case 'openProfile': {
      const person = findProfessional(action.professionalId);
      return {
        ...state,
        screen: 'perfil',
        professionalId: action.professionalId,
        // Default to the only modality when there is one, so the visitor is
        // not asked a question with a single answer.
        modality: person?.modalities.length === 1 ? person.modalities[0] : null,
        dayOffset: 0,
        time: null,
        failure: null,
      };
    }

    case 'goto':
      return { ...state, screen: action.screen, failure: null };

    case 'setModality':
      return { ...state, modality: action.modality, failure: null };

    case 'setDay':
      return { ...state, dayOffset: action.dayOffset, time: null, failure: null };

    case 'setTime':
      return { ...state, time: action.time, failure: null };

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
        blocked: action.blockSlot
          ? [...state.blocked, action.blockSlot]
          : state.blocked,
        ...(action.blockSlot ? { time: null, screen: 'perfil' as Screen } : {}),
      };

    case 'submitSucceeded':
      return {
        ...state,
        submitting: false,
        appointment: action.appointment,
        screen: 'confirmado',
        failure: null,
      };

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

/**
 * The professionals matching every active filter.
 *
 * Every criterion is applied, including the ones that produce no results —
 * a directory that silently drops a filter to avoid an empty page is lying to
 * somebody who is trying to find help in their own language.
 */
export function matches(state: State): DemoProfessional[] {
  const { specialty, language, modality, maxFee } = state.filters;

  return professionals.filter((person) => {
    if (specialty && !person.specialties.includes(specialty)) return false;
    if (language && !person.languages.includes(language)) return false;
    if (modality && !person.modalities.includes(modality)) return false;
    if (maxFee > 0 && person.fee > maxFee) return false;
    return true;
  });
}

export function activeFilterCount(state: State): number {
  const { specialty, language, modality, maxFee } = state.filters;
  return [specialty, language, modality, maxFee > 0 ? 'fee' : ''].filter(Boolean)
    .length;
}

export function chosen(state: State): DemoProfessional | undefined {
  return state.professionalId
    ? findProfessional(state.professionalId)
    : undefined;
}

export function diaryDays(): { offset: number; date: Date }[] {
  return Array.from({ length: DIARY_DAYS }, (_, offset) => ({
    offset,
    date: demoDate(offset),
  }));
}

export function daySlots(state: State): DemoSlot[] {
  if (!state.professionalId) return [];
  return slotsFor(state.professionalId, state.dayOffset, state.blocked);
}

export function canBook(state: State): boolean {
  return (
    state.professionalId !== null &&
    state.modality !== null &&
    state.time !== null
  );
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function validate(
  form: BookingForm,
): Partial<Record<keyof BookingForm, string>> {
  const errors: Partial<Record<keyof BookingForm, string>> = {};

  if (form.name.trim().length < 2) {
    errors.name = 'Please enter your name.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = 'We need a valid email address to send you the link.';
  }

  if (!form.consent) {
    errors.consent =
      'We need your consent to process the details of this appointment.';
  }

  return errors;
}

export function bookAppointment(state: State): DemoResult<Appointment> {
  const person = chosen(state);

  if (!person || !state.modality || !state.time) {
    return fail('incomplete', 'Choose a professional, a format and a time.');
  }

  const errors = validate(state.form);
  const firstBad = (Object.keys(errors) as (keyof BookingForm)[])[0];
  if (firstBad) {
    return fail('invalid', errors[firstBad] as string, firstBad);
  }

  const key = slotKey(person.id, state.dayOffset, state.time);

  if (state.blocked.includes(key)) {
    return fail('taken', 'That time is no longer free. Please choose another.');
  }

  if (
    person.id === CONTESTED.professionalId &&
    state.dayOffset === CONTESTED.dayOffset &&
    state.time === CONTESTED.time
  ) {
    return fail(
      'taken',
      'That time was taken while you were filling in the form. We have removed it from the diary — please choose another.',
    );
  }

  return ok({
    code: appointmentCode(person.id, state.dayOffset, state.time),
    professionalId: person.id,
    dayOffset: state.dayOffset,
    time: state.time,
    modality: state.modality,
    fee: person.fee,
    name: state.form.name.trim(),
  });
}

function appointmentCode(
  professionalId: string,
  dayOffset: number,
  time: string,
): string {
  const seed =
    professionalId.length * 61 + dayOffset * 17 + Number(time.replace(':', ''));
  return `MS-${(2000 + (seed % 8000)).toString()}`;
}
