import { useEffect, useState } from 'react';
import type { DayAvailability, SpecialistSelection } from '../../types';
import { toIsoDate } from '../../lib/format';
import { availabilityApi } from './api';
import { subscribeToSchedule } from './schedule';

export interface AvailabilityState {
  days: DayAvailability[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads a rolling window of availability.
 *
 * Requests are keyed by service + specialist + window, and a stale response is
 * discarded rather than rendered — switching specialists quickly must not make
 * the calendar flicker between two people's schedules.
 *
 * The window also reloads whenever the appointment book changes, including from
 * another tab: a slot taken in one tab must stop being on offer in the other.
 */
export function useAvailability(
  serviceId: string | null,
  specialist: SpecialistSelection,
  days = 14,
): AvailabilityState {
  const [state, setState] = useState<AvailabilityState>({
    days: [],
    loading: Boolean(serviceId),
    error: null,
  });

  // With no service chosen there is nothing to show, and that is knowable
  // during render — going through an effect meant the calendar kept the
  // previous service's days on screen for a frame after the service was
  // cleared, which reads as the picker briefly offering the wrong thing.
  const [lastService, setLastService] = useState(serviceId);
  if (lastService !== serviceId) {
    setLastService(serviceId);
    if (!serviceId) setState({ days: [], loading: false, error: null });
  }

  useEffect(() => {
    if (!serviceId) return;

    let active = true;

    const load = () => {
      if (!active) return;
      // The already-rendered calendar stays put; only the first load shows a
      // skeleton, so a booking in another tab does not blank the picker.
      setState((previous) => ({ ...previous, loading: true, error: null }));

      availabilityApi
        .getAvailability({ serviceId, specialist, from: toIsoDate(new Date()), days })
        .then((result) => {
          if (active) setState({ days: result, loading: false, error: null });
        })
        .catch(() => {
          if (active) {
            setState({
              days: [],
              loading: false,
              error: 'Не удалось загрузить свободное время. Попробуйте обновить страницу.',
            });
          }
        });
    };

    load();
    const unsubscribe = subscribeToSchedule(load);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [serviceId, specialist, days]);

  return state;
}
