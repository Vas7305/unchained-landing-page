'use client';

import {
  useEffect,
  useReducer,
  useState,
  type Dispatch,
} from 'react';

import type { DemoAppProps } from '@/lib/demo/types';
import {
  activeFilterCount,
  canBook,
  createInitialState,
  reducer,
  type Action,
  type State,
} from '@/lib/demo/apps/mensalere/state';

import { Wordmark } from './vendor/brand/wordmark';
import { AvailabilityCalendar } from './vendor/domain/availability-calendar';
import { FictionalDataNotice } from './vendor/domain/fictional-data-notice';
import { PsychologistCard } from './vendor/domain/psychologist-card';
import { VerifiedMark } from './vendor/domain/verified-mark';
import {
  availabilityService,
  type DayAvailability,
} from './vendor/services/availabilityService';
import { CATEGORY_LABELS } from './vendor/services/mock/catalog';
import { psychologistService } from './vendor/services/psychologistService';
import type { AvailabilitySlot, Psychologist } from './vendor/services/types';
import { Button } from './vendor/ui/button';
import { Card, CardBody } from './vendor/ui/card';
import { Input } from './vendor/ui/input';
import { Portrait } from './vendor/ui/portrait';
import { setDemoNavigate } from './vendor/router-bridge';

/**
 * One component per screen, so the shell is only wiring.
 *
 * The shell holds three async reads and the branch between them; keeping the
 * two screens' markup in the same function made a control-flow knot out of
 * what is really "a list, or one professional".
 */
