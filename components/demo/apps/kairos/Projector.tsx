'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { categoryOf, elapsed, pad, type Counter } from '@/lib/demo/apps/kairos/state';
import { victoryChime } from './sound';
import { FOCUS, HEADING, MONO } from './tokens';

/**
 * Modo proyector, from frontend/src/components/ProjectorMode.tsx: the
 * featured counter at full size, for a TV or a wall. When the counter crosses
 * a milestone while it is open, it plays the victory arpeggio, rains gold and
 * says so.
 *
 * The product covers the whole screen; here it covers the product's window,
 * which is the screen the demo has. Its confetti is canvas-confetti; this is
 * forty CSS pieces with fixed positions, so every visitor sees the same shower.
 */

const GOLD = ['#F59E0B', '#FBBF24', '#FDE68A', '#FFFFFF'];

const PIECES = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 7) % 10) / 20,
  duration: 1.6 + ((i * 13) % 10) / 10,
  drift: ((i * 29) % 21) - 10,
  color: GOLD[i % GOLD.length],
  size: 6 + (i % 3) * 2,
}));

function Confetti() {
  return (
    <div aria-hidden='true' className='pointer-events-none absolute inset-0 overflow-hidden'>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className='kr-confetti absolute top-0 block rounded-[1px]'
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--kr-drift' as string]: `${p.drift}cqw`,
          }}
        />
      ))}
    </div>
  );
}

export default function Projector({
  counter,
  clock,
  chimeOn,
  celebration,
  onCelebrated,
  onClose,
}: {
  counter: Counter;
  clock: number;
  chimeOn: boolean;
  /** The milestone being celebrated, set by the watcher when it was crossed here. */
  celebration: number | null;
  onCelebrated: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Three seconds of banner and confetti, opening with the arpeggio.
  const onCelebratedRef = useRef(onCelebrated);
  useEffect(() => {
    onCelebratedRef.current = onCelebrated;
  }, [onCelebrated]);
  useEffect(() => {
    if (celebration === null) return;
    if (chimeOn) victoryChime();
    const t = setTimeout(() => onCelebratedRef.current(), 3000);
    return () => clearTimeout(t);
    // The bell setting is read when the milestone lands, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebration]);

  // Escape closes, as in the product; focus moves in and goes back on close.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const cat = categoryOf(counter.category);
  const t = elapsed(counter.start_date, clock);

  return (
    // `open`, not showModal(): a modal <dialog> goes to the browser's top layer
    // and would cover the website. This one covers the product's window, and
    // the dashboard behind it is made inert by App.tsx.
    <dialog
      open
      aria-label={`Modo proyector · ${counter.title}`}
      className='kr-fade @container absolute inset-0 z-20 m-0 flex size-full max-h-none max-w-none flex-col items-center justify-center overflow-hidden border-0 bg-[#0B0C10] p-0 text-[#F3F4F6]'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute left-1/2 top-1/3 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl'
        style={{ backgroundColor: `${cat.bar}14` }}
      />
      {celebration !== null && (
        <>
          <Confetti />
          <div className='kr-pop absolute inset-x-0 top-5 z-10 flex justify-center' role='status'>
            <span
              className={`${MONO} rounded-full border border-amber-500/40 bg-amber-500/15 px-6 py-2 text-sm uppercase tracking-[0.3em] text-amber-300`}
            >
              ¡Hito de {celebration} días!
            </span>
          </div>
        </>
      )}
      <button
        ref={closeRef}
        type='button'
        onClick={onClose}
        aria-label='Cerrar modo proyector'
        className={`absolute right-5 top-5 z-10 rounded-full border border-white/10 p-3 text-neutral-400 transition-colors duration-150 hover:border-white/30 hover:text-neutral-100 ${FOCUS}`}
      >
        <X size={20} aria-hidden='true' />
      </button>

      <p className={`${MONO} relative text-xs uppercase tracking-[0.4em] text-amber-400/90 @2xl:text-sm`}>
        Modo proyector · {cat.label}
      </p>
      <h2
        className={`${HEADING} relative mt-4 max-w-4xl px-6 text-center text-2xl font-bold tracking-tight text-neutral-300 @2xl:text-4xl`}
      >
        {counter.title}
      </h2>
      <p
        key={counter.days_elapsed}
        className={`${HEADING} kr-zoom relative mt-2 font-black leading-none tabular-nums tracking-tighter text-neutral-50`}
        style={{ fontSize: 'clamp(6rem, 26cqw, 18rem)' }}
      >
        {counter.days_elapsed}
      </p>
      <p className={`${MONO} relative text-sm uppercase tracking-[0.5em] text-neutral-500 @2xl:text-base`}>días</p>
      <p className={`${MONO} relative mt-6 text-lg tabular-nums text-neutral-400 @2xl:text-2xl`}>
        {t.d}d · {pad(t.h)}h · {pad(t.m)}m · {pad(t.s)}s
      </p>

      <div className='relative mt-10 w-72 @2xl:w-96'>
        <div className='h-1.5 overflow-hidden rounded-full bg-white/10'>
          <div
            className='h-full rounded-full'
            style={{ width: `${counter.cycle_progress * 100}%`, backgroundColor: cat.bar, transition: 'width 0.6s ease' }}
          />
        </div>
        <p className={`${MONO} mt-3 text-center text-xs uppercase tracking-[0.25em] text-neutral-500 @2xl:text-sm`}>
          Próximo hito: día {counter.next_milestone} · faltan {counter.days_to_next}
        </p>
      </div>
    </dialog>
  );
}
