'use client';

import { useReducer, type Dispatch } from 'react';
import { ArrowLeft, Check, Clock, MapPin, Minus, Plus } from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import { DemoInput } from '@/components/demo/ui/DemoField';
import { DemoArtwork } from '@/components/demo/ui/DemoArtwork';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { demoDate, longDate, money } from '@/lib/demo/format';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  HANDLING_FEE,
  MAX_PER_ORDER,
  findCategory,
  gala,
  programme,
  totalRuntime,
} from '@/lib/demo/apps/klassisches-ballet/data';
import {
  categoryRows,
  createInitialState,
  reducer,
  reserve,
  seatCount,
  subtotal,
  total,
  type Action,
  type ReservationForm,
  type State,
} from '@/lib/demo/apps/klassisches-ballet/state';

/**
 * Klassisches Ballett — the gala site and its reservation flow.
 *
 * Three screens: the evening, the seats, the details. The seat step is the one
 * that carries the product, so it is where the inventory is visible — seats
 * left per category, categories that are gone, and the house limit stopping
 * the stepper before the reservation has to be refused.
 */

const EUR = (cents: number) => money(cents, 'EUR', 'en-GB');


/**
 * One component per screen.
 *
 * The evening has four of them and they share nothing but the reducer, so
 * holding all four in one function only made the file long. Each derives what
 * it needs from the same selectors the rest of the demo uses.
 */
interface ScreenProps {
  state: State;
  dispatch: Dispatch<Action>;
}

function ProgrammeScreen({ state, dispatch }: ScreenProps) {
  if (state.screen !== 'programm') return null;

  return (
    <div className='max-w-2xl'>
      <h2 className='text-sm font-bold tracking-wide mb-1'>Programme</h2>
      <p className='text-xs text-[var(--d-muted)] mb-4'>
        Five works, {totalRuntime} minutes on stage, one interval.
      </p>

      <ol className='flex flex-col divide-y divide-[var(--d-border)]'>
        {programme.map((piece, index) => (
          <li key={piece.id} className='py-3 flex gap-4'>
            <span className='text-[var(--d-accent)] text-xs pt-0.5 w-6 shrink-0'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className='min-w-0'>
              <p className='text-sm font-medium'>{piece.title}</p>
              <p className='text-xs text-[var(--d-muted)]'>
                {piece.composer} · {piece.detail}
              </p>
            </div>
            <span className='ml-auto text-xs text-[var(--d-muted)] shrink-0'>
              {piece.minutes}′
            </span>
          </li>
        ))}
      </ol>

      <DemoButton
        className='mt-6'
        size='lg'
        onClick={() => dispatch({ type: 'goto', screen: 'tickets' })}
      >
        Reserve your evening
      </DemoButton>
    </div>
  );
}

