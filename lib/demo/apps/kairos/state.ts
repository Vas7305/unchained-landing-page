import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  ALARM_EVENTS,
  CATEGORIES,
  COUNTERS,
  PHRASES,
  SCENARIOS,
  type AlarmEvent,
  type Category,
  type RawCounter,
} from './data';

/**
 * Kairós — counters, milestones every ten days, daily checks and alarms.
 *
 * ─── The rules that make this Kairós ──────────────────────────────────────
 * Every one is the product's own (frontend/src/lib/counters.ts, lib/store.ts
 * and lib/useNotifications.ts in the Kairós repository):
 *
 *   · a counter's days are whole calendar days since its marked day, and a
 *     milestone is every tenth one;
 *   · the ring shows progress to the next ten, or to the target when there
 *     is one;
 *   · a milestone reached and not yet announced is announced once — by the
 *     watcher, whichever way the counter got there: midnight, an edit, the
 *     "+10 días" simulation or a new counter dated in the past;
 *   · a daily alarm goes off at its minute, once a day, and lands in the
 *     history to be answered;
 *   · restarting puts the counter back on day 0 and forgets its milestones
 *     and its checks; duplicating copies the counter but not its history;
 *   · an unmarked past day counts as not done; today stays pending.
 *
 * The one thing the demo adds is its clock: see data.ts.
 */

const DAY_MS = 86_400_000;
const DAY_S = 86_400;
const MAX_ALARMS = 50;

// ── Dates ──────────────────────────────────────────────────────────────────

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function isoOfDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoOfDay(dayNumber(iso) + days);
}

