import type { DurationRange, IsoDate, PriceInfo, Rub, TimeSlot } from '../types';
import { plural } from './utils';

const rub = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
});

/** `4 500 ₽` — narrow no-break space before the sign, as Russian typography wants. */
export function formatRub(value: Rub): string {
  return `${rub.format(value)} ₽`;
}

/**
 * Price as the customer should read it.
 * `от 4 500 ₽` when the number is a floor, `4 500 ₽` when it is the real price,
 * `4 500 – 9 000 ₽` when the salon quotes a band.
 */
export function formatPrice(price: PriceInfo): string {
  if (price.to && price.to !== price.from) {
    return `${rub.format(price.from)} – ${formatRub(price.to)}`;
  }
  return price.exact ? formatRub(price.from) : `от ${formatRub(price.from)}`;
}

/** `1 ч 30 мин`, `2–4 ч`. Durations sell as strongly as prices do. */
export function formatDuration(duration: DurationRange): string {
  const one = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h} ч ${m} мин`;
    if (h) return `${h} ч`;
    return `${m} мин`;
  };

  if (duration.max && duration.max !== duration.min) {
    const hMin = duration.min / 60;
    const hMax = duration.max / 60;
    if (Number.isInteger(hMin) && Number.isInteger(hMax)) {
      return `${hMin}–${hMax} ч`;
    }
    return `${one(duration.min)} – ${one(duration.max)}`;
  }
  return one(duration.min);
}

const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** `10:30` → `630`. Minutes since midnight, salon-local — the arithmetic unit for schedules. */
export function parseTimeSlot(slot: TimeSlot): number {
  const [h, m] = slot.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** `630` → `10:30`. */
export function toTimeSlot(minutes: number): TimeSlot {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `12 марта` */
export function formatDayMonth(iso: IsoDate): string {
  const date = parseIsoDate(iso);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** `сегодня` / `завтра` / `чт, 12 марта` — relative labels shorten the scan. */
export function formatDateLabel(iso: IsoDate, today = new Date()): string {
  const date = parseIsoDate(iso);
  const diff = Math.round(
    (date.setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  const d = parseIsoDate(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${formatDayMonth(iso)}`;
}

export function weekdayShort(iso: IsoDate): string {
  return WEEKDAYS_SHORT[parseIsoDate(iso).getDay()];
}

export function dayNumber(iso: IsoDate): string {
  return String(parseIsoDate(iso).getDate());
}

export function isWeekend(iso: IsoDate): boolean {
  const day = parseIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

/** `4,9` — Russian decimal comma. */
export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function formatReviewCount(count: number): string {
  return `${count} ${plural(count, 'отзыв', 'отзыва', 'отзывов')}`;
}

export function formatYears(count: number): string {
  return `${count} ${plural(count, 'год', 'года', 'лет')}`;
}

/** Years of practice, phrased as experience rather than as a raw number. */
export function formatExperience(years: number): string {
  return `${formatYears(years)} в профессии`;
}

/** `+7 (999) 123-45-67` from digits; passes through anything already formatted. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return raw;
  const d = digits.replace(/^8/, '7');
  return `+${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

export function phoneHref(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^8/, '7');
  return `tel:+${digits}`;
}

/** `@handle` → `https://t.me/handle`; passes through a full link unchanged. */
export function telegramHref(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://t.me/${raw.replace(/^@/, '')}`;
}

/** `+7 495 000-00-00` → `https://wa.me/74950000000`. */
export function whatsappHref(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://wa.me/${raw.replace(/\D/g, '').replace(/^8/, '7')}`;
}

/**
 * Map links.
 *
 * The salon has no canonical organisation pages on Yandex or 2GIS yet, so a
 * click on the address falls back to a search for the real street address —
 * both services resolve it to the right point and hand over to navigation, and
 * both open their mobile apps when one is installed. A verified organisation
 * URL always wins over a derived search link.
 */
function mapQuery(address: string, city: string): string {
  return encodeURIComponent(`${city}, ${address}`);
}

/** `https://yandex.ru/maps/?text=Москва%2C%20…` */
export function yandexMapsHref(address: string, city: string): string {
  return `https://yandex.ru/maps/?text=${mapQuery(address, city)}`;
}

/** 2GIS scopes its search by city slug; an unknown city falls back to global search. */
const TWO_GIS_CITY_SLUGS: Record<string, string> = {
  'Москва': 'moscow',
  'Санкт-Петербург': 'spb',
};

/** `https://2gis.ru/moscow/search/Москва%2C%20…` */
export function twoGisHref(address: string, city: string): string {
  const slug = TWO_GIS_CITY_SLUGS[city];
  return `https://2gis.ru/${slug ? `${slug}/` : ''}search/${mapQuery(address, city)}`;
}