function SeatsScreen({ state, dispatch }: ScreenProps) {
  if (state.screen !== 'tickets') return null;

  const rows = categoryRows(state);
  const seats = seatCount(state);

  return (
    <div className='max-w-2xl'>
      <h2 className='text-sm font-bold tracking-wide mb-1'>
        Seat categories
      </h2>
      <p className='text-xs text-[var(--d-muted)] mb-4'>
        At most {MAX_PER_ORDER} seats per reservation.
      </p>

      <ul className='flex flex-col gap-2'>
        {rows.map((row) => (
          <li
            key={row.id}
            style={{ borderRadius: 'var(--d-radius)' }}
            className={
              'p-3 border bg-[var(--d-surface)] flex items-center gap-4 ' +
              (row.soldOut
                ? 'border-[var(--d-border)] opacity-55'
                : 'border-[var(--d-border)]')
            }
          >
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium'>{row.name}</p>
              <p className='text-xs text-[var(--d-muted)]'>{row.detail}</p>
              <p className='text-[11px] mt-1'>
                {row.soldOut ? (
                  <span className='text-[var(--d-danger)]'>
                    Sold out
                  </span>
                ) : (
                  <span className='text-[var(--d-muted)]'>
                    {row.remaining} {row.remaining === 1 ? 'seat' : 'seats'} left
                  </span>
                )}
              </p>
            </div>

            <span className='text-sm font-bold tabular-nums shrink-0'>
              {EUR(row.price)}
            </span>

            <div className='flex items-center gap-1 shrink-0'>
              <button
                type='button'
                disabled={row.qty === 0}
                onClick={() =>
                  dispatch({
                    type: 'setQty',
                    categoryId: row.id,
                    qty: row.qty - 1,
                  })
                }
                aria-label={`One fewer seat in ${row.name}`}
                style={{ borderRadius: 'var(--d-radius)' }}
                className='w-9 h-9 grid place-items-center border border-[var(--d-border)] disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                <Minus size={13} aria-hidden='true' />
              </button>
              <span
                className='w-6 text-center text-sm font-bold tabular-nums'
                aria-label={`${row.qty} seats in ${row.name}`}
              >
                {row.qty}
              </span>
              <button
                type='button'
                disabled={row.soldOut || row.qty >= row.remaining || row.limitReached}
                onClick={() =>
                  dispatch({
                    type: 'setQty',
                    categoryId: row.id,
                    qty: row.qty + 1,
                  })
                }
                aria-label={`One more seat in ${row.name}`}
                style={{ borderRadius: 'var(--d-radius)' }}
                className='w-9 h-9 grid place-items-center border border-[var(--d-border)] disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                <Plus size={13} aria-hidden='true' />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {seats >= MAX_PER_ORDER && (
        <DemoStatus tone='info' className='mt-3'>
          You have reached the maximum of {MAX_PER_ORDER} seats.
        </DemoStatus>
      )}

      <dl
        style={{ borderRadius: 'var(--d-radius)' }}
        className='mt-4 p-3 border border-[var(--d-border)] bg-[var(--d-surface)] text-sm flex flex-col gap-1.5'
      >
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>
            {seats} {seats === 1 ? 'seat' : 'seats'}
          </dt>
          <dd className='tabular-nums'>{EUR(subtotal(state))}</dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>Booking fee</dt>
          <dd className='tabular-nums'>
            {EUR(seats === 0 ? 0 : HANDLING_FEE)}
          </dd>
        </div>
        <div className='flex justify-between pt-1.5 mt-1 border-t border-[var(--d-border)]'>
          <dt className='font-bold'>Total</dt>
          <dd className='font-bold tabular-nums'>{EUR(total(state))}</dd>
        </div>
      </dl>

      <div className='flex flex-wrap gap-3 mt-4'>
        <DemoButton
          variant='ghost'
          icon={<ArrowLeft size={13} aria-hidden='true' />}
          onClick={() => dispatch({ type: 'goto', screen: 'programm' })}
        >
          Back
        </DemoButton>
        <DemoButton
          disabled={seats === 0}
          onClick={() => dispatch({ type: 'goto', screen: 'daten' })}
        >
          Continue to reservation
        </DemoButton>
      </div>
    </div>
  );
}

function DetailsScreen({
  state,
  dispatch,
  onSubmit,
}: ScreenProps & { onSubmit: () => void }) {
  if (state.screen !== 'daten') return null;

  const seats = seatCount(state);

  function field(name: keyof ReservationForm) {
    return {
      value: state.form[name],
      error: state.errors[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: 'field', name, value: event.target.value }),
    };
  }

  // A React 19 form action rather than onSubmit + preventDefault: React stops
  // the native submission itself, so the demo keeps every form semantic —
  // implicit submission on Enter, label association, the lot — without the
  // handler having to block navigation by hand.
  return (
    <form className='max-w-sm flex flex-col gap-3' action={() => void onSubmit()}>
      <h2 className='text-sm font-bold tracking-wide'>Your details</h2>
      <p className='text-xs text-[var(--d-muted)]'>
        {seats} {seats === 1 ? 'seat' : 'seats'} · {EUR(total(state))}. Tickets
        will be held for you at the box office.
      </p>

      <DemoInput label='Name' autoComplete='off' {...field('name')} />
      <DemoInput
        label='Email'
        type='email'
        autoComplete='off'
        {...field('email')}
      />
      <DemoInput
        label='Phone'
        inputMode='tel'
        autoComplete='off'
        {...field('phone')}
      />

      <DemoStatus tone='error'>{state.failure}</DemoStatus>

      <div className='flex flex-wrap gap-3'>
        <DemoButton
          type='button'
          variant='ghost'
          icon={<ArrowLeft size={13} aria-hidden='true' />}
          onClick={() => dispatch({ type: 'goto', screen: 'tickets' })}
        >
          Back
        </DemoButton>
        <DemoButton type='submit' pending={state.submitting}>
          {state.submitting ? 'Reserving…' : 'Confirm reservation'}
        </DemoButton>
      </div>
    </form>
  );
}

