import { beforeEach, describe, expect, it } from 'vitest';

import {
  availabilityApi,
  bookingApi,
  SlotUnavailableError,
} from '@/components/demo/apps/lanna-kamilina/vendor/features/booking/api';
import { resetSchedule } from '@/components/demo/apps/lanna-kamilina/vendor/features/booking/schedule';
import {
  getService,
  getSpecialistsForService,
  services,
} from '@/components/demo/apps/lanna-kamilina/vendor/data';
import { toIsoDate, addDays } from '@/components/demo/apps/lanna-kamilina/vendor/lib/format';
import { ANY_SPECIALIST } from '@/components/demo/apps/lanna-kamilina/vendor/types';
import type {
  BookingRequest,
  DayAvailability,
} from '@/components/demo/apps/lanna-kamilina/vendor/types';

/**
 * The salon's own booking layer, exercised directly.
 *
 * The calendar, the durations, the lead time, the "any specialist" pooling and
 * the double-booking guard are the product's code — they are tested here not to
 * re-verify the product, but to prove the three things this demo claims:
 *
 *   1. the demo drives the *real* layer, not a copy of it;
 *   2. the appointment book is honest — a booked slot genuinely stops being on
 *      offer, and a second attempt at it is refused rather than silently
 *      double-sold;
 *   3. Reset really does empty the book, which matters because the book is a
 *      module singleton and survives the remount that resets everything else.
 *
 * Node environment, no DOM: all of this is reachable without rendering, which
 * is a property of how the product separated its booking layer from its views.
 */

const SERVICE = 'svc-womens-cut';

/** A day far enough out that the 90-minute lead time cannot empty it. */
function window14(): Promise<DayAvailability[]> {
  return availabilityApi.getAvailability({
    serviceId: SERVICE,
    specialist: ANY_SPECIALIST,
    from: toIsoDate(new Date()),
    days: 14,
  });
}

async function firstOpenDay(): Promise<DayAvailability> {
  const days = await window14();
  const day = days.find((item) => item.slots.length > 0);
  if (!day) throw new Error('the sample fortnight has no open slot at all');
  return day;
}

/**
 * A day and time that one named master is actually free at.
 *
 * The pooled calendar answers "somebody can take this hour", which is not the
 * same question — booking a specific master at a pooled slot is refused when it
 * was a colleague who was free. Anything asserting about one master's column
 * has to read that master's own calendar.
 */
async function firstOpenFor(specialistId: string): Promise<{ day: DayAvailability; time: string }> {
  const days = await availabilityApi.getAvailability({
    serviceId: SERVICE,
    specialist: specialistId,
    from: toIsoDate(new Date()),
    days: 14,
  });
  const day = days.find((item) => item.slots.length > 0);
  if (!day) throw new Error(`${specialistId} has no free slot in the sample fortnight`);
  return { day, time: day.slots[0] };
}

function requestFor(day: DayAvailability, time: string): BookingRequest {
  return {
    serviceId: SERVICE,
    specialist: ANY_SPECIALIST,
    date: day.date,
    time: time as BookingRequest['time'],
    name: 'Тестовый клиент',
    phone: '+7 495 000-00-00',
    consent: true,
  } as BookingRequest;
}

beforeEach(() => {
  resetSchedule();
});

describe('the calendar it shows', () => {
  it('comes from the salon’s own availability layer', async () => {
    const days = await window14();

    expect(days).toHaveLength(14);
    expect(days[0].date).toBe(toIsoDate(new Date()));
    expect(days.some((day) => day.slots.length > 0)).toBe(true);
  });

  it('offers only times the whole appointment fits into', async () => {
    const service = getService(SERVICE);
    const duration = service?.duration.max ?? service?.duration.min ?? 60;
    const days = await window14();

    // The salon closes at 21:00, so nothing may start later than that minus
    // the job's length — offering it would be a booking the salon has to undo.
    const lastStart = 21 * 60 - duration;
    for (const day of days) {
      for (const slot of day.slots) {
        const [h, m] = slot.split(':').map(Number);
        expect(h * 60 + m).toBeLessThanOrEqual(lastStart);
      }
    }
  });

  it('gives a long service fewer windows than a short one', async () => {
    const short = getService('svc-womens-cut');
    const long = services.find((s) => (s.duration.max ?? 0) > (short?.duration.max ?? 0));
    expect(long).toBeDefined();

    const from = toIsoDate(addDays(new Date(), 1));
    const [shortDays, longDays] = await Promise.all([
      availabilityApi.getAvailability({ serviceId: SERVICE, specialist: ANY_SPECIALIST, from, days: 14 }),
      availabilityApi.getAvailability({ serviceId: long!.id, specialist: ANY_SPECIALIST, from, days: 14 }),
    ]);

    const count = (days: DayAvailability[]) =>
      days.reduce((total, day) => total + day.slots.length, 0);

    expect(count(longDays)).toBeLessThan(count(shortDays));
  });

  it('gives “any specialist” at least as much time as one named master', async () => {
    const named = getSpecialistsForService(SERVICE)[0];
    const from = toIsoDate(addDays(new Date(), 1));

    const [pooled, single] = await Promise.all([
      availabilityApi.getAvailability({ serviceId: SERVICE, specialist: ANY_SPECIALIST, from, days: 14 }),
      availabilityApi.getAvailability({ serviceId: SERVICE, specialist: named.id, from, days: 14 }),
    ]);

    const count = (days: DayAvailability[]) =>
      days.reduce((total, day) => total + day.slots.length, 0);

    expect(count(pooled)).toBeGreaterThanOrEqual(count(single));
  });
});

