'use client';

import type { Dispatch, ReactNode } from 'react';
import {
  AlarmClock,
  BellRing,
  Check,
  CheckCircle2,
  Copy,
  Maximize2,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  alarmWeek,
  categoryOf,
  clockLabel,
  elapsed,
  fmtDate,
  milestoneLog,
  pad,
  today,
  type Action,
  type Counter,
  type MilestoneEvent,
  type State,
} from '@/lib/demo/apps/kairos/state';
import DailyChecks from './DailyChecks';
import { CARD, FOCUS, HEADING, INSET, MONO, OVERLINE, PRIMARY, catInk } from './tokens';

/**
 * The dashboard's five panels, from frontend/src/components in the Kairós
 * repository: FeaturedCounter, CounterDeck (with StreakStrip), MilestoneLog,
 * GuardianPanel and AlarmHistory. Labels, layout and arithmetic are the
 * product's; each panel takes the demo's state instead of a query.
 */

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
}

function CategoryPill({ category, small = false }: { category: string; small?: boolean }) {
  const cat = categoryOf(category);
  return (
    <span
      className={`${MONO} shrink-0 rounded-full border ${small ? 'px-1.5 py-px text-[9px]' : 'px-3 py-1 text-xs'}`}
      style={{ backgroundColor: `${cat.bar}1A`, borderColor: `${cat.bar}4D`, color: catInk(category) }}
    >
      {cat.label}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  hover = 'hover:border-[color-mix(in_oklab,var(--k-amber)_40%,transparent)] hover:text-[var(--k-amber-soft)]',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  hover?: string;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg border border-[var(--k-line)] p-1.5 text-[var(--k-ink-4)] transition-colors duration-150 ${hover} ${FOCUS}`}
    >
      {children}
    </button>
  );
}

// ── FeaturedCounter ────────────────────────────────────────────────────────

const R = 54;
const CIRC = 2 * Math.PI * R;

export function FeaturedCounter({
  state,
  dispatch,
  counter,
  onNew,
}: Props & { counter?: Counter; onNew: () => void }) {
  if (!counter) {
    return (
      <div className='flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--k-line-strong)] p-10 text-center [background:var(--k-card)] @3xl:col-span-7'>
        <p className='text-[var(--k-ink-4)]'>Aún no hay contadores. Marca tu primer día.</p>
        <button
          type='button'
          onClick={onNew}
          className={`flex items-center gap-2 rounded-full px-5 py-2 transition-transform duration-200 hover:scale-105 ${PRIMARY} ${FOCUS}`}
        >
          <Plus size={16} aria-hidden='true' /> Crear contador
        </button>
      </div>
    );
  }

  const cat = categoryOf(counter.category);
  const hasTarget = !!counter.target_day && counter.target_day > 0;
  const ring = hasTarget ? (counter.target_progress ?? 0) : counter.cycle_progress;
  const pulsing = hasTarget ? ring >= 0.9 : counter.cycle_progress >= 0.8;
  const t = elapsed(counter.start_date, state.clock);

  return (
    <div className={`relative overflow-hidden p-4 @md:p-8 ${CARD} @3xl:col-span-7`}>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-amber-500/10 blur-3xl'
      />
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className={`${OVERLINE} text-[var(--k-amber)]`}>Contador destacado</p>
          <h2 className={`${HEADING} mt-2 break-words text-2xl font-bold tracking-tight text-[var(--k-ink)]`}>
            {counter.title}
          </h2>
        </div>
        <div className='relative flex items-center gap-2'>
          <CategoryPill category={counter.category} />
          <IconButton label='Modo proyector' onClick={() => dispatch({ type: 'projector', open: true })}>
            <Maximize2 size={16} aria-hidden='true' />
          </IconButton>
        </div>
      </div>

      <div className='relative mt-4 flex items-center justify-between gap-4 @md:mt-8 @md:justify-start @md:gap-10'>
        <div>
          <div className='flex items-end gap-2 @md:gap-3'>
            <span
              key={counter.days_elapsed}
              className={`${HEADING} kr-rise text-6xl font-black leading-none tabular-nums tracking-tighter text-[var(--k-ink)] @md:text-8xl`}
            >
              {counter.days_elapsed}
            </span>
            <span className={`${MONO} pb-1 text-xs uppercase tracking-[0.2em] text-[var(--k-ink-5)] @md:pb-2 @md:text-sm`}>
              días
            </span>
          </div>
          <p className={`${MONO} mt-2 text-xs tabular-nums text-[var(--k-ink-4)] @md:mt-3 @md:text-sm`}>
            {t.d}d · {pad(t.h)}h · {pad(t.m)}m · {pad(t.s)}s
          </p>
        </div>

        <div className='relative'>
          <svg
            viewBox='0 0 140 140'
            className={`size-24 @md:size-[140px] ${pulsing ? 'kr-pulse' : ''}`}
            role='img'
            aria-label={`${Math.round(ring * 100)} % ${hasTarget ? `de la meta de ${counter.target_day} días` : `hacia el día ${counter.next_milestone}`}`}
          >
            <circle cx='70' cy='70' r={R} fill='none' stroke='var(--k-track)' strokeWidth='10' />
            <circle
              cx='70'
              cy='70'
              r={R}
              fill='none'
              stroke={cat.bar}
              strokeWidth='10'
              strokeLinecap='round'
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - ring)}
              transform='rotate(-90 70 70)'
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div aria-hidden='true' className='absolute inset-0 flex flex-col items-center justify-center'>
            <span className={`${HEADING} text-lg font-black tabular-nums text-[var(--k-ink)] @md:text-2xl`}>
              {Math.round(ring * 100)}%
            </span>
            <span className={`${MONO} text-[9px] uppercase tracking-wider text-[var(--k-ink-5)] @md:text-[10px] @md:tracking-widest`}>
              {hasTarget ? `meta ${counter.target_day}` : `hacia ${counter.next_milestone}`}
            </span>
          </div>
        </div>
      </div>

      <div className='relative mt-4 @md:mt-6'>
        <p className={`${MONO} text-xs uppercase tracking-[0.2em] text-[var(--k-ink-5)]`}>Tarea diaria · últimos 14 días</p>
        <DailyChecks counter={counter} today={today(state)} days={14} size='lg' dispatch={dispatch} />
      </div>

      <div className='relative mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--k-line)] pt-4 @md:mt-8 @md:pt-5'>
        <span className={`${MONO} text-xs uppercase tracking-[0.2em] text-[var(--k-ink-5)]`}>
          Próximo hito: día {counter.next_milestone} (faltan {counter.days_to_next})
          {hasTarget &&
            ` · Meta: día ${counter.target_day} (faltan ${Math.max(0, (counter.target_day ?? 0) - counter.days_elapsed)})`}
        </span>
        <div className='ml-auto flex flex-wrap gap-2'>
          {counter.milestones_reached.slice(-5).map((ms) => (
            <span
              key={ms}
              className={`${MONO} rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-[var(--k-amber-soft)]`}
            >
              Día {ms}
            </span>
          ))}
          {counter.milestones_reached.length === 0 && (
            <span className={`${MONO} text-xs text-[var(--k-ink-6)]`}>Sin hitos todavía — el primero llega al día 10</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CounterDeck ────────────────────────────────────────────────────────────

const MAX_WEEKS = 12;

function StreakStrip({ daysElapsed, color, milestones }: { daysElapsed: number; color: string; milestones: number[] }) {
  const totalWeeks = Math.max(1, Math.ceil((daysElapsed + 1) / 7));
  const hidden = Math.max(0, totalWeeks - MAX_WEEKS);
  const weeks = Array.from({ length: Math.min(totalWeeks, MAX_WEEKS) }, (_, i) => i + hidden);
  const milestoneWeeks = new Set(milestones.map((m) => Math.floor((m - 1) / 7)));

  return (
    <div className='mt-2.5 flex items-center gap-1' aria-hidden='true'>
      {hidden > 0 && <span className={`${MONO} mr-0.5 text-[10px] text-[var(--k-ink-6)]`}>+{hidden}</span>}
      {weeks.map((w) => {
        const daysIn = Math.min(7, Math.max(0, daysElapsed - w * 7));
        const frac = daysIn / 7;
        return (
          <div
            key={w}
            title={`Semana ${w + 1} · ${daysIn}/7 días`}
            className='relative size-3 shrink-0 overflow-hidden rounded-[3px] bg-[var(--k-cell)]'
            style={milestoneWeeks.has(w) ? { boxShadow: '0 0 0 1px #F59E0B' } : undefined}
          >
            <div
              className='absolute bottom-0 left-0 w-full'
              style={{ height: `${frac * 100}%`, backgroundColor: color, opacity: frac >= 1 ? 1 : 0.55 }}
            />
          </div>
        );
      })}
      <span className={`${MONO} ml-1 text-[10px] uppercase tracking-widest text-[var(--k-ink-6)]`}>semanas</span>
    </div>
  );
}

export function CounterDeck({
  state,
  dispatch,
  list,
  featuredId,
  onEdit,
  onRestart,
}: Props & {
  list: Counter[];
  featuredId?: string;
  onEdit: (c: Counter) => void;
  onRestart: (c: Counter) => void;
}) {
  const day = today(state);
  return (
    <div className={`p-4 @md:p-6 ${CARD} @3xl:col-span-5`}>
      <p className={`${OVERLINE} text-[var(--k-amber)]`}>Todos los contadores</p>
      <ul className='mt-3 flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1 pt-1'>
        {list.map((c) => {
          const cat = categoryOf(c.category);
          const active = c.id === featuredId;
          return (
            <li
              key={c.id}
              className={`group relative cursor-pointer rounded-xl border px-3 py-2.5 transition-transform duration-200 hover:scale-[1.01] ${
                active
                  ? 'border-amber-500/40 [background:var(--k-active)]'
                  : 'border-[var(--k-line)] [background:var(--k-inset)] hover:border-[var(--k-line-strong)]'
              }`}
            >
              <div className='flex items-center gap-3'>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    {/* The whole card selects, as in the product: this button's
                        hit area is stretched over it, and the controls inside
                        the card sit above it. */}
                    <button
                      type='button'
                      aria-pressed={active}
                      onClick={() => dispatch({ type: 'select', id: c.id })}
                      className={`${HEADING} truncate text-left text-sm font-bold text-[var(--k-ink)] after:absolute after:inset-0 after:rounded-xl after:content-[''] ${FOCUS}`}
                    >
                      {c.title}
                    </button>
                    <CategoryPill category={c.category} small />
                  </div>
                  <p className={`${MONO} truncate text-[11px] text-[var(--k-ink-5)]`}>
                    desde {fmtDate(c.start_date)} · hito {c.current_milestone} → {c.next_milestone}
                    {c.target_day ? ` · meta día ${c.target_day}` : ''}
                    {c.alarm_time ? ` · alarma ${c.alarm_time}` : ''}
                  </p>
                </div>
                <span
                  className={`${HEADING} text-2xl font-black tabular-nums tracking-tighter`}
                  style={{ color: catInk(c.category) }}
                >
                  {c.days_elapsed}
                </span>
              </div>
              <div className='mt-2 h-1 overflow-hidden rounded-full bg-[var(--k-track)]'>
                <div
                  className='h-full rounded-full'
                  style={{ width: `${c.cycle_progress * 100}%`, backgroundColor: cat.bar, transition: 'width 0.6s ease' }}
                />
              </div>
              <StreakStrip daysElapsed={c.days_elapsed} color={cat.bar} milestones={c.milestones_reached} />
              <div className='relative z-[1] flex items-end justify-between gap-2'>
                <DailyChecks counter={c} today={day} days={7} dispatch={dispatch} />
                {/* Touch: always shown. Mouse: on hover, as in the product. */}
                <div className='flex shrink-0 gap-0.5 transition-opacity duration-200 focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100'>
                  {(
                    [
                      ['Reiniciar', RotateCcw, () => onRestart(c)],
                      ['Duplicar', Copy, () => dispatch({ type: 'duplicate', id: c.id })],
                      ['Editar', Pencil, () => onEdit(c)],
                      ['Eliminar', Trash2, () => dispatch({ type: 'remove', id: c.id })],
                    ] as const
                  ).map(([label, Icon, run]) => (
                    <button
                      key={label}
                      type='button'
                      aria-label={`${label} «${c.title}»`}
                      title={label}
                      onClick={(e) => {
                        e.stopPropagation();
                        run();
                      }}
                      className={`rounded-md p-1.5 text-[var(--k-ink-4)] transition-colors duration-150 ${FOCUS} ${
                        label === 'Eliminar'
                          ? 'hover:bg-red-500/20 hover:text-[var(--k-red)]'
                          : 'hover:bg-[var(--k-track)] hover:text-[var(--k-ink)]'
                      }`}
                    >
                      <Icon size={14} aria-hidden='true' />
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className={`${MONO} py-8 text-center text-sm text-[var(--k-ink-6)]`}>Sin contadores todavía</li>
        )}
      </ul>
    </div>
  );
}

// ── MilestoneLog ───────────────────────────────────────────────────────────

export function MilestoneLog({ state, onShare }: { state: State; onShare: (e: MilestoneEvent) => void }) {
  const events = milestoneLog(state);
  return (
    <div className={`p-4 @md:p-6 ${CARD} @3xl:col-span-8`}>
      <div className='flex items-center gap-2'>
        <Trophy size={16} className='text-[var(--k-amber)]' aria-hidden='true' />
        <p className={`${OVERLINE} text-[var(--k-amber)]`}>Registro de hitos</p>
      </div>
      <ul className='mt-3 grid max-h-[22rem] gap-2 overflow-y-auto pr-1 @xl:grid-cols-2'>
        {events.map((e) => {
          const cat = categoryOf(e.category);
          return (
            <li key={e.key} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${INSET}`}>
              <span
                className={`${HEADING} flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black`}
                style={{ backgroundColor: `${cat.bar}1A`, color: catInk(e.category), border: `1px solid ${cat.bar}4D` }}
              >
                {e.milestone}
              </span>
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold text-[var(--k-ink-2)]'>{e.title}</p>
                <p className={`${MONO} text-[11px] text-[var(--k-ink-5)]`}>
                  Día {e.milestone} · {fmtDate(e.date)}
                </p>
              </div>
              <IconButton label={`Compartir hito de ${e.milestone} días`} onClick={() => onShare(e)}>
                <Share2 size={16} aria-hidden='true' />
              </IconButton>
            </li>
          );
        })}
        {events.length === 0 && (
          <li className={`${MONO} col-span-full py-8 text-center text-sm text-[var(--k-ink-6)]`}>
            Cuando un contador cruce una decena, aparecerá aquí.
          </li>
        )}
      </ul>
    </div>
  );
}

