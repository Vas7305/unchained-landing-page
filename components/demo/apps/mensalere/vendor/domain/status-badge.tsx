import { Badge } from '../ui/badge';
import { STATUS_LABELS, STATUS_TONES } from '../lib/appointment-status';
import type { AppointmentStatus } from '../services/types';

/**
 * §40 canonical states, §39 — status is always conveyed in words, never by
 * colour alone.
 */
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
