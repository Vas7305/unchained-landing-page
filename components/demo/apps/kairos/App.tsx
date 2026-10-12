'use client';

import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { DM_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Bell, Check, CheckCircle2, Info, Moon, Plus, Sun, X } from 'lucide-react';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import { MARQUEE } from '@/lib/demo/apps/kairos/data';
import {
  clockLabel,
  counters as countersOf,
  createInitialState,
  decideSimulate,
  featured as featuredOf,
  reducer,
  today,
  type Action,
  type Counter,
  type MilestoneEvent,
  type OsNotice,
  type State,
  type Toast,
} from '@/lib/demo/apps/kairos/state';
import { AlarmHistory, CounterDeck, FeaturedCounter, GuardianPanel, MilestoneLog } from './Panels';
import { CounterForm, RestartDialog, ShareCard } from './Dialogs';
import Projector from './Projector';
import { chime } from './sound';
import { FOCUS, HEADING, MONO, PRIMARY, themeVars } from './tokens';

/**
 * Kairós — the whole dashboard, as the product's single page lays it out.
 *
 * Rebuilt from the product's own frontend (frontend/src/pages/Home.tsx and the
 * components it composes, in the Kairós repository): the header with its live
 * clock, the hero and its marquee, the featured counter with its ring and
 * ticker, the counter deck, the milestone log, the guardian, the alarm
 * history, the counter form and the projector — in its dark obsidian look,
 * with the emerald light theme behind the sun button.
 *
 * Kairós is local-first: it has no server, and everything lives in the
 * device's storage. The demo keeps it in memory instead, and runs on its own
 * clock (see lib/demo/apps/kairos/data.ts) so that what happens at midnight
 * happens for every visitor. What a website cannot do — install itself, ask
 * for notification permission, put a notice in the operating system's tray —
 * is shown inside the window rather than done.
 *
 * The layout responds to the frame, not the window: container queries.
 */

const heading = Space_Grotesk({ variable: '--font-kr-heading', subsets: ['latin', 'latin-ext'] });
const sans = DM_Sans({ variable: '--font-kr-sans', subsets: ['latin', 'latin-ext'] });
const mono = JetBrains_Mono({ variable: '--font-kr-mono', subsets: ['latin', 'latin-ext'] });

/** The product's keyframes (index.css), named for this demo so nothing collides. */
const KEYFRAMES = `
@keyframes kr-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes kr-pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.3)) }
  50% { filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.8)) }
}
@keyframes kr-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes kr-zoom { from { transform: scale(0.9); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes kr-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes kr-fall {
  from { transform: translate(0, -2rem) rotate(0deg); opacity: 1 }
  to { transform: translate(var(--kr-drift), 46rem) rotate(540deg); opacity: 0.2 }
}
.kr-marquee { animation: kr-marquee 42s linear infinite }
.kr-pulse { animation: kr-pulse-glow 2s ease-in-out infinite }
.kr-rise { animation: kr-rise 0.4s ease both }
.kr-zoom { animation: kr-zoom 0.7s cubic-bezier(0.16, 1, 0.3, 1) both }
.kr-fade { animation: kr-fade 0.4s ease both }
.kr-pop { animation: kr-zoom 0.35s ease both }
.kr-confetti { animation-name: kr-fall; animation-timing-function: cubic-bezier(0.2, 0.6, 0.4, 1); animation-fill-mode: both }
@media (prefers-reduced-motion: reduce) {
  .kr-marquee, .kr-pulse, .kr-rise, .kr-zoom, .kr-fade, .kr-pop { animation: none }
  .kr-confetti { display: none }
}
`;

