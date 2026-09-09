'use client';

import { useReducer, type Dispatch } from 'react';
import {
  ArrowLeft,
  Check,
  Filter,
  Globe,
  Monitor,
  Users,
} from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import { DemoInput, DemoSelect, DemoTextarea } from '@/components/demo/ui/DemoField';
import { DemoAvatar } from '@/components/demo/ui/DemoArtwork';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { dayLabel, demoDate, longDate, money } from '@/lib/demo/format';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  SESSION_MINUTES,
  findProfessional,
  languagesOffered,
  slotKey,
  specialties,
  type Modality,
} from '@/lib/demo/apps/mensalere/data';
import {
  activeFilterCount,
  bookAppointment,
  canBook,
  chosen,
  createInitialState,
  daySlots,
  diaryDays,
  matches,
  reducer,
  type Action,
  type BookingForm,
  type State,
} from '@/lib/demo/apps/mensalere/state';

/**
 * Mensalere — directory, profile, booking.
 *
 * The filters are the point of the first screen, so they are always visible
 * and the result count moves as they change; the empty state says which
 * criteria produced it rather than pretending the directory is short.
 */

const EUR = (cents: number) => money(cents, 'EUR', 'en-GB', { decimals: 0 });

const modalityLabel: Record<Modality, string> = {
  online: 'Online',
  presencial: 'In person',
};


/**
 * One component per screen.
 *
 * They share nothing but the reducer, so each is its own component and derives
 * what it needs from the same selectors the rest of the demo uses. Each also
 * owns the condition that used to wrap it.
 */
interface ScreenProps {
  state: State;
  dispatch: Dispatch<Action>;
}

