/**
 * Date helpers. The app works with ISO strings at the service boundary and
 * Date objects inside the UI, so a swap to a real backend changes nothing here.
 */

const LOCALE = 'en-GB';

/* ── LOCAL OPTIMISATION, not the product's code ──────────────────────────────
   The formatters below are constructed once instead of on every call.

   In the product each `format*` function built a new `Intl.DateTimeFormat`
   per invocation, and `AvailabilityCalendar` calls `formatDateLong` once per
   cell — so a month grid constructed 35–42 formatters on every render, and
   re-rendered on every day the visitor clicked. Constructing a DateTimeFormat
   is among the more expensive things a render loop can do.

   This is a pure hoist: identical output, same locale, same options. It is the
   only place the vendored tree departs from its source for performance rather
   than isolation, and it is recorded in docs/upstream-findings.md so the fix
   can be made in the product itself — at which point this block disappears on
   the next re-copy.
   ────────────────────────────────────────────────────────────────────────── */
const DATE_FMT = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DATE_LONG_FMT = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const MONTH_YEAR_FMT = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
});

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Local calendar key (YYYY-MM-DD), not UTC — avoids off-by-one day bugs. */
export function dateKey(value: string | Date): string {
  const d = toDate(value);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function formatDate(value: string | Date): string {
  return DATE_FMT.format(toDate(value));
}

export function formatDateLong(value: string | Date): string {
  return DATE_LONG_FMT.format(toDate(value));
}

export function formatTime(value: string | Date): string {
  return TIME_FMT.format(toDate(value));
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function formatMonthYear(value: string | Date): string {
  return MONTH_YEAR_FMT.format(toDate(value));
}

export function addDays(value: string | Date, days: number): Date {
  const d = toDate(value);
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  return next;
}

export function addMinutes(value: string | Date, minutes: number): Date {
  return new Date(toDate(value).getTime() + minutes * 60_000);
}

export function startOfDay(value: string | Date): Date {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function isPast(value: string | Date): boolean {
  return toDate(value).getTime() < Date.now();
}

export function isToday(value: string | Date): boolean {
  return isSameDay(value, new Date());
}

/**
 * Human relative time, e.g. "in 2 h 15 min" / "3 days ago".
 * Returns null when the difference is not worth showing (over ~14 days).
 */
export function relativeTime(value: string | Date): string | null {
  const diffMs = toDate(value).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);

  if (minutes < 1) return diffMs >= 0 ? 'in less than a minute' : 'just now';
  if (abs > 14 * 24 * 60 * 60_000) return null;

  const label = (() => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const rest = minutes % 60;
      return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
    }
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  })();

  return diffMs >= 0 ? `in ${label}` : `${label} ago`;
}

/** Days in the month of `value`, padded to whole weeks starting Monday. */
export function calendarGrid(value: string | Date): Date[] {
  const d = toDate(value);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);

  // getDay(): 0 = Sunday. Shift so Monday = 0.
  const leading = (first.getDay() + 6) % 7;
  const trailing = 6 - ((last.getDay() + 6) % 7);

  const cells: Date[] = [];
  for (let i = leading; i > 0; i -= 1) cells.push(addDays(first, -i));
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(new Date(d.getFullYear(), d.getMonth(), day));
  }
  for (let i = 1; i <= trailing; i += 1) cells.push(addDays(last, i));
  return cells;
}
