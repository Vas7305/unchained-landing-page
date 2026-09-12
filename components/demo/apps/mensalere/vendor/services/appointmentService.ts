import { addMinutes, isPast } from '../lib/date';
import type { Appointment, AppointmentStatus, BookingDraft, User } from './types';
import { ServiceError } from './types';
import { findPsychologist } from './mock/catalog';
import { latency, nextId, store } from './mock/store';

/**
 * Appointment boundary (§86).
 *
 * State transitions follow the canonical set in §40:
 *
 *   held -> pending_payment -> confirmed -> in_progress -> completed
 *   held | pending_payment -> expired
 *   confirmed -> cancelled | no_show
 *
 * The ownership checks below mirror the authorisation rules a real backend must
 * enforce. They are duplicated here so the prototype behaves correctly, not
 * because client-side checks are sufficient.
 */

const ACTIVE_STATUSES: AppointmentStatus[] = [
  'held',
  'pending_payment',
  'confirmed',
  'in_progress',
];

export interface AppointmentService {
  listForPatient(patientId: string): Promise<Appointment[]>;
  listForPsychologist(psychologistId: string): Promise<Appointment[]>;
  listAll(): Promise<Appointment[]>;
  get(id: string, viewer: User): Promise<Appointment>;
  hold(draft: BookingDraft, patient: User): Promise<Appointment>;
  confirm(id: string): Promise<Appointment>;
  cancel(id: string, viewer: User): Promise<Appointment>;
  markCompleted(id: string, viewer: User): Promise<Appointment>;
}

function byStartAscending(a: Appointment, b: Appointment): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function requireAppointment(id: string): Appointment {
  const appointment = store.appointments.find((item) => item.id === id);
  if (!appointment) {
    throw new ServiceError('We could not find that appointment.', 'not_found');
  }
  return appointment;
}

/** Mirrors the row-level rule: a viewer sees only their own appointments. */
function assertCanView(appointment: Appointment, viewer: User): void {
  const allowed =
    viewer.role === 'admin' ||
    (viewer.role === 'patient' && appointment.patientId === viewer.id) ||
    (viewer.role === 'professional' && appointment.psychologistId === viewer.psychologistId);

  if (!allowed) {
    throw new ServiceError('You do not have access to that appointment.', 'forbidden');
  }
}

export function isUpcoming(appointment: Appointment): boolean {
  return (
    ACTIVE_STATUSES.includes(appointment.status) &&
    !isPast(addMinutes(appointment.start, appointment.durationMinutes))
  );
}

export function isPastAppointment(appointment: Appointment): boolean {
  return !isUpcoming(appointment);
}

export const appointmentService: AppointmentService = {
  async listForPatient(patientId) {
    const results = store.appointments
      .filter((appointment) => appointment.patientId === patientId)
      .sort(byStartAscending);
    return latency(results);
  },

  async listForPsychologist(psychologistId) {
    const results = store.appointments
      .filter((appointment) => appointment.psychologistId === psychologistId)
      .sort(byStartAscending);
    return latency(results);
  },

  async listAll() {
    return latency([...store.appointments].sort(byStartAscending));
  },

  async get(id, viewer) {
    const appointment = requireAppointment(id);
    assertCanView(appointment, viewer);
    return latency(appointment);
  },

  async hold(draft, patient) {
    const psychologist = findPsychologist(draft.psychologistId);
    if (!psychologist) {
      throw new ServiceError('We could not find that professional.', 'not_found');
    }

    const service = psychologist.services.find((item) => item.id === draft.serviceId);
    if (!service) {
      throw new ServiceError('That service is no longer offered.', 'service_unavailable');
    }

    if (isPast(draft.start)) {
      throw new ServiceError('That time has already passed. Please choose another.', 'slot_past');
    }

    const clash = store.appointments.some(
      (appointment) =>
        appointment.psychologistId === draft.psychologistId &&
        ACTIVE_STATUSES.includes(appointment.status) &&
        appointment.start === draft.start,
    );
    if (clash) {
      throw new ServiceError('That time was just taken. Please choose another.', 'slot_taken');
    }

    const appointment: Appointment = {
      id: nextId('apt'),
      patientId: patient.id,
      patientName: patient.name,
      psychologistId: psychologist.id,
      psychologistName: psychologist.name,
      serviceId: service.id,
      serviceName: service.name,
      start: draft.start,
      durationMinutes: service.durationMinutes,
      modality: draft.modality,
      priceCents: service.priceCents,
      status: 'held',
      ...(draft.note ? { note: draft.note } : {}),
    };

    store.appointments.push(appointment);
    return latency(appointment, 380);
  },

  async confirm(id) {
    const appointment = requireAppointment(id);
    if (appointment.status !== 'held' && appointment.status !== 'pending_payment') {
      throw new ServiceError('This appointment can no longer be confirmed.', 'invalid_transition');
    }
    appointment.status = 'confirmed';
    return latency(appointment);
  },

  async cancel(id, viewer) {
    const appointment = requireAppointment(id);
    assertCanView(appointment, viewer);

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw new ServiceError('This appointment can no longer be cancelled.', 'invalid_transition');
    }

    appointment.status = 'cancelled';
    return latency(appointment, 380);
  },

  async markCompleted(id, viewer) {
    const appointment = requireAppointment(id);
    assertCanView(appointment, viewer);

    if (appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
      throw new ServiceError('This appointment cannot be completed.', 'invalid_transition');
    }

    appointment.status = 'completed';
    return latency(appointment);
  },
};
