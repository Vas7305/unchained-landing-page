import { cn } from '../lib/cn';

/**
 * Label/value pairs used by booking review, payment and appointment detail
 * (§38, §74). One component so those three screens cannot drift apart.
 */
export function SummaryList({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode; emphasis?: boolean }>;
  className?: string;
}) {
  return (
    <dl className={cn('flex flex-col', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'border-ms-border flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b py-3 last:border-b-0',
            item.emphasis && 'border-b-0 pt-4',
          )}
        >
          <dt className={cn('text-ms-small text-ms-muted', item.emphasis && 'text-ms-body text-ms-text')}>
            {item.label}
          </dt>
          <dd className={cn('text-ms-body text-ms-text', item.emphasis && 'text-ms-body-lg font-semibold')}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
