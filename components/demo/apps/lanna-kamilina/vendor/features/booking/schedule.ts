import type { IsoDate, TimeSlot } from '../../types';
import { parseTimeSlot, toIsoDate } from '../../lib/format';

/**
 * THE APPOINTMENT BOOK
 *
 * Every confirmed booking is written down here against one named master, and
 * the calendar reads it back: a slot someone has already taken is not offered
 * again. Without this the picker would keep showing time that no longer exists
 * — the visitor picks 14:00, the administrator has to phone back and move them.
 *
 * The ledger lives in `localStorage`, because the site has no backend to write
 * to. That is an honest limit, not a hidden one: the book is per-device, so it
 * holds the line for one visitor across tabs, reloads and days, but two
 * different phones cannot see each other's bookings. Only a real booking
 * system can do that — and when one arrives it replaces this module wholesale,
 * behind the same three functions the calendar already calls.
 */

const STORAGE_KEY = 'lk.appointments.v1';

export interface Appointment {
  id: string;
  /** The code the customer can quote on the phone. */
  reference: string;
  /** Always one concrete master — "без предпочтения" is resolved before we write. */
  specialistId: string;
  serviceId: string;
  date: IsoDate;
  time: TimeSlot;
  /** How long the chair is occupied, so the next slot knows where it can start. */
  durationMinutes: number;
  createdAt: string;
}

/** Minutes since midnight, `[start, end)`. */
export interface Interval {
  start: number;
  end: number;
}

export interface ReservationInput {
  id: string;
  reference: string;
  specialistId: string;
  serviceId: string;
  date: IsoDate;
  time: TimeSlot;
  durationMinutes: number;
}

/* ------------------------------------------------------------------ store */

let cache: Appointment[] | null = null;
const listeners = new Set<() => void>();
let watchingOtherTabs = false;

/**
 * DEMO DIVERGENCE — the product writes the appointment book to `localStorage`,
 * so one visitor's bookings survive reloads and follow them across tabs. Here
 * it is a Map behind the same `Storage` interface.
 *
 * In memory rather than absent: returning `null` would make `read()` answer
 * `[]` every time, and `reserve()` reads straight from the store rather than
 * from the cache — so two bookings for the same hour would both succeed and
 * the calendar would sell the same slot twice. Everything below this line is
 * the product's code, and it keeps working because the shim is a real Storage.
 *
 * Nothing survives a reload or the demo's Reset, which is the point.
 */
const memory = new Map<string, string>();

const inMemoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  key: (index) => [...memory.keys()][index] ?? null,
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, String(value)),
  removeItem: (key) => void memory.delete(key),
  clear: () => memory.clear(),
};

function storage(): Storage | null {
  return inMemoryStorage;
}

/** @internal Called by the demo's Reset — see vendor/demo-reset.ts. */
export function resetSchedule(): void {
  memory.clear();
  cache = null;
  notify();
}

/** A hand-edited or half-written entry must not be able to blank out a day. */
function isAppointment(value: unknown): value is Appointment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.specialistId === 'string' &&
    typeof item.serviceId === 'string' &&
    typeof item.date === 'string' &&
    typeof item.time === 'string' &&
    typeof item.durationMinutes === 'number' &&
    Number.isFinite(item.durationMinutes)
  );
}

function read(): Appointment[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAppointment) : [];
  } catch {
    return [];
  }
}

function write(appointments: Appointment[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(appointments));
  } catch {
    // A full or read-only store loses the record, not the booking: the request
    // still reaches the salon over the messenger. Failing loudly here would
    // block a visitor for a reason that is none of their business.
  }
}

/** Yesterday's bookings free nothing and would grow the store forever. */
function prune(appointments: Appointment[], today = toIsoDate(new Date())): Appointment[] {
  return appointments.filter((appointment) => appointment.date >= today);
}

function load(): Appointment[] {
  if (cache) return cache;
  const stored = read();
  const kept = prune(stored);
  if (kept.length !== stored.length) write(kept);
  cache = kept;
  return kept;
}

function notify(): void {
  for (const listener of listeners) listener();
}

/* ------------------------------------------------------------------ reads */

/** When this master is occupied on this day. The calendar subtracts these. */
export function getBusyIntervals(specialistId: string, date: IsoDate): Interval[] {
  return load()
    .filter((item) => item.specialistId === specialistId && item.date === date)
    .map((item) => {
      const start = parseTimeSlot(item.time);
      return { start, end: start + item.durationMinutes };
    });
}

/** How full a master's day already is — used to spread «любой мастер» bookings. */
export function countAppointments(specialistId: string, date: IsoDate): number {
  return load().filter((item) => item.specialistId === specialistId && item.date === date).length;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/* ------------------------------------------------------------------ write */

/**
 * Take a slot for one master.
 *
 * Returns `null` when the master is no longer free — another tab may have
 * booked the same time while this form was being filled in, so the check reads
 * straight from the store rather than trusting the cache the calendar was
 * rendered from. The caller is expected to tell the visitor, not to overwrite.
 */
export function reserve(input: ReservationInput): Appointment | null {
  const current = prune(read());
  const wanted: Interval = {
    start: parseTimeSlot(input.time),
    end: parseTimeSlot(input.time) + input.durationMinutes,
  };

  const taken = current.some(
    (item) =>
      item.specialistId === input.specialistId &&
      item.date === input.date &&
      overlaps(wanted, {
        start: parseTimeSlot(item.time),
        end: parseTimeSlot(item.time) + item.durationMinutes,
      }),
  );
  if (taken) {
    cache = current;
    notify();
    return null;
  }

  const appointment: Appointment = { ...input, createdAt: new Date().toISOString() };
  const next = [...current, appointment];
  write(next);
  cache = next;
  notify();
  return appointment;
}

/* --------------------------------------------------------------- watching */

/**
 * Tells the calendar the book has changed — including from another tab, where
 * the `storage` event is the only notice we get.
 */
export function subscribeToSchedule(listener: () => void): () => void {
  listeners.add(listener);

  if (!watchingOtherTabs && typeof window !== 'undefined') {
    watchingOtherTabs = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      cache = null;
      notify();
    });
  }

  return () => {
    listeners.delete(listener);
  };
}
