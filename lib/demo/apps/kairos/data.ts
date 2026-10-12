/**
 * Kairós demo fixtures.
 *
 * ─── Where these come from ────────────────────────────────────────────────
 * The shapes are the product's own: `RawCounter` is the record Kairós keeps
 * in localStorage (frontend/src/lib/counters.ts in the Kairós repository), the
 * six categories and their colours are frontend/src/lib/types.ts, and an
 * alarm event is the row its alarm history lists (lib/store.ts). The counters
 * themselves are invented — five ordinary things a person might count the days
 * of — and belong to nobody.
 *
 * ─── Time is a fixture too ────────────────────────────────────────────────
 * Kairós is a clock: everything it shows is a function of "now". A demo that
 * read the visitor's clock would show different numbers to every visitor and
 * a different story every hour, so the demo carries its own clock. Each
 * scenario fixes the moment it starts at, and the demo counts real seconds
 * from there. Start dates are offsets from the demo's anchor Monday, so
 * "Sin fumar" is on day 29 at 23:59:20 for everyone, forever.
 *
 * Dates are calendar days in UTC throughout — the product's "local calendar
 * date" with the timezone fixed, so no visitor's daylight-saving change can
 * make a day 23 hours long.
 */

import { DEMO_ANCHOR_DATE } from '@/lib/demo/format';

export interface CategoryDef {
  label: string;
  /** The bar, ring and streak colour — the same in both themes. */
  bar: string;
}

/** The product's six categories, in its order. */
export const CATEGORIES = {
  habito: { label: 'Hábito', bar: '#F59E0B' },
  proyecto: { label: 'Proyecto', bar: '#06B6D4' },
  salud: { label: 'Salud', bar: '#10B981' },
  relacion: { label: 'Relación', bar: '#F43F5E' },
  desafio: { label: 'Desafío', bar: '#8B5CF6' },
  meta: { label: 'Meta personal', bar: '#0EA5E9' },
} as const satisfies Record<string, CategoryDef>;

export type Category = keyof typeof CATEGORIES;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

/** The persisted shape, as the product stores it. */
export interface RawCounter {
  id: string;
  title: string;
  category: Category;
  note: string;
  /** The marked day, `YYYY-MM-DD`. Day 0. */
  start_date: string;
  target_day: number | null;
  /** `HH:MM`, or null. */
  alarm_time: string | null;
  /** The highest milestone already announced. */
  last_notified_milestone: number;
  completed_dates: string[];
  missed_dates: string[];
}

export interface AlarmEvent {
  id: string;
  counter_id: string;
  title: string;
  fired_date: string;
  /** `HH:MM` the alarm went off at. With `fired_date`, the sort key. */
  fired_time: string;
  answered: boolean;
}

/** The anchor Monday, `2026-09-14`. Day offsets below count from it. */
export const ANCHOR = DEMO_ANCHOR_DATE.toISOString().slice(0, 10);

const ANCHOR_DAY = Math.floor(DEMO_ANCHOR_DATE.getTime() / 86_400_000);

