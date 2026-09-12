import type {
  AvailabilityQuery,
  BookingConfirmation,
  BookingRequest,
  DayAvailability,
  IsoDate,
  TimeSlot,
} from '../../types';
import { ANY_SPECIALIST } from '../../types';
import { addDays, parseIsoDate, parseTimeSlot, toIsoDate, toTimeSlot } from '../../lib/format';
import { seededRandom } from '../../lib/utils';
import { getService, getSpecialistsForService } from '../../data';
import type { DeliveryChannel } from './delivery';
import { countAppointments, getBusyIntervals, overlaps, reserve } from './schedule';
import type { Interval } from './schedule';

/**
 * BOOKING INTEGRATION BOUNDARY
 *
 * Everything the booking UI needs from the outside world is behind these two
 * interfaces. Today they are satisfied by deterministic mocks over a local
 * appointment book (`./schedule`); connecting YClients, Dikidi, an in-house CRM
 * or a REST endpoint means writing new implementations and swapping the two
 * exported instances at the bottom of this file. No component imports anything
 * else from here.
 */

export interface AvailabilityApi {
  getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]>;
}

export interface BookingApi {
  submit(request: BookingRequest, channel: DeliveryChannel): Promise<BookingConfirmation>;
}

/** Raised when the chosen time was taken between opening the calendar and submitting. */
export class SlotUnavailableError extends Error {
  constructor(message = 'Это время уже занято.') {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

/* ----------------------------------------------------------------- config */

/** Demo working window. Real hours arrive with the salon's own schedule. */
const OPEN_HOUR = 10;
const CLOSE_HOUR = 21;
const SLOT_MINUTES = 30;
/** Minimum notice before a slot can be booked online. */
const LEAD_TIME_MINUTES = 90;
/**
 * How busy a demo master's day is. Tuned so a haircut has a dozen options a
 * day while a five-hour blonde has a handful of windows a fortnight — scarce
 * enough to be honest, not so scarce that the calendar looks broken.
 */
const DEMO_LOAD = 0.15;

function durationOf(serviceId: string): number {
  const service = getService(serviceId);
  return service?.duration.max ?? service?.duration.min ?? 60;
}

/** Masters who can actually take this booking — the pool the calendar draws on. */
function poolFor(query: Pick<AvailabilityQuery, 'serviceId' | 'specialist'>): string[] {
  const eligible = getSpecialistsForService(query.serviceId).map((item) => item.id);
  // A stale deep link can still name a master who no longer performs the
  // service; intersecting here keeps the calendar from inventing their time.
  return query.specialist === ANY_SPECIALIST
    ? eligible
    : eligible.filter((id) => id === query.specialist);
}

/* ------------------------------------------------------------------- mock */

/**
 * The appointments a master already has before this visitor arrives.
 *
 * Demo content, deterministic: the same master's day looks the same on every
 * render and in every tab, so the calendar does not reshuffle and a shared link
 * shows what the sender saw. Keyed by master and date only — switching between
 * services must not redraw someone's day, because in real life it doesn't.
 */
function demoBusy(specialistId: string, date: IsoDate): Interval[] {
  const random = seededRandom(`${date}:${specialistId}`);
  const lengths = [60, 90, 120, 180];
  const close = CLOSE_HOUR * 60;
  const busy: Interval[] = [];

  let cursor = OPEN_HOUR * 60;
  while (cursor < close) {
    if (random() < DEMO_LOAD) {
      const length = lengths[Math.floor(random() * lengths.length)] ?? 60;
      const end = Math.min(cursor + length, close);
      busy.push({ start: cursor, end });
      // A short breather between clients, the way a real column is built.
      cursor = end + SLOT_MINUTES;
    } else {
      cursor += SLOT_MINUTES;
    }
  }

  return busy;
}

/** Everything occupying this master's day: the demo column plus real bookings. */
function busyFor(specialistId: string, date: IsoDate): Interval[] {
  return [...demoBusy(specialistId, date), ...getBusyIntervals(specialistId, date)];
}

/**
 * Start times this master can take a job of `duration` at.
 *
 * A slot is free only when the whole appointment fits before closing and
 * touches nothing already booked — offering 14:00 for a three-hour colour when
 * the master is busy at 15:00 would be a booking the salon has to undo.
 */
function freeStarts(duration: number, busy: Interval[], earliest: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const lastStart = CLOSE_HOUR * 60 - duration;

  for (let start = OPEN_HOUR * 60; start <= lastStart; start += SLOT_MINUTES) {
    if (start < earliest) continue;
    const candidate: Interval = { start, end: start + duration };
    if (busy.some((interval) => overlaps(candidate, interval))) continue;
    slots.push(toTimeSlot(start));
  }

  return slots;
}

/** Today's slots need lead time; later days open from the first appointment. */
function earliestStart(date: IsoDate, now: Date): number {
  if (date !== toIsoDate(now)) return 0;
  return now.getHours() * 60 + now.getMinutes() + LEAD_TIME_MINUTES;
}

/**
 * Availability, read off the masters' columns.
 *
 * "Any specialist" pools capacity across everyone who performs the service, so
 * it genuinely has more free time. Longer services fit into fewer gaps and
 * therefore look scarcer, which is both realistic and honest about why blonde
 * work needs planning.
 */
export const mockAvailabilityApi: AvailabilityApi = {
  async getAvailability(query) {
    const duration = durationOf(query.serviceId);
    const pool = poolFor(query);
    const start = parseIsoDate(query.from);
    const now = new Date();
    const days: DayAvailability[] = [];

    for (let index = 0; index < query.days; index += 1) {
      const date = toIsoDate(addDays(start, index));
      const earliest = earliestStart(date, now);
      const open = new Set<TimeSlot>();

      for (const specialistId of pool) {
        for (const slot of freeStarts(duration, busyFor(specialistId, date), earliest)) {
          open.add(slot);
        }
      }

      const slots = [...open].sort((a, b) => parseTimeSlot(a) - parseTimeSlot(b));
      days.push({ date, slots, closed: false });
    }

    // A short delay keeps the loading state on the real code path.
    await new Promise((resolve) => setTimeout(resolve, 180));
    return days;
  },
};

/* -------------------------------------------------------------- recording */

/**
 * Who takes an appointment the visitor did not assign.
 *
 * "Без предпочтения" still has to occupy one person's column, or the slot would
 * stay on sale after it was sold. Among the masters actually free at that hour,
 * the emptiest day wins, so the pool's bookings spread instead of piling onto
 * whoever happens to be first in the list.
 */
function assignSpecialist(request: BookingRequest, duration: number): string | null {
  const wanted: Interval = {
    start: parseTimeSlot(request.time),
    end: parseTimeSlot(request.time) + duration,
  };

  const free = poolFor(request).filter(
    (specialistId) =>
      !busyFor(specialistId, request.date).some((interval) => overlaps(wanted, interval)),
  );

  if (free.length === 0) return null;
  return free.reduce((best, candidate) =>
    countAppointments(candidate, request.date) < countAppointments(best, request.date)
      ? candidate
      : best,
  );
}

/**
 * Write the appointment into the book, so the calendar stops offering it.
 *
 * Throws rather than booking anyway: between opening the calendar and pressing
 * the button, another tab may have taken the same hour, and a silent
 * double-booking is the one outcome an administrator cannot fix quietly.
 */
function recordAppointment(request: BookingRequest, id: string, reference: string): string {
  const duration = durationOf(request.serviceId);
  const specialistId = assignSpecialist(request, duration);
  if (!specialistId) throw new SlotUnavailableError();

  const appointment = reserve({
    id,
    reference,
    specialistId,
    serviceId: request.serviceId,
    date: request.date,
    time: request.time,
    durationMinutes: duration,
  });
  if (!appointment) throw new SlotUnavailableError();

  return specialistId;
}

/**
 * Reference codes.
 *
 * Derived from the appointment itself, so the same request always produces the
 * same code — the customer, the administrator and the chat transcript can all
 * be talking about the same booking.
 */
function newReference(request: BookingRequest): { id: string; reference: string } {
  const stamp = request.date.replace(/-/g, '').slice(4);
  const suffix = String(
    Math.abs(Math.round(seededRandom(`${request.date}${request.time}${request.phone}`)() * 9999)),
  ).padStart(4, '0');

  return { id: `bk_${stamp}_${suffix}`, reference: `LK-${stamp}-${suffix}` };
}

/**
 * Mock booking submission.
 *
 * Returns a confirmation with a quotable reference but delivers it nowhere.
 * Kept for local UI work; never wire it up as `bookingApi` on a live site — a
 * visitor would leave believing they had an appointment nobody received.
 */
export const mockBookingApi: BookingApi = {
  async submit(request) {
    const { id, reference } = newReference(request);
    const assignedSpecialist = recordAppointment(request, id, reference);
    await new Promise((resolve) => setTimeout(resolve, 550));
    return { id, request, reference, createdAt: new Date().toISOString(), assignedSpecialist };
  },
};

/*
 * DEMO DIVERGENCE — `messengerBookingApi` is removed.
 *
 * The product's live submission hands the appointment to WhatsApp or Telegram,
 * because the salon has no booking system to POST to. It does that with
 * `window.open('https://wa.me/<number>?text=…')` and a `clipboard.writeText`,
 * carrying the visitor's name, telephone number and chosen time.
 *
 * Simply not exporting it was not enough: the function would still be in the
 * shipped bundle, one import away from being reachable, and this repository's
 * isolation rule is about what a demo *can* do rather than what it currently
 * does. So the implementation is gone, and with it the only `window.open` and
 * the only clipboard write in the tree.
 *
 * `bookingHandoff` in `./delivery` stays — `BookingDonePage` imports it to
 * offer "open the messenger" on the confirmation screen. It composes a string
 * and nothing more, it is only reached when a confirmation carries a `channel`,
 * and the mock never sets one, so that affordance does not appear.
 */

/* --------------------------------------------------------------- exports */

/** Availability is read off the local appointment book — see `./schedule`. */
export const availabilityApi: AvailabilityApi = mockAvailabilityApi;

/**
 * DEMO DIVERGENCE — the product ships `messengerBookingApi`, which opens
 * WhatsApp or Telegram with the request prefilled. That `window.open` is the
 * only outbound call in this entire tree, and a demo may not send a stranger's
 * name and phone number to a real salon's messenger.
 *
 * No adapter had to be written for it: `mockBookingApi` is the product's own
 * module, ten lines up, and its doc comment says exactly what it is — a
 * confirmation with a quotable reference, delivered nowhere. It still writes
 * the appointment into the book, so the slot genuinely leaves the calendar and
 * the "taken while you were typing" path stays reachable.
 */
export const bookingApi: BookingApi = mockBookingApi;
