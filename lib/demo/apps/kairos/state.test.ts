import { describe, expect, it } from 'vitest';
import { ANCHOR, CATEGORIES, COUNTERS } from './data';
import {
  addDays,
  alarmWeek,
  checkDays,
  clockLabel,
  computed,
  counters,
  createInitialState,
  decideSimulate,
  elapsed,
  featured,
  milestoneLog,
  phraseFor,
  reducer,
  statusOf,
  today,
  validateCounter,
  weekdayLetter,
  type Action,
  type CounterDraft,
  type State,
} from './state';

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state);
const start = (scenario = 'medianoche') => createInitialState(scenario);

/** Let the demo clock run for `seconds`. */
function wait(state: State, seconds: number): State {
  let next = state;
  for (let i = 0; i < seconds; i++) next = reducer(next, { type: 'tick' });
  return next;
}

const find = (state: State, id: string) => counters(state).find((c) => c.id === id)!;

const draft = (over: Partial<CounterDraft> = {}): CounterDraft => ({
  title: 'Meditar',
  category: 'meta',
  note: '',
  start_date: ANCHOR,
  target_day: '',
  alarm_time: '',
  ...over,
});

/** Save the form the way the view does: decide, then record. */
function save(state: State, d: CounterDraft, id: string | null = null): State {
  const result = validateCounter(d, today(state));
  if (!result.ok) throw new Error(result.failure.message);
  return reducer(state, { type: 'save', id, input: result.value });
}

describe('fixtures', () => {
  it('anchors on a Monday', () => {
    expect(weekdayLetter(ANCHOR)).toBe('L');
  });

  it('gives every counter a known category and a unique id', () => {
    expect(new Set(COUNTERS.map((c) => c.id)).size).toBe(COUNTERS.length);
    for (const c of COUNTERS) expect(CATEGORIES[c.category]).toBeTruthy();
  });

  it('opens each scenario where its story is', () => {
    const night = start('medianoche');
    expect(clockLabel(night.clock)).toBe('23:59:20');
    expect(featured(night)).toMatchObject({ id: 'c-fumar', days_elapsed: 29 });

    const morning = start('alarma');
    expect(clockLabel(morning.clock)).toBe('06:59:40');
    expect(featured(morning)).toMatchObject({ id: 'c-correr', days_elapsed: 48 });
  });

  it('announces nothing on opening', () => {
    for (const id of ['medianoche', 'alarma']) {
      const s = start(id);
      expect(s.toasts).toEqual([]);
      expect(counters(s).every((c) => c.pending_milestone === 0)).toBe(true);
    }
  });

  it('shows only the alarms that have already gone off', () => {
    const s = start('alarma');
    expect(s.alarms.every((e) => e.fired_date < today(s))).toBe(true);
    expect(s.alarms[0].fired_date >= s.alarms[s.alarms.length - 1].fired_date).toBe(true);
  });

  it('falls back to the first scenario for an unknown id', () => {
    expect(start('nope').scenarioId).toBe('medianoche');
  });
});

describe('the arithmetic', () => {
  it('counts whole days and milestones every ten', () => {
    const c = computed({ ...COUNTERS[0], start_date: '2026-09-01', last_notified_milestone: 0 }, '2026-09-24');
    expect(c).toMatchObject({
      days_elapsed: 23,
      current_milestone: 20,
      next_milestone: 30,
      days_to_next: 7,
      cycle_progress: 0.3,
      milestones_reached: [10, 20],
      pending_milestone: 20,
    });
  });

  it('measures the ring against the target when there is one', () => {
    const c = computed({ ...COUNTERS[1], start_date: '2026-09-01', target_day: 40 }, '2026-09-11');
    expect(c.target_progress).toBe(0.25);
    expect(computed({ ...COUNTERS[1], start_date: '2026-01-01', target_day: 40 }, '2026-09-11').target_progress).toBe(1);
  });

  it('never counts backwards from a future or broken date', () => {
    expect(computed({ ...COUNTERS[0], start_date: '2026-10-01' }, '2026-09-14').days_elapsed).toBe(0);
    expect(computed({ ...COUNTERS[0], start_date: 'nope' }, '2026-09-14').days_elapsed).toBe(0);
  });

  it('runs the ticker from the marked day’s midnight', () => {
    const s = start();
    expect(elapsed(find(s, 'c-fumar').start_date, s.clock)).toEqual({ d: 29, h: 23, m: 59, s: 20 });
  });

  it('rotates the share-card phrase by decade', () => {
    expect(phraseFor('salud', 10)).toBe('Tu cuerpo te lo agradece.');
    expect(phraseFor('salud', 30)).toBe('Fuerte hoy, más fuerte mañana.');
    expect(phraseFor('salud', 40)).toBe('Tu cuerpo te lo agradece.');
  });
});

