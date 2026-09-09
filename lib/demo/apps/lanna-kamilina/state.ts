import { fail, ok, type DemoResult } from '@/lib/demo/service';
import { demoDate } from '@/lib/demo/format';
import {
  BOOKING_DAYS,
  CONTESTED_SLOT,
  findMaster,
  findService,
  mastersFor,
  services,
  slotKey,
  slotsFor,
  type DemoMaster,
  type DemoService,
  type DemoSlot,
} from './data';

/**
 * Lanna Kamilina — booking, as a four-step machine.
 *
 * ─── What the product's booking actually has to get right ─────────────────
 * Not the form. The form is easy. What a salon booking system has to get right
 * is that the four choices constrain each other: a service determines which
 * masters can perform it, a master's days off remove dates from the calendar,
 * and a date determines which times are free. Change the service and a chosen
 * master may no longer be valid — so this reducer clears what a change
 * invalidates rather than leaving a booking that refers to a master who does
 * not do the work.
 *
 * That cascade is the demo's substance, and it is why the workflow is a
 * reducer rather than four pieces of component state.
 */

export type Tab = 'services' | 'masters' | 'works' | 'booking';

/** 0 service · 1 master · 2 date and time · 3 contact details · 4 confirmed. */
export type Step = 0 | 1 | 2 | 3 | 4;

export interface BookingForm {
  name: string;
  phone: string;
  comment: string;
}

export interface Booking {
  code: string;
  serviceId: string;
  masterId: string;
  dayOffset: number;
  time: string;
  price: number;
  name: string;
}

export interface State {
  scenarioId: string;
  tab: Tab;
  step: Step;
  /** Filter on the service list, not part of the booking. */
  category: string | null;
  serviceId: string | null;
  masterId: string | null;
  dayOffset: number | null;
  time: string | null;
  form: BookingForm;
  errors: Partial<Record<keyof BookingForm, string>>;
  submitting: boolean;
  failure: string | null;
  /**
   * Slots taken since the page was opened.
   *
   * Exists so the contested slot becomes genuinely unavailable after it
   * refuses a booking, instead of refusing the same choice forever.
   */
  blocked: string[];
  booking: Booking | null;
}

export function createInitialState(scenarioId: string): State {
  return {
    scenarioId,
    tab: 'services',
    step: 0,
    category: null,
    serviceId: null,
    masterId: null,
    dayOffset: null,
    time: null,
    form: { name: '', phone: '', comment: '' },
    errors: {},
    submitting: false,
    failure: null,
    blocked: [],
    booking: null,
  };
}

export type Action =
  | { type: 'setTab'; tab: Tab }
  | { type: 'setCategory'; category: string | null }
  | { type: 'chooseService'; serviceId: string }
  | { type: 'chooseMaster'; masterId: string }
  | { type: 'chooseDay'; dayOffset: number }
  | { type: 'chooseTime'; time: string }
  | { type: 'setStep'; step: Step }
  | { type: 'field'; name: keyof BookingForm; value: string }
  | { type: 'submit' }
  | { type: 'submitFailed'; message: string; blockSlot?: string }
  | { type: 'submitSucceeded'; booking: Booking }
  | { type: 'startOver' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab };

    case 'setCategory':
      return { ...state, category: action.category };

    case 'chooseService': {
      // Changing the service invalidates a master who does not perform it, and
      // a master change invalidates the slot. Cleared rather than carried.
      const stillValid =
        state.masterId !== null &&
        mastersFor(action.serviceId).some((m) => m.id === state.masterId);

      return {
        ...state,
        tab: 'booking',
        serviceId: action.serviceId,
        masterId: stillValid ? state.masterId : null,
        dayOffset: stillValid ? state.dayOffset : null,
        time: stillValid ? state.time : null,
        step: 1,
        failure: null,
      };
    }

    case 'chooseMaster':
      return {
        ...state,
        masterId: action.masterId,
        // A different master has a different diary.
        dayOffset: state.masterId === action.masterId ? state.dayOffset : null,
        time: state.masterId === action.masterId ? state.time : null,
        step: 2,
        failure: null,
      };

    case 'chooseDay':
      return { ...state, dayOffset: action.dayOffset, time: null, failure: null };

    case 'chooseTime':
      return { ...state, time: action.time, failure: null };

    case 'setStep':
      return { ...state, step: action.step, failure: null };

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
        failure: action.message,
        blocked: action.blockSlot
          ? [...state.blocked, action.blockSlot]
          : state.blocked,
        // A slot that has just gone means going back to pick another one.
        ...(action.blockSlot ? { time: null, step: 2 as Step } : {}),
      };

    case 'submitSucceeded':
      return {
        ...state,
        submitting: false,
        booking: action.booking,
        step: 4,
        failure: null,
      };

    case 'startOver':
      return {
        ...createInitialState(state.scenarioId),
        // What the salon has learned about its own diary survives; the visitor
        // starting a second booking should not be re-offered a taken slot.
        blocked: state.blocked,
        tab: 'booking',
      };

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function visibleServices(state: State): DemoService[] {
  return state.category === null
    ? [...services]
    : services.filter((service) => service.category === state.category);
}

