'use client';

import { useEffect, useReducer, type Dispatch } from 'react';
import { ChevronLeft, ChevronRight, Check, Mail, X } from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoModal from '@/components/demo/ui/DemoModal';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import { DemoInput, DemoSelect, DemoTextarea } from '@/components/demo/ui/DemoField';
import { DemoArtwork } from '@/components/demo/ui/DemoArtwork';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { demoDate, longDate, money } from '@/lib/demo/format';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  disciplines,
  findService,
  servicesOffered,
} from '@/lib/demo/apps/lazara-sersa/data';
import {
  createInitialState,
  enquiryDates,
  lightboxWork,
  reducer,
  sendEnquiry,
  suggestionFor,
  visibleWorks,
  type Action,
  // Aliased: `EnquiryForm` is the name of the form *component* in this file.
  type EnquiryForm as EnquiryFormValues,
  type State,
} from '@/lib/demo/apps/lazara-sersa/state';

/**
 * Lazara Sersa — portfolio, viewer and enquiry.
 *
 * The viewer is driven from the keyboard as well as the pointer, because a
 * gallery that only responds to clicks is a gallery a lot of people cannot
 * use: ← and → step through the filtered set and Escape closes it, on top of
 * the focus handling <DemoModal> brings (§19).
 */

const USD = (cents: number) => money(cents, 'USD', 'en-US', { decimals: 0 });

/**
 * The site's regions are components rather than one long render.
 *
 * Each takes the state and the dispatcher and derives what it needs from the
 * same selectors the rest of the demo uses, so nothing is threaded through as
 * a prop and no region can read another's locals. It also keeps the top-level
 * component short enough to see whole, which is the point.
 */
interface RegionProps {
  state: State;
  dispatch: Dispatch<Action>;
}

/** The filter link's classes. Depends only on its argument, so it lives here. */
function filterStyle(on: boolean): string {
  return (
    'pb-1 border-b transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--d-ring)] ' +
    (on
      ? 'text-[var(--d-accent)] border-[var(--d-accent)]'
      : 'text-[var(--d-muted)] border-transparent hover:text-[var(--d-fg)]')
  );
}

function FilterBar({ state, dispatch }: RegionProps) {
  return (
    <div
      className='px-6 py-4 flex flex-wrap gap-4 text-[11px] tracking-widest uppercase'
      role='group'
      aria-label='Filter work by discipline'
    >
      <button
        type='button'
        onClick={() => dispatch({ type: 'filter', discipline: null })}
        aria-pressed={state.discipline === null}
        className={filterStyle(state.discipline === null)}
      >
        All ({visibleWorks({ ...state, discipline: null }).length})
      </button>

      {disciplines.map((discipline) => (
        <button
          key={discipline}
          type='button'
          onClick={() => dispatch({ type: 'filter', discipline })}
          aria-pressed={state.discipline === discipline}
          className={filterStyle(state.discipline === discipline)}
        >
          {discipline}
        </button>
      ))}
    </div>
  );
}