export default function KairosDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);
  const [form, setForm] = useState<{ editing: Counter | null } | null>(null);
  const [restarting, setRestarting] = useState<Counter | null>(null);
  const [sharing, setSharing] = useState<MilestoneEvent | null>(null);

  // The demo's clock. One tick a second, as the product's own header clock.
  useEffect(() => {
    const t = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(t);
  }, []);

  // The bell rings with each new announcement, when it is on.
  const rung = useRef(0);
  useEffect(() => {
    const fresh = state.toasts.filter((t) => t.id > rung.current);
    if (fresh.length === 0) return;
    rung.current = Math.max(...fresh.map((t) => t.id));
    if (state.chimeOn && fresh.some((t) => t.chime)) chime();
  }, [state.toasts, state.chimeOn]);

  // Reported once per milestone the visitor sees crossed, never its content.
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || !state.toasts.some((t) => t.title.startsWith('¡Hito'))) return;
    tracked.current = true;
    track('demo_completed', { project: 'kairos', workflow: 'milestone' });
  }, [state.toasts]);

  async function runSimulation() {
    dispatch({ type: 'simulateStart' });
    const result = await simulate(() => decideSimulate(state), DEMO_LATENCY.normal);
    if (result.ok) dispatch({ type: 'simulateDone', id: result.value });
  }

  const list = countersOf(state);
  const shown = featuredOf(state);

  return (
    <div
      className={`${heading.variable} ${sans.variable} ${mono.variable} @container relative flex h-full flex-col text-[var(--k-ink)] [background:var(--k-page)]`}
      style={{ ...themeVars(state.theme), colorScheme: state.theme, fontFamily: 'var(--font-kr-sans), system-ui, sans-serif' }}
    >
      <style>{KEYFRAMES}</style>
      <div className='min-h-0 flex-1 overflow-y-auto' inert={state.projector}>
        <Header state={state} dispatch={dispatch} count={list.length} onNew={() => setForm({ editing: null })} />
        <Hero />
        <main className='mx-auto max-w-7xl px-4 py-8 @md:px-6 @md:py-12'>
          <div className='grid grid-cols-1 gap-6 @3xl:grid-cols-12 @3xl:gap-8'>
            <FeaturedCounter state={state} dispatch={dispatch} counter={shown} onNew={() => setForm({ editing: null })} />
            <CounterDeck
              state={state}
              dispatch={dispatch}
              list={list}
              featuredId={shown?.id}
              onEdit={(c) => setForm({ editing: c })}
              onRestart={setRestarting}
            />
            <MilestoneLog state={state} onShare={setSharing} />
            <GuardianPanel state={state} dispatch={dispatch} canSimulate={!!shown} onSimulate={runSimulation} />
            <AlarmHistory state={state} dispatch={dispatch} />
          </div>
        </main>
        <footer className='border-t border-[var(--k-line)] px-4 py-8'>
          <p className={`${MONO} text-center text-xs uppercase tracking-[0.3em] text-[var(--k-ink-6)]`}>
            Kairós — el tiempo no se detiene, tú tampoco
          </p>
        </footer>
      </div>

      <OsTray notices={state.os} dispatch={dispatch} />
      <Toaster toasts={state.toasts} dispatch={dispatch} />

      {form && (
        <CounterForm
          editing={form.editing}
          today={today(state)}
          onClose={() => setForm(null)}
          onSave={(input) => {
            dispatch({ type: 'save', id: form.editing?.id ?? null, input });
            setForm(null);
          }}
        />
      )}
      <RestartDialog
        counter={restarting}
        onClose={() => setRestarting(null)}
        onConfirm={() => {
          if (restarting) dispatch({ type: 'restart', id: restarting.id });
          setRestarting(null);
        }}
      />
      <ShareCard event={sharing} onClose={() => setSharing(null)} />
      {state.projector && shown && (
        <Projector
          counter={shown}
          clock={state.clock}
          chimeOn={state.chimeOn}
          celebration={state.celebration}
          onCelebrated={() => dispatch({ type: 'celebrated' })}
          onClose={() => dispatch({ type: 'projector', open: false })}
        />
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 32 32' fill='none' aria-hidden='true'>
      <circle cx='16' cy='16' r='14' stroke='#F59E0B' strokeWidth='2' strokeDasharray='4 3' />
      <circle cx='16' cy='16' r='7' fill='#F59E0B' />
      <path d='M16 2V7M16 25V30M2 16H7M25 16H30' stroke='#F59E0B' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
  );
}

function Header({
  state,
  dispatch,
  count,
  onNew,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  count: number;
  onNew: () => void;
}) {
  const ghost = `flex min-h-8 items-center gap-2 rounded-lg border border-[var(--k-line)] px-2.5 py-1.5 text-sm font-medium text-[var(--k-ink)] transition-colors duration-150 hover:bg-[var(--k-track)] ${FOCUS}`;
  return (
    <header className='sticky top-0 z-10 border-b border-[var(--k-line)] backdrop-blur-xl [background:var(--k-header)]'>
      <div className='mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 @md:gap-4 @md:px-6'>
        <div className='flex shrink-0 items-center gap-2 @md:gap-3'>
          <Logo />
          <div className='leading-none'>
            <p className={`${HEADING} text-lg font-bold tracking-tight text-[var(--k-ink)]`}>KAIRÓS</p>
            <p className={`${MONO} hidden text-[10px] uppercase tracking-[0.25em] text-[var(--k-amber)] @md:block`}>
              Cronómetro de hitos
            </p>
          </div>
        </div>
        <div className='ml-auto hidden items-center gap-4 @4xl:flex'>
          <span className={`${MONO} text-sm tabular-nums text-[var(--k-ink-4)]`}>
            TIEMPO ACTIVO {clockLabel(state.clock)}
          </span>
          <span
            className={`${MONO} rounded-full border border-[var(--k-line)] px-3 py-1 text-xs text-[var(--k-ink-3)] [background:var(--k-card)]`}
          >
            {count} contadores activos
          </span>
          <button type='button' onClick={() => dispatch({ type: 'sendTest' })} className={ghost}>
            <Bell size={16} className='text-[var(--k-amber)]' aria-hidden='true' /> Alertas ON
          </button>
        </div>
        <button
          type='button'
          onClick={onNew}
          aria-label='Nuevo contador'
          className={`ml-auto flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-sm @4xl:ml-0 ${PRIMARY} ${FOCUS}`}
        >
          <Plus size={16} aria-hidden='true' /> <span className='hidden @md:inline'>Nuevo contador</span>
        </button>
        <button
          type='button'
          onClick={() => dispatch({ type: 'toggleTheme' })}
          aria-label={state.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          className={`${ghost} px-2`}
        >
          {state.theme === 'dark' ? <Sun size={16} aria-hidden='true' /> : <Moon size={16} aria-hidden='true' />}
        </button>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className='relative overflow-hidden [background:var(--k-hero)]'>
      <div className='mx-auto max-w-7xl px-4 pb-10 pt-12 @md:px-6 @3xl:pb-14 @3xl:pt-20'>
        <p className={`${MONO} kr-fade text-xs uppercase tracking-[0.25em] text-[var(--k-amber)]`}>
          Kairós · Guardián de hitos decádicos
        </p>
        <h1 className={`${HEADING} mt-6 text-4xl font-black leading-none tracking-tighter @xl:text-5xl @4xl:text-7xl`}>
          <span className='kr-rise block pb-1 text-[var(--k-ink)]'>CADA 10 DÍAS</span>
          <span
            className='kr-rise block pb-1 [-webkit-background-clip:text] [background-clip:text] [background-image:var(--k-accent-fill)] [color:var(--k-accent-text)]'
            style={{ animationDelay: '0.18s' }}
          >
            ES UNA CONQUISTA.
          </span>
        </h1>
        <p className='kr-fade mt-6 max-w-xl text-base leading-relaxed text-[var(--k-ink-4)] @3xl:text-lg'>
          Monitorea los días transcurridos desde tus momentos clave. Alerta persistente en segundo plano cada
          decena cumplida — ningún día pasa por alto.
        </p>
      </div>
      <div className='border-y border-[var(--k-line)] py-3' aria-hidden='true'>
        <div className='kr-marquee flex w-max gap-10'>
          {[...MARQUEE, ...MARQUEE].map((t, i) => (
            <span
              key={i}
              className={`${MONO} flex items-center gap-10 text-xs uppercase tracking-[0.3em] text-[var(--k-ink-5)]`}
            >
              {t} <span className='text-[var(--k-amber-mark)]'>◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Toasts and the device tray ─────────────────────────────────────────────

/** The product's toasts (sonner), bottom right, each leaving on its own. */
function ToastItem({ toast, dispatch }: { toast: Toast; dispatch: Dispatch<Action> }) {
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'dismissToast', id: toast.id }), toast.alarmEventId ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [toast.id, toast.alarmEventId, dispatch]);

  const Icon = toast.tone === 'success' ? CheckCircle2 : Info;
  return (
    <li className='kr-pop pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-[var(--k-line)] p-3.5 shadow-2xl [background:var(--k-active)]'>
      <Icon
        size={16}
        aria-hidden='true'
        className={`mt-0.5 shrink-0 ${toast.tone === 'success' ? 'text-[var(--k-emerald)]' : 'text-[var(--k-cyan)]'}`}
      />
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-[var(--k-ink)]'>{toast.title}</p>
        {toast.description && <p className='mt-0.5 text-xs text-[var(--k-ink-4)]'>{toast.description}</p>}
      </div>
      {toast.alarmEventId && (
        <button
          type='button'
          onClick={() => dispatch({ type: 'answerAlarm', eventId: toast.alarmEventId! })}
          className={`flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs ${PRIMARY} ${FOCUS}`}
        >
          <Check size={12} aria-hidden='true' /> Hecho
        </button>
      )}
    </li>
  );
}

function Toaster({ toasts, dispatch }: { toasts: Toast[]; dispatch: Dispatch<Action> }) {
  return (
    <ol
      role='status'
      aria-live='polite'
      className='pointer-events-none absolute bottom-3 right-3 z-30 flex w-[min(22rem,calc(100%-1.5rem))] flex-col gap-2'
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dispatch={dispatch} />
      ))}
    </ol>
  );
}

/**
 * What the phone or the computer would show in its own notification tray.
 * Kairós sends these through the system; a website cannot, so they are drawn
 * at the top of the window. The toast beside each one already announces it,
 * so the tray is not a second live region.
 */
function OsNoticeItem({ notice, dispatch }: { notice: OsNotice; dispatch: Dispatch<Action> }) {
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'dismissOs', id: notice.id }), 6000);
    return () => clearTimeout(t);
  }, [notice.id, dispatch]);

  return (
    <li className='kr-pop pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-[#202330]/95 p-3 text-[#F3F4F6] shadow-2xl backdrop-blur'>
      <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0B0C10]'>
        <Logo size={20} />
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-[11px] text-neutral-400'>Kairós · ahora</p>
        <p className='text-sm font-semibold'>{notice.title}</p>
        <p className='text-xs text-neutral-300'>{notice.body}</p>
      </div>
      <button
        type='button'
        onClick={() => dispatch({ type: 'dismissOs', id: notice.id })}
        aria-label='Descartar notificación'
        className={`shrink-0 rounded p-1 text-neutral-400 hover:text-neutral-100 ${FOCUS}`}
      >
        <X size={14} aria-hidden='true' />
      </button>
    </li>
  );
}

function OsTray({ notices, dispatch }: { notices: OsNotice[]; dispatch: Dispatch<Action> }) {
  if (notices.length === 0) return null;
  return (
    <ul
      aria-label='Notificaciones del sistema'
      className='pointer-events-none absolute right-3 top-3 z-40 flex w-[min(21rem,calc(100%-1.5rem))] flex-col gap-2'
    >
      {notices.map((n) => (
        <OsNoticeItem key={n.id} notice={n} dispatch={dispatch} />
      ))}
    </ul>
  );
}
