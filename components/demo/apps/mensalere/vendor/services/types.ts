/**
 * Domain types shared by every service implementation.
 *
 * The UI depends on these types only — never on a concrete backend. Swapping the
 * mock implementations for Supabase/Stripe/Daily (§85–§87) must not require any
 * change above this boundary.
 */

export type Role = 'patient' | 'professional' | 'admin';

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  avatarUrl?: string;
  /** Set for role === 'professional'; links the account to its public profile. */
  psychologistId?: string;
}

export interface Session {
  user: User;
  issuedAt: string;
}

/** §32 — the initial help categories. Ids are stable, labels are display-only. */
export type HelpCategoryId =
  | 'anxiety-stress'
  | 'relationships'
  | 'self-esteem'
  | 'grief-loss'
  | 'family'
  | 'work-burnout'
  | 'sexuality'
  | 'compulsive-behaviors'
  | 'adolescence'
  | 'other';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  description: string;
}

export type Modality = 'video' | 'chat';

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  /** Minor units (cents). Prices are never floats. */
  priceCents: number;
  modality: Modality;
}

export interface Psychologist {
  id: string;
  name: string;
  title: string;
  /** §27 — a subtle indicator, shown only when the platform has verified them. */
  verified: boolean;
  /** Absent in the MVP: no stock or AI-generated faces stand in for a person. */
  photoUrl?: string;
  /** §57 — mock imagery is clearly non-photographic, never an AI-generated face. */
  photoIsPlaceholder: boolean;
  headline: string;
  biography: string[];
  specialties: HelpCategoryId[];
  languages: string[];
  yearsOfExperience: number;
  services: Service[];
  /** Cheapest service, precomputed for list cards. */
  fromPriceCents: number;
  acceptingNewPatients: boolean;
}

export interface AvailabilitySlot {
  /** ISO start time. */
  start: string;
  durationMinutes: number;
  available: boolean;
}

/** §40 — canonical appointment states. Do not introduce synonyms. */
export type AppointmentStatus =
  | 'held'
  | 'pending_payment'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'expired';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  psychologistId: string;
  psychologistName: string;
  serviceId: string;
  serviceName: string;
  start: string;
  durationMinutes: number;
  modality: Modality;
  priceCents: number;
  status: AppointmentStatus;
  /** Patient-authored context, optional and never required to book. */
  note?: string;
}

export interface BookingDraft {
  psychologistId: string;
  serviceId: string;
  start: string;
  modality: Modality;
  note?: string;
}

export interface MessageThread {
  id: string;
  patientId: string;
  patientName: string;
  psychologistId: string;
  psychologistName: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  sentAt: string;
  readAt: string | null;
}

export type PaymentStatus = 'requires_payment' | 'succeeded' | 'failed';

export interface PaymentIntent {
  id: string;
  appointmentId: string;
  amountCents: number;
  status: PaymentStatus;
}

/** §45 — the video provider is infrastructure and stays behind this shape. */
export interface VideoSession {
  appointmentId: string;
  /** Opaque token; the concrete provider is not exposed to the UI. */
  roomToken: string;
  expiresAt: string;
}

/** §34 — preference-based routing only. Never a clinical instrument (§35). */
export interface QuestionnaireAnswers {
  concerns: HelpCategoryId[];
  supportType: 'first-time' | 'ongoing' | 'specific-issue' | 'unsure';
  professionalPreference: 'no-preference' | 'female' | 'male';
  modality: Modality | 'no-preference';
  availability: Array<'weekday-morning' | 'weekday-afternoon' | 'weekday-evening' | 'weekend'>;
  notes?: string;
}

/** A recoverable, user-facing failure. Technical detail stays in the log (§52). */
export class ServiceError extends Error {
  readonly code: string;

  constructor(message: string, code: string = 'service_error') {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}