function DirectoryScreen({ state, dispatch }: ScreenProps) {
  if (state.screen !== 'directorio') return null;
  
  const results = matches(state);

  return (
    <div className='p-5'>
      <h1 className='text-lg font-bold tracking-tight'>
        Find the right professional
      </h1>
      <p className='text-xs text-[var(--d-muted)] mt-1 mb-4'>
        {SESSION_MINUTES}-minute sessions, online or in person.
      </p>

      <div
        className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'
        role='group'
        aria-label='Filters'
      >
        <DemoSelect
          label='Specialty'
          value={state.filters.specialty}
          onChange={(event) =>
            dispatch({
              type: 'filter',
              name: 'specialty',
              value: event.target.value,
            })
          }
        >
          <option value=''>Any</option>
          {specialties.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </DemoSelect>

        <DemoSelect
          label='Language'
          value={state.filters.language}
          onChange={(event) =>
            dispatch({
              type: 'filter',
              name: 'language',
              value: event.target.value,
            })
          }
        >
          <option value=''>Any</option>
          {languagesOffered.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </DemoSelect>

        <DemoSelect
          label='Format'
          value={state.filters.modality}
          onChange={(event) =>
            dispatch({
              type: 'filter',
              name: 'modality',
              value: event.target.value,
            })
          }
        >
          <option value=''>Any</option>
          <option value='online'>Online</option>
          <option value='presencial'>In person</option>
        </DemoSelect>

        <DemoSelect
          label='Maximum fee'
          value={String(state.filters.maxFee)}
          onChange={(event) =>
            dispatch({
              type: 'filter',
              name: 'maxFee',
              value: Number(event.target.value),
            })
          }
        >
          <option value='0'>No limit</option>
          <option value='6000'>Up to €60</option>
          <option value='7000'>Up to €70</option>
          <option value='8000'>Up to €80</option>
        </DemoSelect>
      </div>

      <div className='flex items-center gap-3 mt-4 mb-3'>
        <p
          className='text-xs text-[var(--d-muted)] flex items-center gap-1.5'
          role='status'
          aria-live='polite'
        >
          <Filter size={12} aria-hidden='true' />
          {results.length}{' '}
          {results.length === 1
            ? 'professional available'
            : 'professionals available'}
        </p>
        {activeFilterCount(state) > 0 && (
          <DemoButton
            size='sm'
            variant='ghost'
            onClick={() => dispatch({ type: 'clearFilters' })}
          >
            Clear filters ({activeFilterCount(state)})
          </DemoButton>
        )}
      </div>

      {results.length === 0 ? (
        <div
          style={{ borderRadius: 'var(--d-radius)' }}
          className='p-6 text-center border border-dashed border-[var(--d-border)]'
        >
          <p className='text-sm font-medium'>
            No professionals match all of those criteria.
          </p>
          <p className='text-xs text-[var(--d-muted)] mt-1'>
            Try widening the fee or the format.
          </p>
        </div>
      ) : (
        <ul className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
          {results.map((item) => (
            <li key={item.id}>
              <button
                type='button'
                onClick={() =>
                  dispatch({ type: 'openProfile', professionalId: item.id })
                }
                style={{ borderRadius: 'var(--d-radius)' }}
                className='w-full h-full text-left p-4 bg-[var(--d-surface)] border border-[var(--d-border)] hover:border-[var(--d-accent)] transition-colors duration-200 flex gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
              >
                <DemoAvatar name={item.name} size={44} />
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-semibold'>
                    {item.name}
                  </span>
                  <span className='block text-xs text-[var(--d-muted)]'>
                    {item.headline}
                  </span>
                  <span className='flex flex-wrap gap-1.5 mt-2'>
                    {item.modalities.map((modality) => (
                      <span
                        key={modality}
                        className='text-[10px] px-1.5 py-0.5 bg-[var(--d-surface-2)] text-[var(--d-muted)]'
                        style={{ borderRadius: 'calc(var(--d-radius) / 2)' }}
                      >
                        {modalityLabel[modality]}
                      </span>
                    ))}
                    <span
                      className='text-[10px] px-1.5 py-0.5 bg-[var(--d-surface-2)] text-[var(--d-muted)]'
                      style={{ borderRadius: 'calc(var(--d-radius) / 2)' }}
                    >
                      {item.languages.join(' · ')}
                    </span>
                  </span>
                  <span className='block text-xs font-semibold mt-2'>
                    {EUR(item.fee)} / session
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileScreen({ state, dispatch }: ScreenProps) {
  const person = chosen(state);
  if (state.screen !== 'perfil' || !person) return null;
  
  const slots = daySlots(state);

  return (
    <div className='p-5 max-w-3xl'>
      <DemoButton
        variant='ghost'
        size='sm'
        icon={<ArrowLeft size={13} aria-hidden='true' />}
        onClick={() => dispatch({ type: 'goto', screen: 'directorio' })}
      >
        Back to the list
      </DemoButton>

      <div className='flex gap-4 mt-4'>
        <DemoAvatar name={person.name} size={64} />
        <div className='min-w-0'>
          <h1 className='text-lg font-bold tracking-tight'>{person.name}</h1>
          <p className='text-xs text-[var(--d-muted)]'>{person.headline}</p>
          <p className='text-[11px] text-[var(--d-muted)] mt-1'>
            Registration no. {person.licence} · {person.years} years in practice · {person.city}
          </p>
        </div>
      </div>

      <p className='text-sm leading-relaxed mt-4'>{person.approach}</p>

      <dl className='grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs'>
        <div>
          <dt className='text-[var(--d-muted)]'>Specialties</dt>
          <dd className='mt-0.5'>{person.specialties.join(', ')}</dd>
        </div>
        <div>
          <dt className='text-[var(--d-muted)] flex items-center gap-1'>
            <Globe size={11} aria-hidden='true' /> Languages
          </dt>
          <dd className='mt-0.5'>{person.languages.join(', ')}</dd>
        </div>
        <div>
          <dt className='text-[var(--d-muted)]'>Session</dt>
          <dd className='mt-0.5'>
            {SESSION_MINUTES} min · {EUR(person.fee)}
          </dd>
        </div>
      </dl>

      {/* Modality */}
      {person.modalities.length > 1 && (
        <fieldset className='mt-5'>
          <legend className='text-xs font-semibold mb-2'>Format</legend>
          <div className='flex gap-2'>
            {person.modalities.map((modality) => (
              <label
                key={modality}
                style={{ borderRadius: 'var(--d-radius)' }}
                className={
                  'flex items-center gap-2 px-4 min-h-11 text-sm cursor-pointer border transition-colors duration-150 ' +
                  (state.modality === modality
                    ? 'border-[var(--d-accent)] text-[var(--d-accent)]'
                    : 'border-[var(--d-border)] text-[var(--d-muted)]')
                }
              >
                <input
                  type='radio'
                  name='modality'
                  value={modality}
                  checked={state.modality === modality}
                  onChange={() => dispatch({ type: 'setModality', modality })}
                  className='sr-only'
                />
                {modality === 'online' ? (
                  <Monitor size={14} aria-hidden='true' />
                ) : (
                  <Users size={14} aria-hidden='true' />
                )}
                {modalityLabel[modality]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Diary */}
      <h2 className='text-xs font-semibold mt-5 mb-2'>Next available appointments</h2>
      <div className='flex gap-1.5 overflow-x-auto pb-2' role='group' aria-label='Day'>
        {diaryDays().map((day) => (
          <button
            key={day.offset}
            type='button'
            onClick={() => dispatch({ type: 'setDay', dayOffset: day.offset })}
            aria-pressed={state.dayOffset === day.offset}
            style={{ borderRadius: 'var(--d-radius)' }}
            className={
              'shrink-0 px-3 min-h-11 text-xs border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
              (state.dayOffset === day.offset
                ? 'border-[var(--d-accent)] bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
                : 'border-[var(--d-border)] bg-[var(--d-surface)]')
            }
          >
            {dayLabel(day.date, 'en-GB')}
          </button>
        ))}
      </div>

      <div className='flex flex-wrap gap-1.5 mt-2' role='group' aria-label='Time'>
        {slots.map((slot) => (
          <button
            key={slot.time}
            type='button'
            disabled={!slot.available}
            onClick={() => dispatch({ type: 'setTime', time: slot.time })}
            aria-pressed={state.time === slot.time}
            style={{ borderRadius: 'var(--d-radius)' }}
            className={
              'px-4 min-h-11 text-xs border transition-colors duration-150 disabled:opacity-35 disabled:line-through disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
              (state.time === slot.time
                ? 'border-[var(--d-accent)] bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
                : 'border-[var(--d-border)] bg-[var(--d-surface)]')
            }
          >
            {slot.time}
          </button>
        ))}
      </div>

      {slots.every((slot) => !slot.available) && (
        <DemoStatus tone='info' className='mt-3'>
          No times are free that day. Try another.
        </DemoStatus>
      )}

      <DemoStatus tone='error' className='mt-3'>
        {state.failure}
      </DemoStatus>

      <DemoButton
        className='mt-4'
        size='lg'
        disabled={!canBook(state)}
        onClick={() => dispatch({ type: 'goto', screen: 'reserva' })}
      >
        Continue
      </DemoButton>
    </div>
  );
}

function BookingScreen({ state, dispatch, onSubmit }: ScreenProps & { onSubmit: () => void }) {
  const person = chosen(state);
  if (state.screen !== 'reserva' || !person) return null;

  return (
    <form
      className='p-5 max-w-sm flex flex-col gap-3'
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <DemoButton
        type='button'
        variant='ghost'
        size='sm'
        icon={<ArrowLeft size={13} aria-hidden='true' />}
        onClick={() => dispatch({ type: 'goto', screen: 'perfil' })}
      >
        Change the time
      </DemoButton>

      <h1 className='text-base font-bold tracking-tight'>Confirm the appointment</h1>
      <p className='text-xs text-[var(--d-muted)]'>
        {person.name} · {longDate(demoDate(state.dayOffset), 'en-GB')} at{' '}
        {state.time} ·{' '}
        {state.modality ? modalityLabel[state.modality] : ''} ·{' '}
        {EUR(person.fee)}
      </p>

      <DemoInput
        label='Name'
        autoComplete='off'
        value={state.form.name}
        error={state.errors.name}
        onChange={(event) =>
          dispatch({ type: 'field', name: 'name', value: event.target.value })
        }
      />
      <DemoInput
        label='Email'
        type='email'
        autoComplete='off'
        value={state.form.email}
        error={state.errors.email}
        onChange={(event) =>
          dispatch({ type: 'field', name: 'email', value: event.target.value })
        }
      />
      <DemoTextarea
        label='What brings you here (optional)'
        rows={3}
        hint='In this demo none of this leaves your browser.'
        value={state.form.reason}
        onChange={(event) =>
          dispatch({ type: 'field', name: 'reason', value: event.target.value })
        }
      />

      <label className='flex items-start gap-2.5 text-xs leading-relaxed cursor-pointer'>
        <input
          type='checkbox'
          checked={state.form.consent}
          onChange={(event) =>
            dispatch({
              type: 'field',
              name: 'consent',
              value: event.target.checked,
            })
          }
          aria-invalid={state.errors.consent ? true : undefined}
          className='mt-0.5 w-4 h-4 shrink-0 accent-[var(--d-accent)]'
        />
        <span>
          I agree to my details being processed to arrange this appointment.
          {state.errors.consent && (
            <span className='block text-[var(--d-danger)] font-medium mt-0.5'>
              {state.errors.consent}
            </span>
          )}
        </span>
      </label>

      <DemoStatus tone='error'>{state.failure}</DemoStatus>

      <DemoButton type='submit' block pending={state.submitting}>
        {state.submitting ? 'Booking…' : 'Book the appointment'}
      </DemoButton>
    </form>
  );
}

function ConfirmedScreen({ state, dispatch }: ScreenProps) {
  const appointment = state.appointment;
  if (state.screen !== 'confirmado' || !appointment) return null;

  return (
    <div className='p-6 max-w-md mx-auto flex flex-col items-center text-center gap-3'>
      <span
        className='w-12 h-12 grid place-items-center rounded-full'
        style={{
          background: 'color-mix(in oklab, var(--d-positive) 15%, transparent)',
          color: 'var(--d-positive)',
        }}
      >
        <Check size={22} aria-hidden='true' />
      </span>
      <h1 className='text-lg font-bold tracking-tight'>Appointment confirmed</h1>
      <p className='text-sm text-[var(--d-muted)] leading-relaxed'>
        {findProfessional(appointment.professionalId)?.name} ·{' '}
        {longDate(demoDate(appointment.dayOffset), 'en-GB')} at{' '}
        {appointment.time}
        <br />
        {modalityLabel[appointment.modality]} ·{' '}
        {EUR(appointment.fee)}
      </p>
      <p className='text-xs text-[var(--d-muted)]'>
        Reference{' '}
        <span className='font-bold text-[var(--d-fg)]'>
          {appointment.code}
        </span>
      </p>
      <DemoButton
        variant='secondary'
        onClick={() => dispatch({ type: 'goto', screen: 'directorio' })}
      >
        Back to the list
      </DemoButton>
    </div>
  );
}

export default function MensalereDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  // Only what `submit` needs; each screen derives its own.
  const person = chosen(state);

  async function submit() {
    dispatch({ type: 'submit' });

    const result = await simulate(
      () => bookAppointment(state),
      DEMO_LATENCY.normal,
    );

    if (result.ok) {
      dispatch({ type: 'submitSucceeded', appointment: result.value });
      track('demo_completed', { project: 'mensalere', workflow: 'appointment' });
    } else {
      const contested =
        result.failure.code === 'taken' && person !== undefined && state.time !== null;

      dispatch({
        type: 'submitFailed',
        message: result.failure.message,
        field: result.failure.field as keyof BookingForm | undefined,
        blockSlot: contested
          ? slotKey(person.id, state.dayOffset, state.time as string)
          : undefined,
      });
    }
  }

  return (
    <div className='h-full flex flex-col'>
      <header className='shrink-0 px-5 py-3.5 border-b border-[var(--d-border)] bg-[var(--d-surface)] flex items-center justify-between gap-4'>
        {/* The product's own mark, inlined from its favicon.svg, beside the
            letterspaced wordmark the site actually uses. */}
        <span className='flex items-center gap-2 shrink-0'>
          <svg width='22' height='22' viewBox='0 0 32 32' aria-hidden='true'>
            <rect width='32' height='32' rx='7' fill='#73877A' />
            <text
              x='16'
              y='22'
              fontFamily='Inter, system-ui, sans-serif'
              fontSize='17'
              fontWeight='600'
              fill='#F9F8F5'
              textAnchor='middle'
            >
              M
            </text>
          </svg>
          <span className='text-sm font-semibold tracking-[0.25em] uppercase'>
            Mensalere
          </span>
        </span>
        <p className='text-[11px] text-[var(--d-muted)] hidden sm:block'>
          Private consultations with psychology professionals
        </p>
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {/* ── Directory ─────────────────────────────────────────────────── */}
        <DirectoryScreen state={state} dispatch={dispatch} />

        {/* ── Profile and diary ─────────────────────────────────────────── */}
        <ProfileScreen state={state} dispatch={dispatch} />

        {/* ── Booking form ──────────────────────────────────────────────── */}
        <BookingScreen state={state} dispatch={dispatch} onSubmit={submit} />

        {/* ── Confirmation ──────────────────────────────────────────────── */}
        <ConfirmedScreen state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