function iso(offset: number): string {
  return new Date((ANCHOR_DAY + offset) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The daily task over the fourteen days ending on the anchor, oldest first:
 * `d` done, `m` missed, `.` not marked. Days before the counter's start are
 * ignored, as the product ignores them.
 */
function checks(pattern: string): Pick<RawCounter, 'completed_dates' | 'missed_dates'> {
  const completed: string[] = [];
  const missed: string[] = [];
  [...pattern].forEach((mark, i) => {
    const day = iso(i - (pattern.length - 1));
    if (mark === 'd') completed.push(day);
    if (mark === 'm') missed.push(day);
  });
  return { completed_dates: completed, missed_dates: missed };
}

/**
 * Five counters, in creation order.
 *
 * `last_notified_milestone` is left at 0 here and set by the scenario to the
 * milestone each counter has already reached, so opening the demo does not
 * announce a month of old milestones at once.
 */
export const COUNTERS: readonly RawCounter[] = [
  {
    id: 'c-fumar',
    title: 'Sin fumar',
    category: 'salud',
    note: 'El último cigarrillo fue después de la cena de mi cumpleaños.',
    start_date: iso(-29),
    target_day: null,
    alarm_time: null,
    last_notified_milestone: 0,
    ...checks('dddddddddddddd'),
  },
  {
    id: 'c-correr',
    title: 'Correr cada mañana',
    category: 'habito',
    note: '5 km antes de empezar a trabajar.',
    start_date: iso(-47),
    target_day: 100,
    alarm_time: '07:00',
    last_notified_milestone: 0,
    ...checks('ddmddd.dddmddd'),
  },
  {
    id: 'c-tienda',
    title: 'Tienda online abierta',
    category: 'proyecto',
    note: 'Desde el primer pedido.',
    start_date: iso(-12),
    target_day: null,
    alarm_time: null,
    last_notified_milestone: 0,
    ...checks('..dd.ddd.dd.dd'),
  },
  {
    id: 'c-casa',
    title: 'Desde que nos mudamos',
    category: 'relacion',
    note: 'La casa nueva.',
    start_date: iso(-213),
    target_day: 365,
    alarm_time: null,
    last_notified_milestone: 0,
    ...checks('ddddddddddmddd'),
  },
  {
    id: 'c-redes',
    title: 'Sin redes sociales',
    category: 'desafio',
    note: 'Treinta días sin abrir ninguna.',
    start_date: iso(-8),
    target_day: 30,
    alarm_time: '22:00',
    last_notified_milestone: 0,
    ...checks('.....ddmdddddd'),
  },
];

/** The week of alarms ending on the anchor, oldest first: answered or not. */
function week(counter: RawCounter, answered: readonly boolean[]): AlarmEvent[] {
  return answered.map((done, i) => {
    const day = iso(i - (answered.length - 1));
    return {
      id: `a-${counter.id}-${day}`,
      counter_id: counter.id,
      title: counter.title,
      fired_date: day,
      fired_time: counter.alarm_time ?? '00:00',
      answered: done,
    };
  });
}

export const ALARM_EVENTS: readonly AlarmEvent[] = [
  ...week(COUNTERS[1], [true, true, false, true, true, true, true]),
  ...week(COUNTERS[4], [true, false, true, true, false, true, false]),
];

export interface ScenarioSetup {
  /** The day the demo opens on, `YYYY-MM-DD`. */
  date: string;
  /** Seconds after midnight the demo clock starts at. */
  time: number;
  featured: string;
}

const at = (h: number, m: number, s: number) => h * 3600 + m * 60 + s;

/**
 * Forty seconds before midnight, with "Sin fumar" on day 29: the first thing
 * the product does on its own is cross a milestone. And the next morning,
 * twenty seconds before the running alarm.
 */
export const SCENARIOS: Record<string, ScenarioSetup> = {
  medianoche: { date: iso(0), time: at(23, 59, 20), featured: 'c-fumar' },
  alarma: { date: iso(1), time: at(6, 59, 40), featured: 'c-correr' },
};

/** Share-card phrases, by category, from frontend/src/lib/shareCard.ts. */
export const PHRASES: Record<Category, readonly string[]> = {
  habito: ['La constancia vence al talento.', 'Un día más, un hábito más fuerte.', 'Los hábitos se forjan en decenas.'],
  proyecto: ['El progreso es el mejor plan.', 'Cada decena, más cerca del lanzamiento.', 'Lo que se mide, mejora.'],
  salud: ['Tu cuerpo te lo agradece.', 'La salud se construye día a día.', 'Fuerte hoy, más fuerte mañana.'],
  relacion: ['Los lazos se tejen con días.', 'Cada día juntos cuenta doble.', 'El tiempo compartido es el regalo.'],
  desafio: ['Los límites se mueven contigo.', 'Diez días más de valentía.', 'La incomodidad es el camino.'],
  meta: ['Una decena más cerca de la meta.', 'Los sueños se cuentan en días.', 'Sigue: el tiempo juega a tu favor.'],
};

/** The hero marquee, verbatim. */
export const MARQUEE = [
  '10 DÍAS: PRIMER IMPACTO',
  '20 DÍAS: HÁBITO FORJADO',
  '30 DÍAS: TRANSFORMACIÓN',
  '50 DÍAS: MEDIO CENTENAR',
  '100 DÍAS: MAESTRÍA',
  'TIEMPO SIEMPRE ACTIVO',
] as const;
