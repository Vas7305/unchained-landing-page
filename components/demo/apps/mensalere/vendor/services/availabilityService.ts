import { addDays, addMinutes, dateKey, isPast, startOfDay } from '../lib/date';
import type { AvailabilitySlot } from './types';
import { latency, store } from './mock/store';

/**
 * Availability boundary (§86).
 *
 * The mock generates a stable weekly pattern per professional and subtracts
 * appointments that already occupy the calendar. It is deterministic: the same
 * professional and day always produce the same slots, so the UI can be reasoned
 * about and tested.
 */

export interface DayAvailability {
  /** Local YYYY-MM-DD key. */
  date: string;
  availableCount: number;
  /** True when the day is entirely in the past. */
  past: boolean;
}

export interface AvailabilityService {
  getDays(psychologistId: string, from: Date, days: number): Promise<DayAvailability[]>;
  getSlots(
    psychologistId: string,
    date: string,
    durationMinutes: number,
  ): Promise<AvailabilitySlot[]>;
}

/** Small deterministic hash so availability varies per professional and day. */
function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) % 100_000;
  }
  return value;
}

const WEEKDAY_HOURS = [9, 10, 11, 12, 15, 16, 17, 18];
const SATURDAY_HOURS = [10, 11, 12];

const OCCUPYING_STATUSES = new Set(['held', 'pending_payment', 'confirmed', 'in_progress']);

function bookedStartsFor(psychologistId: string, date: string): Set<string> {
  return new Set(
    store.appointments
      .filter(
        (appointment) =>
          appointment.psychologistId === psychologistId &&
          OCCUPYING_STATUSES.has(appointment.status) &&
          dateKey(appointment.start) === date,
      )
      .map((appointment) => new Date(appointment.start).getTime().toString()),
  );
}

function buildSlots(
  psychologistId: string,
  date: string,
  durationMinutes: number,
): AvailabilitySlot[] {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return [];

  const base = new Date(year, month - 1, day);
  const weekday = base.getDay();
  if (weekday === 0) return []; // Closed on Sundays.

  const hours = weekday === 6 ? SATURDAY_HOURS : WEEKDAY_HOURS;
  const booked = bookedStartsFor(psychologistId, date);
  const seed = hash(`${psychologistId}:${date}`);

  return hours.map((hour, index) => {
    const start = addMinutes(base, hour * 60);
    // A stable subset of the week is simply not offered by the professional.
    const offered = (seed + index * 7) % 5 !== 0;
    const taken = booked.has(start.getTime().toString());

    return {
      start: start.toISOString(),
      durationMinutes,
      available: offered && !taken && !isPast(start),
    };
  });
}

export const availabilityService: AvailabilityService = {
  async getDays(psychologistId, from, days) {
    const today = startOfDay(new Date());
    const result: DayAvailability[] = [];

    for (let offset = 0; offset < days; offset += 1) {
      const day = addDays(from, offset);
      const key = dateKey(day);
      const past = day.getTime() < today.getTime();
      const slots = past ? [] : buildSlots(psychologistId, key, 50);
      result.push({
        date: key,
        availableCount: slots.filter((slot) => slot.available).length,
        past,
      });
    }

    return latency(result);
  },

  async getSlots(psychologistId, date, durationMinutes) {
    return latency(buildSlots(psychologistId, date, durationMinutes));
  },
};