// ── GuardianPanel ──────────────────────────────────────────────────────────

const OUTLINE = `flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-55 ${FOCUS}`;

export function GuardianPanel({
  state,
  dispatch,
  canSimulate,
  onSimulate,
}: Props & { canSimulate: boolean; onSimulate: () => void }) {
  return (
    <div className={`p-4 @md:p-6 ${CARD} @3xl:col-span-4`}>
      <div className='flex items-center gap-2'>
        <span className='relative flex size-2.5' aria-hidden='true'>
          <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60' />
          <span className='relative inline-flex size-2.5 rounded-full bg-emerald-400' />
        </span>
        <p className={`${OVERLINE} text-[var(--k-emerald-soft)]`}>Guardián activo</p>
      </div>
      <p className='mt-3 text-sm leading-relaxed text-[var(--k-ink-4)]'>
        Vigilancia en la app: verifica cada 30 segundos mientras Kairós está abierta. En la app instalada
        (iOS/Android) los hitos y alarmas también se avisan aunque esté cerrada, programados en el propio
        dispositivo.
      </p>
      <p className={`${MONO} mt-2 text-xs text-[var(--k-ink-6)]`}>Última verificación: {clockLabel(state.lastCheck)}</p>

      <div className='mt-5 flex flex-col gap-2.5'>
        <div
          className={`${MONO} flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-[var(--k-emerald-soft)]`}
        >
          <BellRing size={16} aria-hidden='true' /> Notificaciones activas
        </div>
        <button
          type='button'
          onClick={() => dispatch({ type: 'sendTest' })}
          className={`${OUTLINE} border-[var(--k-line)] text-[var(--k-ink)] hover:bg-[var(--k-track)]`}
        >
          <BellRing size={16} aria-hidden='true' /> Enviar notificación de prueba
        </button>
        <button
          type='button'
          aria-pressed={state.chimeOn}
          onClick={() => dispatch({ type: 'toggleChime' })}
          className={`${OUTLINE} border-[var(--k-line)] text-[var(--k-ink)] hover:bg-[var(--k-track)]`}
        >
          {state.chimeOn ? (
            <Volume2 size={16} className='text-[var(--k-amber)]' aria-hidden='true' />
          ) : (
            <VolumeX size={16} className='text-[var(--k-ink-5)]' aria-hidden='true' />
          )}
          Campana {state.chimeOn ? 'activada' : 'silenciada'}
        </button>
        <button
          type='button'
          disabled={!canSimulate || state.simulating}
          aria-busy={state.simulating}
          onClick={onSimulate}
          className={`${OUTLINE} border-cyan-500/30 text-[var(--k-cyan)] hover:bg-cyan-500/10`}
        >
          <Zap size={16} aria-hidden='true' /> {state.simulating ? 'Simulando…' : 'Simular cruce de hito (+10 días)'}
        </button>
      </div>
    </div>
  );
}

