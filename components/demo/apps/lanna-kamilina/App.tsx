'use client';

import { useReducer } from 'react';
import { ArrowLeft, Calendar, Check, Clock, Scissors } from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import DemoTabs, { DemoTabPanel } from '@/components/demo/ui/DemoTabs';
import { DemoInput, DemoTextarea } from '@/components/demo/ui/DemoField';
import { DemoArtwork, DemoAvatar } from '@/components/demo/ui/DemoArtwork';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { dayLabel, demoDate, longDate, money } from '@/lib/demo/format';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  categories,
  findMaster,
  findService,
  masters,
  slotKey,
  works,
} from '@/lib/demo/apps/lanna-kamilina/data';
import {
  availableMasters,
  bookableDays,
  canAdvance,
  chosenMaster,
  chosenService,
  createInitialState,
  daySlots,
  confirmBooking,
  reducer,
  visibleServices,
  type BookingForm,
  type State,
  type Step,
} from '@/lib/demo/apps/lanna-kamilina/state';

/**
 * Lanna Kamilina — the salon site and its booking.
 *
 * The catalogue and the masters are what the site is; the four-step booking is
 * what it does. Everything the visitor picks narrows what comes next, which is
 * the part of a booking product that is genuinely hard and the part worth
 * demonstrating (§6).
 */

const RUB = (kopeks: number) => money(kopeks, 'RUB', 'ru-RU', { decimals: 0 });

const STEP_LABELS = ['Услуга', 'Мастер', 'Время', 'Контакты'] as const;

