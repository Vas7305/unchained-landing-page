import type { AppointmentStatus } from '../services/types';

/** §40 — the canonical states and their exact labels. No synonyms. */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  held: 'Held',
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  expired: 'Expired',
};

export type StatusTone = 'neutral' | 'accent' | 'outline' | 'error' | 'warning';

export const STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  held: 'warning',
  pending_payment: 'warning',
  confirmed: 'accent',
  in_progress: 'accent',
  completed: 'neutral',
  cancelled: 'outline',
  no_show: 'outline',
  expired: 'outline',
};

export function statusLabel(status: AppointmentStatus): string {
  return STATUS_LABELS[status];
}