function Gallery({ state, dispatch }: RegionProps) {
  return (
    <ul className='px-6 pb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
      {visibleWorks(state).map((work, index) => (
        <li key={work.id}>
          <button
            type='button'
            onClick={() => dispatch({ type: 'openLightbox', index })}
            className='group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
          >
            <span className='block aspect-4/5 overflow-hidden'>
              <span className='block w-full h-full transition-transform duration-500 group-hover:scale-105'>
                <DemoArtwork seed={work.id} />
              </span>
            </span>
            <span className='block text-xs mt-2 font-medium'>{work.title}</span>
            <span className='block text-[10px] tracking-widest uppercase text-[var(--d-muted)]'>
              {work.discipline} · {work.year}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ServiceList({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <section className='px-6 pb-8 border-t border-[var(--d-border)] pt-6'>
      <h2 className='text-[11px] tracking-widest uppercase text-[var(--d-muted)] mb-4'>
        Services
      </h2>
      <ul className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        {servicesOffered.map((service) => (
          <li
            key={service.id}
            className='p-4 border border-[var(--d-border)] bg-[var(--d-surface)] flex items-start justify-between gap-4'
          >
            <div className='min-w-0'>
              <p className='text-sm font-medium'>{service.name}</p>
              <p className='text-xs text-[var(--d-muted)] mt-0.5'>
                {service.detail}
              </p>
              <p className='text-xs mt-1'>from {USD(service.from)}</p>
            </div>
            <DemoButton
              size='sm'
              variant='secondary'
              onClick={() =>
                dispatch({ type: 'openEnquiry', serviceId: service.id })
              }
            >
              Enquire
            </DemoButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The full-bleed image viewer. Renders nothing when it is closed. */
function Viewer({ state, dispatch }: RegionProps) {
  const current = lightboxWork(state);
  if (!current) return null;

  const count = visibleWorks(state).length;

  return (
    <div className='absolute inset-0 z-20 bg-black/85 flex flex-col'>
      <div className='flex items-center justify-between px-4 py-3 shrink-0'>
        <p className='text-xs tracking-widest uppercase text-white/70'>
          {(state.lightbox ?? 0) + 1} / {count}
        </p>
        <button
          type='button'
          onClick={() => dispatch({ type: 'closeLightbox' })}
          aria-label='Close viewer'
          className='p-2 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
        >
          <X size={18} aria-hidden='true' />
        </button>
      </div>

      <div className='flex-1 min-h-0 flex items-center gap-2 px-2'>
        <button
          type='button'
          onClick={() => dispatch({ type: 'step', delta: -1 })}
          aria-label='Previous work'
          className='shrink-0 w-11 h-11 grid place-items-center text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
        >
          <ChevronLeft size={22} aria-hidden='true' />
        </button>

        <figure className='flex-1 min-w-0 h-full flex flex-col items-center justify-center gap-3 py-2'>
          <div className='max-h-full w-auto aspect-4/5 max-w-[min(100%,22rem)] overflow-hidden'>
            <DemoArtwork seed={current.id} label={current.title} />
          </div>
          <figcaption className='text-center'>
            <p className='text-sm text-white'>{current.title}</p>
            <p className='text-[11px] text-white/60 mt-0.5'>
              {current.discipline} · {current.year} — {current.note}
            </p>
          </figcaption>
        </figure>

        <button
          type='button'
          onClick={() => dispatch({ type: 'step', delta: 1 })}
          aria-label='Next work'
          className='shrink-0 w-11 h-11 grid place-items-center text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
        >
          <ChevronRight size={22} aria-hidden='true' />
        </button>
      </div>

      <p className='text-center text-[10px] text-white/40 pb-3 shrink-0'>
        Use ← and → to move between works
      </p>
    </div>
  );
}

function EnquiryReceipt({ enquiry }: { enquiry: NonNullable<State['enquiry']> }) {
  return (
    <div className='flex flex-col items-center gap-3 text-center py-2'>
      <span
        className='w-11 h-11 grid place-items-center rounded-full'
        style={{
          background: 'color-mix(in oklab, var(--d-positive) 18%, transparent)',
          color: 'var(--d-positive)',
        }}
      >
        <Check size={20} aria-hidden='true' />
      </span>
      <p className='text-sm'>
        Thank you, {enquiry.name}. Reference{' '}
        <span className='font-semibold'>{enquiry.reference}</span>.
      </p>
      <p className='text-xs text-[var(--d-muted)]'>
        {findService(enquiry.serviceId)?.name} ·{' '}
        {longDate(demoDate(enquiry.dateOffset), 'en-GB')}
      </p>
    </div>
  );
}

function EnquiryForm({
  state,
  dispatch,
  onSubmit,
}: RegionProps & { onSubmit: () => void }) {
  function field(name: keyof EnquiryFormValues) {
    return {
      value: state.form[name],
      error: state.errors[name],
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => dispatch({ type: 'field', name, value: event.target.value }),
    };
  }

  // A React 19 form action — see the note in the ballet demo.
  return (
    <form className='flex flex-col gap-3' action={() => onSubmit()}>
      <DemoInput label='Your name' autoComplete='off' {...field('name')} />
      <DemoInput
        label='Email'
        type='email'
        autoComplete='off'
        {...field('email')}
      />
      <DemoSelect label='Service' {...field('serviceId')}>
        {servicesOffered.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </DemoSelect>
      <DemoSelect label='Date' {...field('dateOffset')}>
        <option value=''>Select a date…</option>
        {enquiryDates().map(({ offset, booked }) => (
          <option key={offset} value={offset}>
            {longDate(demoDate(offset), 'en-GB')}
            {booked ? ' — booked' : ''}
          </option>
        ))}
      </DemoSelect>
      <DemoTextarea label='About the job' rows={3} {...field('message')} />

      {state.suggestion !== null && (
        <div className='flex flex-col gap-2'>
          <DemoStatus tone='info'>
            The nearest free date is{' '}
            {longDate(demoDate(state.suggestion), 'en-GB')}.
          </DemoStatus>
          <DemoButton
            size='sm'
            variant='secondary'
            onClick={() => dispatch({ type: 'acceptSuggestion' })}
          >
            Use that date instead
          </DemoButton>
        </div>
      )}

      <DemoStatus tone='error'>{state.failure}</DemoStatus>

      <DemoButton type='submit' block pending={state.submitting}>
        {state.submitting ? 'Sending…' : 'Send enquiry'}
      </DemoButton>
    </form>
  );
}

export default function LazaraSersaDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  // Arrow keys drive the viewer. Bound only while it is open, so the gallery
  // behind it is not silently intercepting keystrokes.
  useEffect(() => {
    if (state.lightbox === null) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') dispatch({ type: 'step', delta: 1 });
      if (event.key === 'ArrowLeft') dispatch({ type: 'step', delta: -1 });
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.lightbox]);

  async function submit() {
    dispatch({ type: 'submit' });

    const result = await simulate(() => sendEnquiry(state), DEMO_LATENCY.normal);

    if (result.ok) {
      dispatch({ type: 'submitSucceeded', enquiry: result.value });
      track('demo_completed', { project: 'lazara-sersa', workflow: 'enquiry' });
    } else {
      dispatch({
        type: 'submitFailed',
        message: result.failure.message,
        field: result.failure.field as keyof EnquiryFormValues | undefined,
        suggestion:
          result.failure.code === 'unavailable'
            ? (suggestionFor(Number(state.form.dateOffset)) ?? undefined)
            : undefined,
      });
    }
  }

  return (
    <div className='h-full flex flex-col'>
      <header className='shrink-0 px-6 py-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--d-border)]'>
        <div>
          <p className='text-xl tracking-[0.3em] font-light uppercase'>
            Lazara Sersa
          </p>
          <p className='text-[11px] tracking-widest uppercase text-[var(--d-muted)] mt-1'>
            Makeup artist · Beauty, editorial, fashion, bridal
          </p>
        </div>
        <DemoButton
          size='sm'
          variant='secondary'
          icon={<Mail size={13} aria-hidden='true' />}
          onClick={() => dispatch({ type: 'openEnquiry' })}
        >
          Enquire
        </DemoButton>
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        <FilterBar state={state} dispatch={dispatch} />
        <Gallery state={state} dispatch={dispatch} />
        <ServiceList dispatch={dispatch} />
      </div>

      <Viewer state={state} dispatch={dispatch} />

      {/* ── Enquiry ──────────────────────────────────────────────────────── */}
      <DemoModal
        open={state.enquiryOpen}
        onClose={() => dispatch({ type: 'closeEnquiry' })}
        title={state.enquiry ? 'Enquiry sent' : 'Enquire about a booking'}
        description={
          state.enquiry
            ? undefined
            : 'Tell me the date and the job, and I will come back to you.'
        }
        labelClose='Close'
      >
        {state.enquiry ? (
          <EnquiryReceipt enquiry={state.enquiry} />
        ) : (
          <EnquiryForm state={state} dispatch={dispatch} onSubmit={submit} />
        )}
      </DemoModal>
    </div>
  );
}
