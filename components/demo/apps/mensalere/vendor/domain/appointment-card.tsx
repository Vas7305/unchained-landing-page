import { Link } from '../router';
import { Card, CardBody, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { StatusBadge } from './status-badge';
import type { Appointment } from '../services/types';
import { videoService } from '../services/videoService';
import { formatDate, formatTime, relativeTime } from '../lib/date';
import { formatDuration, formatPrice } from '../lib/format';
import { cn } from '../lib/cn';

/**
 * §43 — professional, service, date, time, duration, modality, status, then the
 * action. "Enter consultation" replaces "View appointment" as the primary
 * action once the room is open (§43, §73).
 *
 * The facts are set as typography rather than as a row of icons: an appointment
 * card is read, not decoded, and three icons here were decoration.
 */
export function AppointmentCard({
  appointment,
  /** Which name to lead with: patients see the professional and vice versa. */
  perspective = 'patient',
  detailPath,
  consultationPath,
  className,
}: {
  appointment: Appointment;
  perspective?: 'patient' | 'professional';
  detailPath: string;
  consultationPath?: string;
  className?: string;
}) {
  const canJoin = Boolean(consultationPath) && videoService.canJoin(appointment);
  const counterpart =
    perspective === 'patient' ? appointment.psychologistName : appointment.patientName;
  const countdown = relativeTime(appointment.start);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-ms-body-lg text-ms-text font-medium">{counterpart}</p>
            <p className="text-ms-small text-ms-muted">{appointment.serviceName}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <dl className="text-ms-small flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex gap-2">
            <dt className="text-ms-muted">Date</dt>
            <dd className="text-ms-text">{formatDate(appointment.start)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ms-muted">Time</dt>
            <dd className="text-ms-text">
              {formatTime(appointment.start)} &middot; {formatDuration(appointment.durationMinutes)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ms-muted">Modality</dt>
            <dd className="text-ms-text">
              {appointment.modality === 'video' ? 'Video consultation' : 'Written consultation'}
            </dd>
          </div>
        </dl>

        {countdown && appointment.status === 'confirmed' && (
          <p className="text-ms-small text-ms-muted">Starts {countdown}</p>
        )}
      </CardBody>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ms-small text-ms-muted">{formatPrice(appointment.priceCents)}</p>
        <div className="flex flex-wrap gap-3">
          {canJoin && consultationPath ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link to={detailPath}>View appointment</Link>
              </Button>
              <Button asChild size="sm">
                <Link to={consultationPath}>Enter consultation</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link to={detailPath}>View appointment</Link>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