// ── AlarmHistory ───────────────────────────────────────────────────────────

export function AlarmHistory({ state, dispatch }: Props) {
  const week = alarmWeek(state);
  return (
    <div className={`p-4 @md:p-6 ${CARD} col-span-full`}>
      <div className='flex flex-wrap items-center gap-2'>
        <AlarmClock size={16} className='text-[var(--k-cyan)]' aria-hidden='true' />
        <p className={`${OVERLINE} text-[var(--k-cyan)]`}>Historial de alarmas</p>
        <span
          className={`${MONO} ml-auto rounded-full border border-[var(--k-line)] px-3 py-1 text-xs text-[var(--k-ink-4)]`}
        >
          Esta semana: {week.answered}/{week.total} respondidas
        </span>
      </div>
      <ul className='mt-4 grid gap-2.5 @xl:grid-cols-2 @4xl:grid-cols-3'>
        {state.alarms.slice(0, 9).map((e) => (
          <li key={e.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${INSET}`}>
            {e.answered ? (
              <CheckCircle2 size={16} className='shrink-0 text-[var(--k-emerald)]' aria-hidden='true' />
            ) : (
              <AlarmClock size={16} className='shrink-0 text-[var(--k-amber)]' aria-hidden='true' />
            )}
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-semibold text-[var(--k-ink-2)]'>{e.title}</p>
              <p className={`${MONO} text-xs text-[var(--k-ink-5)]`}>
                {fmtDate(e.fired_date)} · {e.answered ? 'respondida' : 'sin responder'}
              </p>
            </div>
            {!e.answered && (
              <button
                type='button'
                onClick={() => dispatch({ type: 'answerAlarm', eventId: e.id })}
                aria-label={`Marcar como hecha: ${e.title}, ${fmtDate(e.fired_date)}`}
                className={`${MONO} flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-[var(--k-emerald-soft)] transition-colors duration-150 hover:bg-emerald-500/20 ${FOCUS}`}
              >
                <Check size={12} aria-hidden='true' /> Hecho
              </button>
            )}
          </li>
        ))}
        {state.alarms.length === 0 && (
          <li className={`${MONO} col-span-full py-6 text-center text-sm text-[var(--k-ink-6)]`}>
            Cuando suene una alarma diaria, aparecerá aquí para que la marques como hecha.
          </li>
        )}
      </ul>
    </div>
  );
}
