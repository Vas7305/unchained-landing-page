'use client';

import { useRef, useState, type Dispatch, type FocusEvent, type KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import {
  checkDays,
  statusOf,
  weekdayLetter,
  type Action,
  type DayStatus,
} from '@/lib/demo/apps/kairos/state';
import type { RawCounter } from '@/lib/demo/apps/kairos/data';
import { FOCUS, MONO } from './tokens';

/**
 * The daily task: one square per day, each opening a small picker — done,
 * not done, clear. From frontend/src/components/DailyChecks.tsx.
 *
 * An unmarked day in the past is drawn as not done, faded; today stays
 * pending. The product's popover is a base-ui Popover; this one is a group of
 * three buttons that closes on Escape, on a pick or when focus leaves it.
 */

const TONE = {
  done: 'border-[color-mix(in_oklab,var(--k-emerald)_50%,transparent)] bg-[color-mix(in_oklab,var(--k-emerald)_15%,transparent)] text-[var(--k-emerald)]',
  missed:
    'border-[color-mix(in_oklab,var(--k-red)_40%,transparent)] bg-[color-mix(in_oklab,var(--k-red)_10%,transparent)] text-[var(--k-red)]',
  pending: 'border-dashed border-[var(--k-line-dash)] text-[var(--k-ink-5)] hover:border-[var(--k-ink-5)]',
} as const;

const LABEL = { done: 'cumplido', missed: 'no cumplido', pending: 'pendiente' } as const;

function DayCell({
  iso,
  status,
  isToday,
  size,
  onPick,
}: {
  iso: string;
  status: DayStatus;
  isToday: boolean;
  size: 'sm' | 'lg';
  onPick: (status: DayStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const shown = status ?? (isToday ? null : 'missed');
  const label = LABEL[shown ?? 'pending'];
  const box = size === 'lg' ? 'size-7 rounded-lg @md:size-8' : 'size-5 rounded-md';
  const icon = size === 'lg' ? 16 : 12;

  const pick = (s: DayStatus) => {
    setOpen(false);
    onPick(s);
    trigger.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div className='relative flex flex-col items-center gap-0.5' onKeyDown={onKeyDown} onBlur={onBlur}>
      {size === 'lg' && <span className={`${MONO} text-[9px] text-[var(--k-ink-6)]`}>{weekdayLetter(iso)}</span>}
      <button
        ref={trigger}
        type='button'
        title={`${iso} · ${label}${isToday ? ' (hoy)' : ''}`}
        aria-label={`${iso}: ${label}${isToday ? ' (hoy)' : ''}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex ${box} items-center justify-center border transition-colors duration-150 ${FOCUS} ${
          TONE[shown ?? 'pending']
        } ${status === null && !isToday ? 'opacity-70' : ''}`}
      >
        {shown === 'done' && <Check size={icon} strokeWidth={3} aria-hidden='true' />}
        {shown === 'missed' && <X size={icon} strokeWidth={3} aria-hidden='true' />}
      </button>
      {open && (
        <div
          role='group'
          aria-label={`Marcar ${iso}`}
          onClick={(e) => e.stopPropagation()}
          className='absolute bottom-full left-1/2 z-10 mb-1.5 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-[var(--k-line)] p-1.5 shadow-xl [background:var(--k-active)]'
        >
          <button
            type='button'
            autoFocus
            onClick={() => pick('done')}
            aria-label='Cumplido'
            aria-pressed={status === 'done'}
            className={`flex size-9 items-center justify-center rounded-lg border ${TONE.done} ${FOCUS}`}
          >
            <Check size={20} strokeWidth={3} aria-hidden='true' />
          </button>
          <button
            type='button'
            onClick={() => pick('missed')}
            aria-label='No cumplido'
            aria-pressed={status === 'missed'}
            className={`flex size-9 items-center justify-center rounded-lg border ${TONE.missed} ${FOCUS}`}
          >
            <X size={20} strokeWidth={3} aria-hidden='true' />
          </button>
          {status !== null && (
            <button
              type='button'
              onClick={() => pick(null)}
              className={`${MONO} px-1.5 text-[10px] uppercase tracking-wider text-[var(--k-ink-5)] hover:text-[var(--k-ink-2)] ${FOCUS}`}
            >
              Borrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyChecks({
  counter,
  today,
  days,
  size = 'sm',
  dispatch,
}: {
  counter: RawCounter;
  today: string;
  days: number;
  size?: 'sm' | 'lg';
  dispatch: Dispatch<Action>;
}) {
  const todayDone = counter.completed_dates.includes(today);
  const set = (day: string, status: DayStatus) => dispatch({ type: 'setDay', id: counter.id, day, status });

  return (
    <div className='mt-2.5 flex flex-wrap items-end gap-1'>
      {checkDays(counter, today, days).map((iso) => (
        <DayCell
          key={iso}
          iso={iso}
          status={statusOf(counter, iso)}
          isToday={iso === today}
          size={size}
          onPick={(status) => set(iso, status)}
        />
      ))}
      {size === 'lg' && (
        <button
          type='button'
          onClick={() => set(today, todayDone ? null : 'done')}
          className={`${MONO} ml-2 flex min-h-8 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs transition-colors duration-150 ${FOCUS} ${
            todayDone
              ? `border ${TONE.done}`
              : 'font-semibold text-[var(--k-primary-ink)] [background:var(--k-go)] hover:[background:var(--k-go-hover)]'
          }`}
        >
          <Check size={14} strokeWidth={3} aria-hidden='true' />
          {todayDone ? 'Hoy cumplido' : 'Marcar hoy como cumplido'}
        </button>
      )}
    </div>
  );
}
