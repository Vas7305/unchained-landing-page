import { addDays, addMinutes, startOfDay } from '../../lib/date';
import type { Appointment, Message, MessageThread, User } from '../types';
import { PSYCHOLOGISTS } from './catalog';

/**
 * In-memory mock backend (§59, §85).
 *
 * This module is the ONLY place that holds mutable application state during the
 * prototype. It stands in for PostgreSQL and is replaced wholesale when Supabase
 * is introduced; nothing above the service layer imports it.
 *
 * It is not a security boundary. Every rule enforced here is a UX affordance and
 * must be re-implemented server-side before any real data exists (§15, §18 of the
 * implementation brief).
 */

export const DEMO_PASSWORD = 'mensalere';

export const DEMO_USERS: Array<User & { password: string }> = [
  {
    id: 'patient-1',
    role: 'patient',
    name: 'Maya Novak',
    email: 'patient@mensalere.test',
    password: DEMO_PASSWORD,
  },
  {
    id: 'professional-1',
    role: 'professional',
    name: 'Ana Ferreira',
    email: 'professional@mensalere.test',
    psychologistId: 'ana-ferreira',
    password: DEMO_PASSWORD,
  },
  {
    id: 'admin-1',
    role: 'admin',
    name: 'Platform Admin',
    email: 'admin@mensalere.test',
    password: DEMO_PASSWORD,
  },
];

/** Additional fictional patients so professional and admin views are not empty. */
const EXTRA_PATIENTS: User[] = [
  {
    id: 'patient-2',
    role: 'patient',
    name: 'Jonas Weber',
    email: 'jonas@example.test',
  },
  {
    id: 'patient-3',
    role: 'patient',
    name: 'Ines Duarte',
    email: 'ines@example.test',
  },
  {
    id: 'patient-4',
    role: 'patient',
    name: 'Owen Clarke',
    email: 'owen@example.test',
  },
];

interface Store {
  users: User[];
  appointments: Appointment[];
  threads: MessageThread[];
  messages: Message[];
}

/** A time today at HH:mm, or on a day offset from today. */
function at(dayOffset: number, hour: number, minute = 0): string {
  const day = startOfDay(addDays(new Date(), dayOffset));
  return addMinutes(day, hour * 60 + minute).toISOString();
}

function seedAppointments(): Appointment[] {
  const ana = PSYCHOLOGISTS.find((p) => p.id === 'ana-ferreira');
  const daniel = PSYCHOLOGISTS.find((p) => p.id === 'daniel-okafor');
  if (!ana || !daniel) throw new Error('Seed catalogue is inconsistent.');

  const initial = ana.services[0];
  const followUp = ana.services[1];
  const danielInitial = daniel.services[0];
  if (!initial || !followUp || !danielInitial) throw new Error('Seed catalogue is inconsistent.');

  return [
    {
      id: 'apt-1001',
      patientId: 'patient-1',
      patientName: 'Maya Novak',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: followUp.id,
      serviceName: followUp.name,
      start: at(1, 17, 30),
      durationMinutes: followUp.durationMinutes,
      modality: 'video',
      priceCents: followUp.priceCents,
      status: 'confirmed',
    },
    {
      id: 'apt-1002',
      patientId: 'patient-1',
      patientName: 'Maya Novak',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: followUp.id,
      serviceName: followUp.name,
      start: at(9, 17, 30),
      durationMinutes: followUp.durationMinutes,
      modality: 'video',
      priceCents: followUp.priceCents,
      status: 'confirmed',
    },
    {
      id: 'apt-1003',
      patientId: 'patient-1',
      patientName: 'Maya Novak',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: initial.id,
      serviceName: initial.name,
      start: at(-13, 17, 30),
      durationMinutes: initial.durationMinutes,
      modality: 'video',
      priceCents: initial.priceCents,
      status: 'completed',
    },
    {
      id: 'apt-1004',
      patientId: 'patient-1',
      patientName: 'Maya Novak',
      psychologistId: daniel.id,
      psychologistName: daniel.name,
      serviceId: danielInitial.id,
      serviceName: danielInitial.name,
      start: at(-27, 10, 0),
      durationMinutes: danielInitial.durationMinutes,
      modality: 'video',
      priceCents: danielInitial.priceCents,
      status: 'cancelled',
    },
    {
      id: 'apt-2001',
      patientId: 'patient-2',
      patientName: 'Jonas Weber',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: initial.id,
      serviceName: initial.name,
      start: at(0, 9, 0),
      durationMinutes: initial.durationMinutes,
      modality: 'video',
      priceCents: initial.priceCents,
      status: 'completed',
    },
    {
      id: 'apt-2002',
      patientId: 'patient-3',
      patientName: 'Ines Duarte',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: followUp.id,
      serviceName: followUp.name,
      start: at(0, 15, 0),
      durationMinutes: followUp.durationMinutes,
      modality: 'video',
      priceCents: followUp.priceCents,
      status: 'confirmed',
    },
    {
      id: 'apt-2003',
      patientId: 'patient-4',
      patientName: 'Owen Clarke',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: initial.id,
      serviceName: initial.name,
      start: at(2, 11, 0),
      durationMinutes: initial.durationMinutes,
      modality: 'video',
      priceCents: initial.priceCents,
      status: 'pending_payment',
    },
    {
      id: 'apt-2004',
      patientId: 'patient-2',
      patientName: 'Jonas Weber',
      psychologistId: ana.id,
      psychologistName: ana.name,
      serviceId: followUp.id,
      serviceName: followUp.name,
      start: at(-7, 9, 0),
      durationMinutes: followUp.durationMinutes,
      modality: 'video',
      priceCents: followUp.priceCents,
      status: 'no_show',
    },
  ];
}