export function chosenService(state: State): DemoService | undefined {
  return state.serviceId ? findService(state.serviceId) : undefined;
}

export function chosenMaster(state: State): DemoMaster | undefined {
  return state.masterId ? findMaster(state.masterId) : undefined;
}

export function availableMasters(state: State): DemoMaster[] {
  return state.serviceId ? mastersFor(state.serviceId) : [];
}

export interface DemoDay {
  offset: number;
  date: Date;
  weekday: number;
  /** False on the master's day off, or when every slot is gone. */
  open: boolean;
}

/** The next seven days for the chosen master. */
export function bookableDays(state: State): DemoDay[] {
  const master = chosenMaster(state);
  if (!master) return [];

  return Array.from({ length: BOOKING_DAYS }, (_, offset) => {
    const date = demoDate(offset);
    // The anchor is a Monday, so `offset % 7` is the weekday index directly.
    const weekday = offset % 7;
    const open =
      !master.daysOff.includes(weekday) &&
      slotsFor(master.id, offset, weekday, state.blocked).some((s) => s.available);

    return { offset, date, weekday, open };
  });
}

export function daySlots(state: State): DemoSlot[] {
  if (!state.masterId || state.dayOffset === null) return [];
  return slotsFor(
    state.masterId,
    state.dayOffset,
    state.dayOffset % 7,
    state.blocked,
  );
}

/** Whether the current step has everything it needs to move on. */
export function canAdvance(state: State): boolean {
  switch (state.step) {
    case 0:
      return state.serviceId !== null;
    case 1:
      return state.masterId !== null;
    case 2:
      return state.dayOffset !== null && state.time !== null;
    case 3:
      return Object.keys(validate(state.form)).length === 0;
    default:
      return false;
  }
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function validate(
  form: BookingForm,
): Partial<Record<keyof BookingForm, string>> {
  const errors: Partial<Record<keyof BookingForm, string>> = {};

  if (form.name.trim().length < 2) {
    errors.name = 'Укажите, как к вам обращаться.';
  }

  // Russian mobile numbers are ten digits after the country code; both the
  // 8 and +7 forms are accepted, as they would be on the real site.
  const digits = form.phone.replace(/\D/g, '').replace(/^[78]/, '');
  if (digits.length !== 10) {
    errors.phone = 'Введите номер телефона из 10 цифр.';
  }

  return errors;
}

export function confirmBooking(state: State): DemoResult<Booking> {
  const service = chosenService(state);
  const master = chosenMaster(state);

  if (!service || !master || state.dayOffset === null || !state.time) {
    return fail('incomplete', 'Выберите услугу, мастера, дату и время.');
  }

  const errors = validate(state.form);
  const firstBad = (Object.keys(errors) as (keyof BookingForm)[])[0];
  if (firstBad) {
    return fail('invalid', errors[firstBad] as string, firstBad);
  }

  const key = slotKey(master.id, state.dayOffset, state.time);

  if (state.blocked.includes(key)) {
    return fail('taken', 'Это время уже занято. Выберите другое.');
  }

  if (
    master.id === CONTESTED_SLOT.masterId &&
    state.dayOffset === CONTESTED_SLOT.dayOffset &&
    state.time === CONTESTED_SLOT.time
  ) {
    return fail(
      'taken',
      'Пока вы заполняли форму, это время заняли. Мы убрали его из расписания — выберите, пожалуйста, другое.',
    );
  }

  return ok({
    code: bookingCode(master.id, state.dayOffset, state.time),
    serviceId: service.id,
    masterId: master.id,
    dayOffset: state.dayOffset,
    time: state.time,
    price: service.price,
    name: state.form.name.trim(),
  });
}

/** Derived from the slot, so the same booking always has the same code. */
function bookingCode(masterId: string, dayOffset: number, time: string): string {
  const seed = masterId.length * 97 + dayOffset * 31 + Number(time.replace(':', ''));
  return `LK-${(1000 + (seed % 9000)).toString()}`;
}