/** Days from `fromIso` to `toIso`, never negative; 0 for a date that does not parse. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = dayNumber(fromIso);
  if (Number.isNaN(from)) return 0;
  return Math.max(0, dayNumber(toIso) - from);
}

/** The product's weekday letters, Sunday first. */
const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export function weekdayLetter(iso: string): string {
  return WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** The Monday of the week `iso` falls in. */
export function mondayOf(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
}

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "14 sept 2026", as the product writes a date. */
export function fmtDate(iso: string): string {
  return DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

export const pad = (n: number) => String(n).padStart(2, '0');

// ── The demo clock ─────────────────────────────────────────────────────────

/** Seconds since the epoch, on the demo's own clock. */
export type Clock = number;

export function todayOf(clock: Clock): string {
  return isoOfDay(Math.floor(clock / DAY_S));
}

/** "23:59:41". */
export function clockLabel(clock: Clock): string {
  const s = ((clock % DAY_S) + DAY_S) % DAY_S;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "23:59". */
export function minuteOf(clock: Clock): string {
  return clockLabel(clock).slice(0, 5);
}

/** The live ticker under the big number: time since the marked day's midnight. */
export function elapsed(startIso: string, clock: Clock) {
  const start = dayNumber(startIso) * DAY_S;
  const diff = Number.isNaN(start) ? 0 : Math.max(0, clock - start);
  return {
    d: Math.floor(diff / DAY_S),
    h: Math.floor((diff % DAY_S) / 3600),
    m: Math.floor((diff % 3600) / 60),
    s: diff % 60,
  };
}

// ── A counter, computed ────────────────────────────────────────────────────

export interface Counter extends RawCounter {
  days_elapsed: number;
  current_milestone: number;
  next_milestone: number;
  days_to_next: number;
  cycle_progress: number;
  milestones_reached: number[];
  pending_milestone: number;
  target_progress: number | null;
}

/** `withComputed` from the product, with "today" passed in rather than read. */
export function computed(c: RawCounter, today: string): Counter {
  const days = daysBetween(c.start_date, today);
  const current = Math.floor(days / 10) * 10;
  const reached: number[] = [];
  for (let m = 10; m <= current; m += 10) reached.push(m);
  const pending = current >= 10 && current > c.last_notified_milestone ? current : 0;
  const targetProgress =
    c.target_day && c.target_day > 0
      ? Math.round(Math.min(1, days / c.target_day) * 10000) / 10000
      : null;

  return {
    ...c,
    days_elapsed: days,
    current_milestone: current,
    next_milestone: current + 10,
    days_to_next: current + 10 - days,
    cycle_progress: Math.round(((days - current) / 10) * 10000) / 10000,
    milestones_reached: reached,
    pending_milestone: pending,
    target_progress: targetProgress,
  };
}

export function categoryOf(key: string) {
  return Object.hasOwn(CATEGORIES, key) ? CATEGORIES[key as Category] : CATEGORIES.habito;
}

export function phraseFor(category: Category, milestone: number): string {
  const list = PHRASES[category] ?? PHRASES.habito;
  return list[Math.max(0, milestone / 10 - 1) % list.length];
}

// ── State ──────────────────────────────────────────────────────────────────

export type DayStatus = 'done' | 'missed' | null;

export interface Toast {
  id: number;
  tone: 'success' | 'info';
  title: string;
  description?: string;
  /** An alarm toast carries "Hecho", which answers this event. */
  alarmEventId?: string;
  /** Whether the bell rings with it, when the bell is on. */
  chime: boolean;
}

/** What the device's own notification tray would show. */
export interface OsNotice {
  id: number;
  title: string;
  body: string;
}

export interface State {
  scenarioId: string;
  clock: Clock;
  counters: RawCounter[];
  alarms: AlarmEvent[];
  featuredId: string | null;
  chimeOn: boolean;
  theme: 'dark' | 'light';
  projector: boolean;
  /** A milestone the featured counter crossed while the projector was up. */
  celebration: number | null;
  simulating: boolean;
  /** The guardian's "Última verificación". */
  lastCheck: Clock;
  toasts: Toast[];
  os: OsNotice[];
  /** Ids for toasts, notices and new counters, so a reset replays identically. */
  seq: number;
}

export interface CounterInput {
  title: string;
  category: Category;
  note: string;
  start_date: string;
  target_day: number | null;
  alarm_time: string | null;
}

export type Action =
  | { type: 'tick' }
  | { type: 'select'; id: string }
  | { type: 'save'; id: string | null; input: CounterInput }
  | { type: 'remove'; id: string }
  | { type: 'restart'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'setDay'; id: string; day: string; status: DayStatus }
  | { type: 'simulateStart' }
  | { type: 'simulateDone'; id: string }
  | { type: 'answerAlarm'; eventId: string }
  | { type: 'sendTest' }
  | { type: 'toggleChime' }
  | { type: 'toggleTheme' }
  | { type: 'projector'; open: boolean }
  | { type: 'celebrated' }
  | { type: 'dismissToast'; id: number }
  | { type: 'dismissOs'; id: number };

export function createInitialState(scenarioId: string): State {
  const id = Object.hasOwn(SCENARIOS, scenarioId) ? scenarioId : 'medianoche';
  const setup = SCENARIOS[id];
  const clock = dayNumber(setup.date) * DAY_S + setup.time;
  const today = setup.date;
  const time = minuteOf(clock);

  const counters = COUNTERS.map((c) => ({
    ...c,
    // Milestones already behind the counter were announced on their day.
    last_notified_milestone: computed(c, today).current_milestone,
    completed_dates: c.completed_dates.filter((d) => d <= today),
    missed_dates: c.missed_dates.filter((d) => d <= today),
  }));

  const alarms = ALARM_EVENTS.filter(
    (e) => e.fired_date < today || (e.fired_date === today && e.fired_time <= time),
  )
    .slice()
    .sort(byFiredDesc);

  return {
    scenarioId: id,
    clock,
    counters,
    alarms,
    featuredId: setup.featured,
    chimeOn: true,
    theme: 'dark',
    projector: false,
    celebration: null,
    simulating: false,
    lastCheck: clock,
    toasts: [],
    os: [],
    seq: 1,
  };
}

function byFiredDesc(a: AlarmEvent, b: AlarmEvent): number {
  return `${b.fired_date} ${b.fired_time}`.localeCompare(`${a.fired_date} ${a.fired_time}`);
}

// ── Selectors ──────────────────────────────────────────────────────────────

export function today(state: State): string {
  return todayOf(state.clock);
}

export function counters(state: State): Counter[] {
  const day = today(state);
  return state.counters.map((c) => computed(c, day));
}

export function featured(state: State): Counter | undefined {
  const list = counters(state);
  return list.find((c) => c.id === state.featuredId) ?? list[0];
}

export function statusOf(c: RawCounter, iso: string): DayStatus {
  if (c.completed_dates.includes(iso)) return 'done';
  if (c.missed_dates.includes(iso)) return 'missed';
  return null;
}

/** The last `days` days up to today, from the marked day on. */
export function checkDays(c: RawCounter, todayIso: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = addDays(todayIso, -i);
    if (iso >= c.start_date) out.push(iso);
  }
  return out;
}

export interface MilestoneEvent {
  key: string;
  counterId: string;
  title: string;
  category: Category;
  milestone: number;
  date: string;
}

/** The fourteen most recent milestones across every counter, newest first. */
export function milestoneLog(state: State): MilestoneEvent[] {
  return counters(state)
    .flatMap((c) =>
      c.milestones_reached.map((m) => ({
        key: `${c.id}:${m}`,
        counterId: c.id,
        title: c.title,
        category: c.category,
        milestone: m,
        date: addDays(c.start_date, m),
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
}

/** "Esta semana: 3/5 respondidas". */
export function alarmWeek(state: State): { answered: number; total: number } {
  const start = mondayOf(today(state));
  const week = state.alarms.filter((e) => e.fired_date >= start);
  return { answered: week.filter((e) => e.answered).length, total: week.length };
}

// ── Decisions ──────────────────────────────────────────────────────────────

/** The form as typed. */
export interface CounterDraft {
  title: string;
  category: Category;
  note: string;
  start_date: string;
  target_day: string;
  alarm_time: string;
}

/**
 * Whether a counter can be saved, and in what form.
 *
 * The product's form requires a title and a date and limits the date picker
 * to today and the target to at least 1. A picker limit is a suggestion — a
 * date can be typed — so the demo states the same rules as refusals.
 */
export function validateCounter(draft: CounterDraft, todayIso: string): DemoResult<CounterInput> {
  const title = draft.title.trim();
  if (!title) return fail('title', 'Ponle un título al contador.', 'title');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.start_date) || Number.isNaN(dayNumber(draft.start_date))) {
    return fail('date', 'Elige el día marcado.', 'start_date');
  }
  if (draft.start_date > todayIso) {
    return fail('future', 'El día marcado no puede ser posterior a hoy: Kairós cuenta los días que ya pasaron.', 'start_date');
  }
  let target: number | null = null;
  if (draft.target_day.trim()) {
    target = Number(draft.target_day);
    if (!Number.isInteger(target) || target < 1) {
      return fail('target', 'La meta es un número entero de días, de 1 en adelante.', 'target_day');
    }
  }
  if (draft.alarm_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.alarm_time)) {
    return fail('alarm', 'La alarma necesita una hora válida.', 'alarm_time');
  }
  return ok({
    title,
    category: draft.category,
    note: draft.note.trim(),
    start_date: draft.start_date,
    target_day: target,
    alarm_time: draft.alarm_time || null,
  });
}

/** "+10 días" needs a counter to move. */
export function decideSimulate(state: State): DemoResult<string> {
  const target = featured(state);
  return target ? ok(target.id) : fail('empty', 'No hay ningún contador que simular.');
}

// ── Reducer ────────────────────────────────────────────────────────────────

function patch(state: State, id: string, fn: (c: RawCounter) => RawCounter): State {
  return { ...state, counters: state.counters.map((c) => (c.id === id ? fn(c) : c)) };
}

function toast(state: State, t: Omit<Toast, 'id'>, os?: Omit<OsNotice, 'id'>): State {
  const next = { ...state, toasts: [...state.toasts, { ...t, id: state.seq }].slice(-4), seq: state.seq + 1 };
  if (!os) return next;
  return { ...next, os: [...next.os, { ...os, id: next.seq }].slice(-2), seq: next.seq + 1 };
}

/**
 * The product's milestone watcher: announce each milestone reached and not
 * yet announced, and go off for any alarm whose minute it is and has not gone
 * off today. Run after every tick and every change, as the product runs it
 * whenever the counters or the minute change.
 */
export function watch(state: State): State {
  const day = today(state);
  const minute = minuteOf(state.clock);
  const shown = featured(state)?.id;
  let next: State = { ...state, lastCheck: state.clock };

  for (const raw of state.counters) {
    const c = computed(raw, day);
    if (c.pending_milestone > 0) {
      const m = c.pending_milestone;
      next = toast(
        next,
        { tone: 'success', title: `¡Hito de ${m} días alcanzado!`, description: c.title, chime: true },
        { title: `¡${m} días cumplidos!`, body: `${c.title} — llevas ${m} días desde el día marcado.` },
      );
      next = patch(next, c.id, (r) => ({
        ...r,
        last_notified_milestone: Math.max(r.last_notified_milestone, m),
      }));
      // The projector celebrates the counter it is showing.
      if (state.projector && c.id === shown) next = { ...next, celebration: m };
    }

    const firedToday = next.alarms.some((e) => e.counter_id === c.id && e.fired_date === day);
    if (c.alarm_time === minute && !firedToday) {
      const event: AlarmEvent = {
        id: `a-${c.id}-${day}`,
        counter_id: c.id,
        title: c.title,
        fired_date: day,
        fired_time: minute,
        answered: false,
      };
      next = { ...next, alarms: [event, ...next.alarms].slice(0, MAX_ALARMS) };
      next = toast(
        next,
        {
          tone: 'info',
          title: `Es la hora: ${c.title}`,
          description: `Tu alarma diaria de las ${c.alarm_time}.`,
          alarmEventId: event.id,
          chime: true,
        },
        { title: `Es la hora: ${c.title}`, body: `Alarma diaria de las ${c.alarm_time} — te toca tu actividad de hoy.` },
      );
    }
  }
  return next;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'tick': {
      const next = { ...state, clock: state.clock + 1 };
      const newDay = todayOf(next.clock) !== today(state);
      const newMinute = next.clock % 60 === 0;
      // The product re-reads its counters every 30 seconds and re-checks on
      // the minute; between those, a tick only moves the clock.
      if (newDay || newMinute) return watch(next);
      if (next.clock % 30 === 0) return { ...next, lastCheck: next.clock };
      return next;
    }

    case 'select':
      return { ...state, featuredId: action.id };

    case 'save': {
      const { input } = action;
      if (action.id) {
        const updated = patch(state, action.id, (c) => ({ ...c, ...input }));
        return watch(
          toast(updated, { tone: 'success', title: 'Contador actualizado', description: 'El guardián vigilará cada decena.', chime: false }),
        );
      }
      const counter: RawCounter = {
        id: `c-${state.seq}`,
        ...input,
        last_notified_milestone: 0,
        completed_dates: [],
        missed_dates: [],
      };
      const added = { ...state, counters: [...state.counters, counter], seq: state.seq + 1 };
      return watch(
        toast(added, { tone: 'success', title: 'Contador creado', description: 'El guardián vigilará cada decena.', chime: false }),
      );
    }

    case 'remove': {
      const next = { ...state, counters: state.counters.filter((c) => c.id !== action.id) };
      return toast(next, { tone: 'success', title: 'Contador eliminado', chime: false });
    }

    case 'restart': {
      const day = today(state);
      const next = patch(state, action.id, (c) => ({
        ...c,
        start_date: day,
        last_notified_milestone: 0,
        completed_dates: [],
        missed_dates: [],
      }));
      return toast(next, { tone: 'success', title: 'Contador reiniciado a día 0', chime: false });
    }

    case 'duplicate': {
      const source = state.counters.find((c) => c.id === action.id);
      if (!source) return state;
      const copy: RawCounter = {
        ...source,
        id: `c-${state.seq}`,
        title: `${source.title} (copia)`,
        last_notified_milestone: 0,
        completed_dates: [],
        missed_dates: [],
      };
      const next = { ...state, counters: [...state.counters, copy], seq: state.seq + 1 };
      return watch(toast(next, { tone: 'success', title: 'Contador duplicado', chime: false }));
    }

    case 'setDay':
      return patch(state, action.id, (c) => {
        const completed = c.completed_dates.filter((d) => d !== action.day);
        const missed = c.missed_dates.filter((d) => d !== action.day);
        if (action.status === 'done') completed.push(action.day);
        if (action.status === 'missed') missed.push(action.day);
        return { ...c, completed_dates: completed.sort(), missed_dates: missed.sort() };
      });

    case 'simulateStart':
      return { ...state, simulating: true };

    case 'simulateDone': {
      const moved = patch({ ...state, simulating: false }, action.id, (c) => ({
        ...c,
        start_date: addDays(c.start_date, -10),
      }));
      return watch(toast(moved, { tone: 'info', title: 'Simulación: el contador retrocedió 10 días', chime: false }));
    }

    case 'answerAlarm': {
      if (!state.alarms.some((e) => e.id === action.eventId && !e.answered)) return state;
      const next = {
        ...state,
        alarms: state.alarms.map((e) => (e.id === action.eventId ? { ...e, answered: true } : e)),
        toasts: state.toasts.filter((t) => t.alarmEventId !== action.eventId),
      };
      return toast(next, { tone: 'success', title: 'Alarma marcada como hecha', chime: false });
    }

    case 'sendTest':
      return toast(
        state,
        { tone: 'success', title: 'Notificación de prueba enviada', chime: true },
        { title: 'Kairós · Guardián activo', body: 'Las alertas decádicas funcionan. Ningún día pasará por alto.' },
      );

    case 'toggleChime':
      return { ...state, chimeOn: !state.chimeOn };

    case 'toggleTheme':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };

    case 'projector':
      return { ...state, projector: action.open, celebration: null };

    case 'celebrated':
      return { ...state, celebration: null };

    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case 'dismissOs':
      return { ...state, os: state.os.filter((n) => n.id !== action.id) };
  }
}
