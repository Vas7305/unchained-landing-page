import { addMinutes, toDate } from '../lib/date';
import type { Appointment, VideoSession } from './types';
import { ServiceError } from './types';
import { latency, store } from './mock/store';

/**
 * Video boundary (§45, §86).
 *
 * MENSALERE uses Daily as infrastructure in production. The provider stays
 * behind this interface: the UI receives an opaque room token and never learns
 * which vendor issued it, so the provider can be replaced without touching the
 * appointment or consultation screens.
 */

/** How early a patient may enter the consultation room. */
export const JOIN_WINDOW_MINUTES = 10;

export interface VideoService {
  canJoin(appointment: Appointment, now?: Date): boolean;
  join(appointmentId: string): Promise<VideoSession>;
  leave(appointmentId: string): Promise<void>;
}

export const videoService: VideoService = {
  canJoin(appointment, now = new Date()) {
    if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') return false;

    const opens = addMinutes(appointment.start, -JOIN_WINDOW_MINUTES);
    const closes = addMinutes(appointment.start, appointment.durationMinutes);
    return now >= opens && now <= closes;
  },

  async join(appointmentId) {
    const appointment = store.appointments.find((item) => item.id === appointmentId);
    if (!appointment) {
      throw new ServiceError('We could not find that appointment.', 'not_found');
    }

    if (!videoService.canJoin(appointment)) {
      throw new ServiceError(
        'This consultation room is not open yet. You can join shortly before the start time.',
        'room_closed',
      );
    }

    if (appointment.status === 'confirmed') {
      appointment.status = 'in_progress';
    }

    const expiresAt = addMinutes(
      toDate(appointment.start),
      appointment.durationMinutes + JOIN_WINDOW_MINUTES,
    ).toISOString();

    return latency({ appointmentId, roomToken: `mock-room-${appointmentId}`, expiresAt }, 600);
  },

  async leave(appointmentId) {
    const appointment = store.appointments.find((item) => item.id === appointmentId);
    if (appointment?.status === 'in_progress') {
      appointment.status = 'completed';
    }
    await latency(null, 200);
  },
};
