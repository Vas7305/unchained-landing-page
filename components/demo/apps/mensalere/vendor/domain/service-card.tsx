import { Card, CardBody } from '../ui/card';
import type { Service } from '../services/types';
import { formatDuration, formatPrice } from '../lib/format';

/** Read-only presentation of a service. Selection uses OptionRow in booking. */
export function ServiceCard({ service, className }: { service: Service; className?: string }) {
  return (
    <Card className={className}>
      <CardBody className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-ms-body-lg text-ms-text font-medium">{service.name}</h3>
          <p className="text-ms-body text-ms-text font-medium">{formatPrice(service.priceCents)}</p>
        </div>
        <p className="text-ms-body text-ms-muted">{service.description}</p>
        <p className="text-ms-small text-ms-muted">
          {formatDuration(service.durationMinutes)} &middot;{' '}
          {service.modality === 'video' ? 'Video consultation' : 'Written consultation'}
        </p>
      </CardBody>
    </Card>
  );
}