describe('booking', () => {
  it('returns a reference the visitor could quote', async () => {
    const day = await firstOpenDay();
    const confirmation = await bookingApi.submit(requestFor(day, day.slots[0]), 'whatsapp');

    expect(confirmation.reference).toMatch(/^LK-\d{4}-\d{4}$/);
    expect(confirmation.assignedSpecialist).toBeTruthy();
  });

  it('assigns “any specialist” to a real person', async () => {
    const day = await firstOpenDay();
    const eligible = getSpecialistsForService(SERVICE).map((s) => s.id);
    const confirmation = await bookingApi.submit(requestFor(day, day.slots[0]), 'whatsapp');

    // The slot has to leave somebody's column, or it would stay on sale after
    // it was sold.
    expect(eligible).toContain(confirmation.assignedSpecialist);
  });

  it('is deterministic — the same request produces the same reference', async () => {
    const day = await firstOpenDay();
    const request = requestFor(day, day.slots[0]);

    const first = await bookingApi.submit(request, 'whatsapp');
    resetSchedule();
    const second = await bookingApi.submit(request, 'whatsapp');

    expect(second.reference).toBe(first.reference);
  });
});

describe('the appointment book', () => {
  it('takes the slot out of the calendar once it is booked', async () => {
    const master = getSpecialistsForService(SERVICE)[0];
    const { day, time } = await firstOpenFor(master.id);

    const read = () =>
      availabilityApi.getAvailability({
        serviceId: SERVICE,
        specialist: master.id,
        from: day.date,
        days: 1,
      });

    const before = await read();
    expect(before[0].slots).toContain(time);

    await bookingApi.submit({ ...requestFor(day, time), specialist: master.id }, 'whatsapp');

    const after = await read();
    expect(after[0].slots).not.toContain(time);
    expect(after[0].slots.length).toBeLessThan(before[0].slots.length);
  });

  it('refuses the hour once every eligible master is taken', async () => {
    const day = await firstOpenDay();
    const time = day.slots[0];
    const eligible = getSpecialistsForService(SERVICE);

    // Fill the pool at that hour. A master already busy then simply refuses —
    // which is the same end state, and is why the throw is swallowed.
    for (const master of eligible) {
      try {
        await bookingApi.submit({ ...requestFor(day, time), specialist: master.id }, 'whatsapp');
      } catch {
        // Already busy at that hour in the demo column — that is the point.
      }
    }

    // One more attempt has nowhere to go. This is the path the booking form
    // shows as "это время уже занято" — reachable on purpose, and repeatable.
    await expect(bookingApi.submit(requestFor(day, time), 'whatsapp')).rejects.toBeInstanceOf(
      SlotUnavailableError,
    );
  });
});

describe('reset', () => {
  it('empties the book, so the next visitor sees the calendar the first one did', async () => {
    const master = getSpecialistsForService(SERVICE)[0];
    const { day, time } = await firstOpenFor(master.id);

    const read = () =>
      availabilityApi.getAvailability({
        serviceId: SERVICE,
        specialist: master.id,
        from: day.date,
        days: 1,
      });

    const before = await read();

    await bookingApi.submit({ ...requestFor(day, time), specialist: master.id }, 'whatsapp');
    expect((await read())[0].slots).not.toEqual(before[0].slots);

    resetSchedule();
    expect((await read())[0].slots).toEqual(before[0].slots);
  });
});

describe('isolation', () => {
  it('submits through the mock, which delivers nowhere', async () => {
    const day = await firstOpenDay();
    const confirmation = await bookingApi.submit(requestFor(day, day.slots[0]), 'telegram');

    // `messengerBookingApi` records the channel it opened; `mockBookingApi`
    // has no channel to record, because it opens nothing. That absence is the
    // assertion: the demo cannot have sent this booking anywhere.
    expect(confirmation.channel).toBeUndefined();
  });
});