describe('midnight', () => {
  it('crosses the milestone live and announces it once', () => {
    const before = start();
    const after = wait(before, 40);

    expect(today(after)).toBe(addDays(ANCHOR, 1));
    expect(find(after, 'c-fumar')).toMatchObject({ days_elapsed: 30, milestones_reached: [10, 20, 30] });
    expect(after.toasts.map((t) => t.title)).toEqual(['¡Hito de 30 días alcanzado!']);
    expect(after.os.map((n) => n.title)).toEqual(['¡30 días cumplidos!']);

    // A minute later nothing is announced again.
    expect(wait(after, 60).toasts).toHaveLength(1);
  });

  it('celebrates in the projector, only for the counter it shows', () => {
    expect(wait(start(), 40).celebration).toBeNull();

    const shown = wait(run(start(), { type: 'projector', open: true }), 40);
    expect(shown.celebration).toBe(30);
    expect(run(shown, { type: 'celebrated' }).celebration).toBeNull();

    const other = wait(run(start(), { type: 'select', id: 'c-correr' }, { type: 'projector', open: true }), 40);
    expect(other.celebration).toBeNull();
  });

  it('puts the new milestone at the head of the log', () => {
    const after = wait(start(), 40);
    expect(milestoneLog(after)[0]).toMatchObject({ title: 'Sin fumar', milestone: 30, date: addDays(ANCHOR, 1) });
    expect(milestoneLog(after)).toHaveLength(14);
  });

  it('opens a new pending day for the daily task', () => {
    const before = start();
    const fumar = before.counters.find((c) => c.id === 'c-fumar')!;
    expect(statusOf(fumar, today(before))).toBe('done');

    const after = wait(before, 40);
    expect(statusOf(after.counters.find((c) => c.id === 'c-fumar')!, today(after))).toBeNull();
  });
});

describe('the daily alarm', () => {
  it('goes off at its minute, once, and waits to be answered', () => {
    const s = wait(start('alarma'), 20);
    const [event] = s.alarms;
    expect(event).toMatchObject({ counter_id: 'c-correr', fired_date: today(s), answered: false });
    expect(s.toasts.at(-1)).toMatchObject({ title: 'Es la hora: Correr cada mañana', alarmEventId: event.id });
    expect(wait(s, 60).alarms.filter((e) => e.fired_date === today(s))).toHaveLength(1);
  });

  it('answers from the toast and counts in the week', () => {
    const fired = wait(start('alarma'), 20);
    expect(alarmWeek(fired)).toEqual({ answered: 1, total: 3 });

    const answered = run(fired, { type: 'answerAlarm', eventId: fired.alarms[0].id });
    expect(answered.alarms[0].answered).toBe(true);
    expect(answered.toasts.some((t) => t.alarmEventId)).toBe(false);
    expect(alarmWeek(answered)).toEqual({ answered: 2, total: 3 });
  });

  it('starts the week on Monday', () => {
    // The anchor is a Monday: only its own two alarms are this week's.
    expect(alarmWeek(start())).toEqual({ answered: 1, total: 2 });
  });

  it('goes off at once when a counter is set to the current minute', () => {
    const s = start('alarma');
    const tienda = s.counters.find((c) => c.id === 'c-tienda')!;
    const next = save(s, draft({ ...tienda, target_day: '', alarm_time: '06:59' }), tienda.id);
    expect(next.alarms[0]).toMatchObject({ counter_id: 'c-tienda', answered: false });
  });
});