function Stepper({ step }: { step: Step }) {
  return (
    <ol className='flex items-center gap-1.5 text-[11px]'>
      {STEP_LABELS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className='flex items-center gap-1.5'>
            <span
              className='inline-flex items-center gap-1.5 px-2 py-1 border'
              style={{
                borderColor: current || done ? 'var(--d-accent)' : 'var(--d-border)',
                color: current ? 'var(--d-accent)' : 'var(--d-muted)',
                borderRadius: 'var(--d-radius)',
              }}
              aria-current={current ? 'step' : undefined}
            >
              {done ? <Check size={11} aria-hidden='true' /> : `${index + 1}.`}
              {label}
            </span>
            {index < STEP_LABELS.length - 1 && (
              <span aria-hidden='true' className='text-[var(--d-border)]'>
                —
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function LannaKamilinaDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  const service = chosenService(state);
  const master = chosenMaster(state);
  const days = bookableDays(state);
  const slots = daySlots(state);

  async function confirm() {
    dispatch({ type: 'submit' });

    const result = await simulate(() => confirmBooking(state), DEMO_LATENCY.normal);

    if (result.ok) {
      dispatch({ type: 'submitSucceeded', booking: result.value });
      track('demo_completed', { project: 'lanna-kamilina', workflow: 'booking' });
    } else {
      const contested =
        result.failure.code === 'taken' &&
        state.masterId !== null &&
        state.dayOffset !== null &&
        state.time !== null;

      dispatch({
        type: 'submitFailed',
        message: result.failure.message,
        blockSlot: contested
          ? slotKey(state.masterId as string, state.dayOffset as number, state.time as string)
          : undefined,
      });
    }
  }

  function field(name: keyof BookingForm) {
    return {
      value: state.form[name],
      error: state.errors[name],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => dispatch({ type: 'field', name, value: event.target.value }),
    };
  }

  return (
    <div className='h-full flex flex-col'>
      {/* ── Site header ─────────────────────────────────────────────────── */}
      <header className='shrink-0 border-b border-[var(--d-border)] bg-[var(--d-surface)]'>
        <div className='px-5 pt-4 pb-3 flex items-baseline justify-between gap-4'>
          <div>
            <p className='text-lg font-bold tracking-wide'>ЛАННА КАМИЛИНА</p>
            <p className='text-[11px] text-[var(--d-muted)]'>
              Салон красоты в центре Москвы · с 1999 года
            </p>
          </div>
          <p className='text-[11px] text-[var(--d-muted)] hidden sm:block'>
            Пн–Сб 10:00–21:00
          </p>
        </div>

        <div className='px-5'>
          <DemoTabs
            label='Разделы сайта'
            active={state.tab}
            onChange={(tab) => dispatch({ type: 'setTab', tab: tab as State['tab'] })}
            tabs={[
              { id: 'services', label: 'Услуги' },
              { id: 'masters', label: 'Мастера' },
              { id: 'works', label: 'Работы' },
              { id: 'booking', label: 'Онлайн-запись' },
            ]}
          />
        </div>
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto px-5 py-5'>
        {/* ── Services ──────────────────────────────────────────────────── */}
        <DemoTabPanel id='services' active={state.tab}>
          <div className='flex flex-wrap gap-1.5 mb-4'>
            <button
              type='button'
              onClick={() => dispatch({ type: 'setCategory', category: null })}
              style={{ borderRadius: 'var(--d-radius)' }}
              className={
                'px-3 min-h-9 text-xs border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                (state.category === null
                  ? 'border-[var(--d-accent)] text-[var(--d-accent)]'
                  : 'border-[var(--d-border)] text-[var(--d-muted)]')
              }
            >
              Все
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type='button'
                onClick={() => dispatch({ type: 'setCategory', category })}
                style={{ borderRadius: 'var(--d-radius)' }}
                className={
                  'px-3 min-h-9 text-xs border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                  (state.category === category
                    ? 'border-[var(--d-accent)] text-[var(--d-accent)]'
                    : 'border-[var(--d-border)] text-[var(--d-muted)]')
                }
              >
                {category}
              </button>
            ))}
          </div>

          <ul className='flex flex-col divide-y divide-[var(--d-border)]'>
            {visibleServices(state).map((item) => (
              <li
                key={item.id}
                className='py-3 flex items-start justify-between gap-4'
              >
                <div className='min-w-0'>
                  <p className='text-sm font-semibold'>{item.name}</p>
                  <p className='text-xs text-[var(--d-muted)] mt-0.5'>
                    {item.description}
                  </p>
                  <p className='text-[11px] text-[var(--d-muted)] mt-1 flex items-center gap-1'>
                    <Clock size={11} aria-hidden='true' />
                    {item.duration} мин
                  </p>
                </div>
                <div className='text-right shrink-0 flex flex-col items-end gap-1.5'>
                  <span className='text-sm font-bold tabular-nums'>
                    {RUB(item.price)}
                  </span>
                  <DemoButton
                    size='sm'
                    onClick={() =>
                      dispatch({ type: 'chooseService', serviceId: item.id })
                    }
                  >
                    Записаться
                  </DemoButton>
                </div>
              </li>
            ))}
          </ul>
        </DemoTabPanel>

        {/* ── Masters ───────────────────────────────────────────────────── */}
        <DemoTabPanel id='masters' active={state.tab}>
          <ul className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {masters.map((person) => (
              <li
                key={person.id}
                style={{ borderRadius: 'var(--d-radius)' }}
                className='p-4 border border-[var(--d-border)] bg-[var(--d-surface)] flex gap-3'
              >
                <DemoAvatar name={person.name} size={48} />
                <div className='min-w-0'>
                  <p className='text-sm font-semibold'>{person.name}</p>
                  <p className='text-xs text-[var(--d-muted)]'>{person.title}</p>
                  <p className='text-[11px] text-[var(--d-muted)] mt-1'>
                    В салоне с {person.since} · {person.categories.join(', ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </DemoTabPanel>

        {/* ── Gallery ───────────────────────────────────────────────────── */}
        <DemoTabPanel id='works' active={state.tab}>
          <ul className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
            {works.map((work) => (
              <li key={work.id}>
                <div
                  className='aspect-4/5 overflow-hidden'
                  style={{ borderRadius: 'var(--d-radius)' }}
                >
                  <DemoArtwork seed={work.id} />
                </div>
                <p className='text-xs font-medium mt-1.5'>{work.title}</p>
                <p className='text-[11px] text-[var(--d-muted)]'>{work.category}</p>
              </li>
            ))}
          </ul>
        </DemoTabPanel>

        {/* ── Booking ───────────────────────────────────────────────────── */}
        <DemoTabPanel id='booking' active={state.tab}>
          {state.step === 4 && state.booking ? (
            <div className='max-w-md mx-auto text-center flex flex-col items-center gap-3 py-6'>
              <span
                className='w-12 h-12 grid place-items-center rounded-full'
                style={{
                  background: 'color-mix(in oklab, var(--d-positive) 18%, transparent)',
                  color: 'var(--d-positive)',
                }}
              >
                <Check size={22} aria-hidden='true' />
              </span>
              <h2 className='text-lg font-bold'>Вы записаны</h2>
              <p className='text-sm text-[var(--d-muted)] leading-relaxed'>
                {findService(state.booking.serviceId)?.name} ·{' '}
                {findMaster(state.booking.masterId)?.name}
                <br />
                {/* The booked day, computed from the booking itself. This read
                    the day out of `bookableDays(state)` and fell back to
                    `new Date()`, which was wrong twice over: that list is
                    rebuilt from the *currently* chosen master, and the fallback
                    would have printed today's date as the appointment. */}
                {longDate(demoDate(state.booking.dayOffset), 'ru-RU')}{' '}
                в {state.booking.time}
              </p>
              <p className='text-xs text-[var(--d-muted)]'>
                Номер записи{' '}
                <span className='font-bold text-[var(--d-fg)]'>
                  {state.booking.code}
                </span>{' '}
                · {RUB(state.booking.price)}
              </p>
              <DemoButton
                variant='secondary'
                onClick={() => dispatch({ type: 'startOver' })}
              >
                Записаться ещё раз
              </DemoButton>
            </div>
          ) : (
            <div className='max-w-2xl'>
              <Stepper step={state.step} />

              <div className='mt-5 flex flex-col gap-4'>
                {/* Step 0 — service */}
                {state.step === 0 && (
                  <div>
                    <h2 className='text-sm font-bold mb-3'>Выберите услугу</h2>
                    <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                      {visibleServices(state).map((item) => (
                        <li key={item.id}>
                          <button
                            type='button'
                            onClick={() =>
                              dispatch({ type: 'chooseService', serviceId: item.id })
                            }
                            style={{ borderRadius: 'var(--d-radius)' }}
                            className='w-full text-left p-3 border border-[var(--d-border)] bg-[var(--d-surface)] hover:border-[var(--d-accent)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                          >
                            <span className='block text-sm font-medium'>
                              {item.name}
                            </span>
                            <span className='block text-[11px] text-[var(--d-muted)] mt-0.5'>
                              {item.duration} мин · {RUB(item.price)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Step 1 — master */}
                {state.step === 1 && service && (
                  <div>
                    <h2 className='text-sm font-bold mb-1'>Выберите мастера</h2>
                    <p className='text-xs text-[var(--d-muted)] mb-3'>
                      Показаны мастера, которые выполняют «{service.name}».
                    </p>
                    <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                      {availableMasters(state).map((person) => (
                        <li key={person.id}>
                          <button
                            type='button'
                            onClick={() =>
                              dispatch({ type: 'chooseMaster', masterId: person.id })
                            }
                            style={{ borderRadius: 'var(--d-radius)' }}
                            className={
                              'w-full text-left p-3 border bg-[var(--d-surface)] flex items-center gap-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                              (state.masterId === person.id
                                ? 'border-[var(--d-accent)]'
                                : 'border-[var(--d-border)] hover:border-[var(--d-accent)]')
                            }
                          >
                            <DemoAvatar name={person.name} size={36} />
                            <span className='min-w-0'>
                              <span className='block text-sm font-medium'>
                                {person.name}
                              </span>
                              <span className='block text-[11px] text-[var(--d-muted)]'>
                                {person.title}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Step 2 — date and time */}
                {state.step === 2 && master && (
                  <div>
                    <h2 className='text-sm font-bold mb-3 flex items-center gap-2'>
                      <Calendar size={14} aria-hidden='true' />
                      Дата и время · {master.name}
                    </h2>

                    <div
                      className='flex gap-1.5 overflow-x-auto pb-2'
                      role='group'
                      aria-label='Дата'
                    >
                      {days.map((day) => (
                        <button
                          key={day.offset}
                          type='button'
                          disabled={!day.open}
                          onClick={() =>
                            dispatch({ type: 'chooseDay', dayOffset: day.offset })
                          }
                          aria-pressed={state.dayOffset === day.offset}
                          style={{ borderRadius: 'var(--d-radius)' }}
                          className={
                            'shrink-0 px-3 min-h-11 text-xs border transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                            (state.dayOffset === day.offset
                              ? 'border-[var(--d-accent)] bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
                              : 'border-[var(--d-border)] bg-[var(--d-surface)]')
                          }
                        >
                          {dayLabel(day.date, 'ru-RU')}
                          {!day.open && (
                            <span className='block text-[10px]'>выходной</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {state.dayOffset !== null && (
                      <div
                        className='flex flex-wrap gap-1.5 mt-3'
                        role='group'
                        aria-label='Время'
                      >
                        {slots.map((slot) => (
                          <button
                            key={slot.time}
                            type='button'
                            disabled={!slot.available}
                            onClick={() =>
                              dispatch({ type: 'chooseTime', time: slot.time })
                            }
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
                    )}

                    <DemoStatus tone='error' className='mt-3'>
                      {state.failure}
                    </DemoStatus>
                  </div>
                )}

                {/* Step 3 — contact details */}
                {state.step === 3 && (
                  <form
                    className='flex flex-col gap-3 max-w-sm'
                    action={() => void confirm()}
                  >
                    <h2 className='text-sm font-bold'>Ваши контакты</h2>
                    <DemoInput label='Имя' autoComplete='off' {...field('name')} />
                    <DemoInput
                      label='Телефон'
                      inputMode='tel'
                      placeholder='+7 999 123-45-67'
                      autoComplete='off'
                      {...field('phone')}
                    />
                    <DemoTextarea
                      label='Комментарий'
                      rows={2}
                      {...field('comment')}
                    />

                    <DemoStatus tone='error'>{state.failure}</DemoStatus>

                    <DemoButton type='submit' pending={state.submitting} block>
                      {state.submitting ? 'Отправляем…' : 'Подтвердить запись'}
                    </DemoButton>
                  </form>
                )}

                {/* Summary and navigation */}
                <div className='flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--d-border)]'>
                  {state.step > 0 && (
                    <DemoButton
                      variant='ghost'
                      size='sm'
                      icon={<ArrowLeft size={13} aria-hidden='true' />}
                      onClick={() =>
                        dispatch({ type: 'setStep', step: (state.step - 1) as Step })
                      }
                    >
                      Назад
                    </DemoButton>
                  )}

                  <p className='text-[11px] text-[var(--d-muted)] flex items-center gap-1.5 flex-1 min-w-0'>
                    <Scissors size={11} aria-hidden='true' className='shrink-0' />
                    <span className='truncate'>
                      {service ? service.name : 'Услуга не выбрана'}
                      {master ? ` · ${master.name}` : ''}
                      {state.time ? ` · ${state.time}` : ''}
                    </span>
                  </p>

                  {state.step < 3 && (
                    <DemoButton
                      size='sm'
                      disabled={!canAdvance(state)}
                      onClick={() =>
                        dispatch({ type: 'setStep', step: (state.step + 1) as Step })
                      }
                    >
                      Далее
                    </DemoButton>
                  )}
                </div>
              </div>
            </div>
          )}
        </DemoTabPanel>
      </div>
    </div>
  );
}