function seedThreads(): MessageThread[] {
  return [
    {
      id: 'thread-1',
      patientId: 'patient-1',
      patientName: 'Maya Novak',
      psychologistId: 'ana-ferreira',
      psychologistName: 'Ana Ferreira',
      lastMessageAt: at(0, 8, 12),
      lastMessagePreview: 'That works. See you then.',
      unreadCount: 1,
    },
    {
      id: 'thread-2',
      patientId: 'patient-3',
      patientName: 'Ines Duarte',
      psychologistId: 'ana-ferreira',
      psychologistName: 'Ana Ferreira',
      lastMessageAt: at(-1, 19, 40),
      lastMessagePreview: 'Thank you for the note before our session.',
      unreadCount: 0,
    },
  ];
}

function seedMessages(): Message[] {
  return [
    {
      id: 'msg-1',
      threadId: 'thread-1',
      authorId: 'patient-1',
      authorName: 'Maya Novak',
      body: 'Hello. Would it be possible to move our next session slightly later in the day?',
      sentAt: at(-1, 20, 5),
      readAt: at(-1, 20, 40),
    },
    {
      id: 'msg-2',
      threadId: 'thread-1',
      authorId: 'ana-ferreira',
      authorName: 'Ana Ferreira',
      body: 'Of course. I have 17:30 free on the same day, if that suits you better.',
      sentAt: at(0, 8, 10),
      readAt: null,
    },
    {
      id: 'msg-3',
      threadId: 'thread-1',
      authorId: 'ana-ferreira',
      authorName: 'Ana Ferreira',
      body: 'That works. See you then.',
      sentAt: at(0, 8, 12),
      readAt: null,
    },
    {
      id: 'msg-4',
      threadId: 'thread-2',
      authorId: 'patient-3',
      authorName: 'Ines Duarte',
      body: 'Thank you for the note before our session.',
      sentAt: at(-1, 19, 40),
      readAt: at(-1, 19, 55),
    },
  ];
}

function createStore(): Store {
  return {
    users: [...DEMO_USERS.map(({ password: _password, ...user }) => user), ...EXTRA_PATIENTS],
    appointments: seedAppointments(),
    threads: seedThreads(),
    messages: seedMessages(),
  };
}

export const store: Store = createStore();

/** Test helper: restore the store to its seeded state. */
export function resetStore(): void {
  const fresh = createStore();
  store.users = fresh.users;
  store.appointments = fresh.appointments;
  store.threads = fresh.threads;
  store.messages = fresh.messages;
}

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/**
 * Simulated round-trip so loading and skeleton states (§51) are exercised during
 * development instead of only in production.
 */
export function latency<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}