function ProfileScreen({
  state,
  dispatch,
  profile,
  days,
  loadingDays,
  slots,
  month,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  profile: Psychologist;
  days: DayAvailability[];
  loadingDays: boolean;
  slots: AvailabilitySlot[];
  month: Date;
}) {
  return (
        /* ── Profile and diary ─────────────────────────────────────── */
        <div className='mt-6'>
          <Button
            variant='ghost'
            onClick={() => dispatch({ type: 'closeProfile' })}
          >
            ← Back to the directory
          </Button>

          <div className='mt-4 flex gap-5'>
            {/* The product's own portrait: it draws a monogram when there
                is no photograph, which is the case for every professional in
                the mock catalogue — the application refuses to stand a stock
                or generated face in for a real clinician. */}
            <Portrait
              name={profile.name}
              src={profile.photoUrl}
              ratio='square'
              className='w-28 shrink-0'
            />
            <div>
              <h1 className='text-ms-body-lg flex items-center gap-2 font-semibold'>
                {profile.name}
                {profile.verified ? <VerifiedMark /> : null}
              </h1>
              <p className='text-ms-muted text-ms-small'>{profile.title}</p>
              <p className='text-ms-small mt-2'>{profile.headline}</p>
              <p className='text-ms-muted text-ms-caption mt-2'>
                {profile.specialties
                  .map((id) => CATEGORY_LABELS[id])
                  .join(' · ')}
              </p>
            </div>
          </div>

          <div className='mt-6 grid gap-5 md:grid-cols-2'>
            <AvailabilityCalendar
              days={days}
              isLoading={loadingDays}
              selected={state.selectedDate}
              onSelect={(date) => dispatch({ type: 'selectDate', date })}
              month={month}
              onMonthChange={() => {}}
            />

            <Card>
              <CardBody>
                <h2 className='text-ms-small font-semibold'>Available times</h2>

                {state.selectedDate ? (
                  <ul className='mt-3 flex flex-wrap gap-2'>
                    {/* One pass: a day can hold a dozen slots and most are
                        taken, so selecting and rendering together avoids
                        building an intermediate array on every render. */}
                    {slots.flatMap((slot) =>
                      slot.available ? (
                        <li key={slot.start}>
                          <Button
                            variant={
                              state.selectedSlotId === slot.start
                                ? 'primary'
                                : 'secondary'
                            }
                            size='sm'
                            onClick={() =>
                              dispatch({
                                type: 'selectSlot',
                                slotId: slot.start,
                              })
                            }
                          >
                            {SLOT_TIME.format(new Date(slot.start))}
                          </Button>
                        </li>
                      ) : (
                        []
                      ),
                    )}
                  </ul>
                ) : (
                  <p className='text-ms-muted text-ms-caption mt-3'>
                    Choose a day to see its times.
                  </p>
                )}

                {state.bookedRef ? (
                  <p className='text-ms-primary-strong text-ms-small mt-4 font-medium'>
                    Appointment held — reference {state.bookedRef}.
                  </p>
                ) : (
                  <Button
                    className='mt-4'
                    disabled={!canBook(state)}
                    onClick={() =>
                      dispatch({
                        type: 'booked',
                        reference: `MS-${String(slots.length * 37 + 100).padStart(4, '0')}`,
                      })
                    }
                  >
                    Hold this appointment
                  </Button>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
  );
}

function DirectoryScreen({
  state,
  dispatch,
  results,
  listing,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  results: Psychologist[];
  listing: boolean;
}) {
  return (
        /* ── Directory ─────────────────────────────────────────────── */
        <div className='mt-6'>
          <h1 className='text-ms-body-lg font-semibold'>
            Find the right professional
          </h1>

          <div className='mt-4 flex flex-wrap items-end gap-3'>
            <Input
              aria-label='Search by name, focus or specialty'
              placeholder='Search by name, focus or specialty'
              value={state.filters.query ?? ''}
              onChange={(event) =>
                dispatch({
                  type: 'filter',
                  filters: { query: event.target.value },
                })
              }
              className='min-w-64 flex-1'
            />
            {activeFilterCount(state) > 0 ? (
              <Button
                variant='ghost'
                onClick={() => dispatch({ type: 'clearFilters' })}
              >
                Clear filters
              </Button>
            ) : null}
          </div>

          <p className='text-ms-muted text-ms-caption mt-3' role='status'>
            {listing
              ? 'Searching…'
              : `${results.length} ${results.length === 1 ? 'professional' : 'professionals'}`}
          </p>

          <ul className='mt-4 grid gap-4 md:grid-cols-2'>
            {results.map((psychologist) => (
              <li key={psychologist.id}>
                <PsychologistCard psychologist={psychologist} />
              </li>
            ))}
          </ul>
        </div>
  );
}

/**
 * One formatter, built once.
 *
 * Constructing an `Intl.DateTimeFormat` per slot per render is the expensive
 * part of `toLocaleTimeString`, and a day can hold a dozen slots. The timezone
 * is fixed too: the product's diary is in local wall-clock time, and letting
 * the runtime pick would make the same slot read differently depending on where
 * the page is rendered.
 */
const SLOT_TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * Mensalere — the product's own frontend, running on the product's own mock
 * service layer.
 *
 * ─── What is the product's, and what is the demo's ────────────────────────
 * The cards, the calendar, the portraits, the buttons, the inputs, the
 * verified mark, the fictional-data notice and the whole UI kit under
 * `vendor/` are the application's files, copied from its repository. So is
 * every service behind them: `psychologistService.list()` and
 * `availabilityService.getDays()` are the product's, reading the product's
 * `services/mock/` store with the product's own simulated latency.
 *
 * That mock layer is why this demo needed almost no isolation work. The
 * application is already frontend-only — no fetch, no environment, no
 * database anywhere in `services/` or `lib/` — so §12's "Frontend → Adapter →
 * Mock Repository → Local Data" was already how it was built.
 *
 * The demo supplies three things:
 *   1. Namespaced design tokens. The product and this site both define
 *      `--color-primary` and `--radius-md` with different values, so every
 *      token was prefixed `ms-` in app/globals.css and the same prefix applied
 *      to the vendored class names. Without that, opening this demo would
 *      restyle the whole website.
 *   2. A router adapter (`vendor/router.tsx`). The product is a react-router
 *      SPA; a real navigation here would leave the site.
 *   3. The selection the product keeps in its URL — see lib/demo/apps/
 *      mensalere/state.ts.
 */
export default function MensalereDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  /**
   * Each async read is stored WITH the request it answers, and "loading" is
   * derived by comparing that key to what is being asked for now.
   *
   * The obvious shape — a `loading` flag set at the top of the effect — sets
   * state synchronously during an effect and costs a second render pass on
   * every keystroke in the search field. Keying the result instead means one
   * state write per answer and no flag to keep in step with it.
   */
  const [listed, setListed] = useState<{
    key: string;
    items: Psychologist[];
  } | null>(null);
  const [loaded, setLoaded] = useState<{
    id: string;
    profile: Psychologist;
    days: DayAvailability[];
  } | null>(null);
  const [slotted, setSlotted] = useState<{
    key: string;
    slots: AvailabilitySlot[];
  } | null>(null);
  const [month] = useState(() => new Date());

  const filterKey = JSON.stringify(state.filters);
  const slotKey = `${state.selectedId ?? ''}|${state.selectedDate ?? ''}`;

  const results = listed?.key === filterKey ? listed.items : [];
  const listing = listed?.key !== filterKey;
  const profile = loaded?.id === state.selectedId ? loaded.profile : null;
  const days = loaded?.id === state.selectedId ? loaded.days : [];
  const loadingDays = state.selectedId !== null && loaded?.id !== state.selectedId;
  const slots = slotted?.key === slotKey ? slotted.slots : [];

  // Link activations inside vendored components report here instead of routing.
  useEffect(() => {
    setDemoNavigate((to) => {
      const id = to.split('/').filter(Boolean).pop();
      if (id) dispatch({ type: 'openProfile', id });
    });
  }, []);

  // The product's own directory service, with the product's own filters.
  useEffect(() => {
    let live = true;
    const key = filterKey;

    void psychologistService.list(JSON.parse(key)).then((found) => {
      if (live) setListed({ key, items: found });
    });

    return () => {
      live = false;
    };
  }, [filterKey]);

  useEffect(() => {
    const id = state.selectedId;
    if (!id) return;

    let live = true;

    void Promise.all([
      psychologistService.get(id),
      availabilityService.getDays(id, new Date(), 35),
    ]).then(([found, availability]) => {
      if (live) setLoaded({ id, profile: found, days: availability });
    });

    return () => {
      live = false;
    };
  }, [state.selectedId]);

  useEffect(() => {
    const id = state.selectedId;
    const date = state.selectedDate;
    if (!id || !date) return;

    let live = true;
    const key = slotKey;

    void availabilityService.getSlots(id, date, 50).then((found) => {
      if (live) setSlotted({ key, slots: found });
    });

    return () => {
      live = false;
    };
  }, [slotKey, state.selectedId, state.selectedDate]);

  return (
    <div className='bg-ms-background text-ms-text font-ms-sans h-full overflow-y-auto'>
      <header className='border-ms-border bg-ms-surface border-b px-6 py-4'>
        <Wordmark />
      </header>

      <div className='mx-auto max-w-5xl px-6 py-6'>
        <FictionalDataNotice />

        {profile ? (
          <ProfileScreen
            state={state}
            dispatch={dispatch}
            profile={profile}
            days={days}
            loadingDays={loadingDays}
            slots={slots}
            month={month}
          />
        ) : (
          <DirectoryScreen
            state={state}
            dispatch={dispatch}
            results={results}
            listing={listing}
          />
        )}
      </div>
    </div>
  );
}