describe('the counters', () => {
  it('creates a counter and announces the milestones it already has', () => {
    const s = save(start(), draft({ start_date: addDays(ANCHOR, -25) }));
    const created = counters(s).at(-1)!;
    expect(created).toMatchObject({ title: 'Meditar', days_elapsed: 25, last_notified_milestone: 20 });
    expect(s.toasts.map((t) => t.title)).toEqual(['Contador creado', '¡Hito de 20 días alcanzado!']);
  });

  it('refuses a counter without a title, from the future or with a bad target', () => {
    const day = today(start());
    expect(validateCounter(draft({ title: '  ' }), day)).toMatchObject({ ok: false, failure: { field: 'title' } });
    expect(validateCounter(draft({ start_date: addDays(day, 1) }), day)).toMatchObject({
      ok: false,
      failure: { code: 'future', field: 'start_date' },
    });
    expect(validateCounter(draft({ target_day: '0' }), day)).toMatchObject({ ok: false, failure: { field: 'target_day' } });
    expect(validateCounter(draft({ target_day: '12.5' }), day)).toMatchObject({ ok: false });
    expect(validateCounter(draft({ target_day: ' 100 ', title: ' Leer ' }), day)).toMatchObject({
      ok: true,
      value: { title: 'Leer', target_day: 100 },
    });
  });

  it('restarts to day 0 and forgets the history', () => {
    const s = run(start(), { type: 'restart', id: 'c-correr' });
    expect(find(s, 'c-correr')).toMatchObject({
      days_elapsed: 0,
      milestones_reached: [],
      completed_dates: [],
      missed_dates: [],
    });
  });

  it('duplicates without the history — and the watcher announces the copy', () => {
    const s = run(start(), { type: 'duplicate', id: 'c-redes' });
    const copy = counters(s).at(-1)!;
    expect(copy).toMatchObject({ title: 'Sin redes sociales (copia)', days_elapsed: 8, completed_dates: [] });
    expect(copy.id).not.toBe('c-redes');

    const older = run(start(), { type: 'duplicate', id: 'c-casa' });
    expect(older.toasts.at(-1)?.title).toBe('¡Hito de 210 días alcanzado!');
  });

  it('deletes, and the featured counter falls back to the first', () => {
    const s = run(start(), { type: 'remove', id: 'c-fumar' });
    expect(counters(s).map((c) => c.id)).not.toContain('c-fumar');
    expect(featured(s)?.id).toBe('c-correr');
    const empty = s.counters.reduce((acc, c) => reducer(acc, { type: 'remove', id: c.id }), s);
    expect(featured(empty)).toBeUndefined();
    expect(decideSimulate(empty).ok).toBe(false);
  });

  it('marks, changes and clears a day', () => {
    const s = start();
    const day = addDays(today(s), -6);
    const marked = run(s, { type: 'setDay', id: 'c-correr', day, status: 'done' });
    expect(statusOf(marked.counters[1], day)).toBe('done');
    const missed = run(marked, { type: 'setDay', id: 'c-correr', day, status: 'missed' });
    expect(statusOf(missed.counters[1], day)).toBe('missed');
    expect(missed.counters[1].completed_dates).not.toContain(day);
    expect(statusOf(run(missed, { type: 'setDay', id: 'c-correr', day, status: null }).counters[1], day)).toBeNull();
  });

  it('shows the checks only from the marked day on', () => {
    const s = start();
    expect(checkDays(s.counters[4], today(s), 14)).toHaveLength(9);
    expect(checkDays(s.counters[0], today(s), 7)).toHaveLength(7);
  });
});

describe('the guardian', () => {
  it('simulates ten days and the watcher announces the crossing', () => {
    const s = start();
    const id = decideSimulate(s);
    expect(id).toEqual({ ok: true, value: 'c-fumar' });
    const next = run(s, { type: 'simulateStart' }, { type: 'simulateDone', id: 'c-fumar' });
    expect(next.simulating).toBe(false);
    expect(find(next, 'c-fumar').days_elapsed).toBe(39);
    expect(next.toasts.map((t) => t.title)).toEqual([
      'Simulación: el contador retrocedió 10 días',
      '¡Hito de 30 días alcanzado!',
    ]);
  });

  it('sends a test notification to the tray', () => {
    const s = run(start(), { type: 'sendTest' });
    expect(s.os).toEqual([expect.objectContaining({ title: 'Kairós · Guardián activo' })]);
  });

  it('keeps toast and notice ids unique', () => {
    const s = run(start(), { type: 'sendTest' }, { type: 'sendTest' }, { type: 'duplicate', id: 'c-fumar' });
    const ids = [...s.toasts.map((t) => t.id), ...s.os.map((n) => n.id), ...s.counters.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('reset', () => {
  it('rebuilds exactly the starting position', () => {
    const played = run(
      wait(start(), 45),
      { type: 'restart', id: 'c-correr' },
      { type: 'toggleTheme' },
      { type: 'projector', open: true },
    );
    expect(played).not.toEqual(start());
    expect(createInitialState('medianoche')).toEqual(start());
  });
});