function ConfirmationScreen({ state, dispatch }: ScreenProps) {
  const reservation = state.reservation;
  if (state.screen !== 'bestaetigt' || !reservation) return null;

  return (
    <div className='max-w-md flex flex-col items-center text-center gap-3 py-6 mx-auto'>
      <span
        className='w-12 h-12 grid place-items-center rounded-full'
        style={{
          background: 'color-mix(in oklab, var(--d-positive) 18%, transparent)',
          color: 'var(--d-positive)',
        }}
      >
        <Check size={22} aria-hidden='true' />
      </span>
      <h2 className='text-lg font-bold'>Reservation confirmed</h2>
      <p className='text-sm text-[var(--d-muted)] leading-relaxed'>
        Thank you, {reservation.name}. Your reservation number is{' '}
        <span className='font-bold text-[var(--d-fg)]'>
          {reservation.code}
        </span>
        .
      </p>

      <ul className='w-full text-left text-xs flex flex-col gap-1 mt-2'>
        {reservation.lines.map((line) => (
          <li
            key={line.categoryId}
            className='flex justify-between border-b border-[var(--d-border)] pb-1'
          >
            <span>
              {line.qty} × {findCategory(line.categoryId)?.name}
            </span>
            <span className='tabular-nums'>
              {EUR((findCategory(line.categoryId)?.price ?? 0) * line.qty)}
            </span>
          </li>
        ))}
        <li className='flex justify-between font-bold pt-1'>
          <span>Total</span>
          <span className='tabular-nums'>{EUR(reservation.total)}</span>
        </li>
      </ul>

      <DemoButton
        variant='secondary'
        className='mt-3'
        onClick={() => dispatch({ type: 'goto', screen: 'tickets' })}
      >
        Reserve more seats
      </DemoButton>
    </div>
  );
}

export default function KlassischesBalletDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  const galaDate = demoDate(gala.dateOffset);

  async function submit() {
    dispatch({ type: 'submit' });

    const result = await simulate(() => reserve(state), DEMO_LATENCY.normal);

    if (result.ok) {
      dispatch({ type: 'submitSucceeded', reservation: result.value });
      track('demo_completed', {
        project: 'klassisches-ballet',
        workflow: 'reservation',
      });
    } else {
      dispatch({
        type: 'submitFailed',
        message: result.failure.message,
        field: result.failure.field as keyof ReservationForm | undefined,
      });
    }
  }

  return (
    <div className='h-full flex flex-col'>
      {/* ── Poster header ───────────────────────────────────────────────── */}
      <header className='shrink-0 relative border-b border-[var(--d-border)] overflow-hidden'>
        <div className='absolute inset-0 opacity-25' aria-hidden='true'>
          <DemoArtwork seed='gala-poster' />
        </div>
        <div className='relative px-6 py-5'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-[var(--d-accent)]'>
            {gala.eyebrow}
          </p>
          <h1 className='text-2xl md:text-3xl font-bold tracking-wide mt-1'>
            {gala.title}
          </h1>
          <p className='text-xs text-[var(--d-muted)] mt-2 flex flex-wrap items-center gap-x-4 gap-y-1'>
            <span className='inline-flex items-center gap-1.5'>
              <MapPin size={12} aria-hidden='true' />
              {gala.venue}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Clock size={12} aria-hidden='true' />
              {longDate(galaDate, 'en-GB')} · doors {gala.doors}, curtain {gala.curtain}
            </span>
          </p>
        </div>
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto px-6 py-5'>
        <ProgrammeScreen state={state} dispatch={dispatch} />
        <SeatsScreen state={state} dispatch={dispatch} />
        <DetailsScreen state={state} dispatch={dispatch} onSubmit={submit} />
        <ConfirmationScreen state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}