import { AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { userFacingMessage } from '../lib/errors';

/**
 * §50 empty states, §51 loading states, §52 error states.
 * All three share the visual system so a screen never changes character
 * depending on whether it has data.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-ms-border flex flex-col items-center gap-4 rounded-[12px] border border-dashed',
        'bg-ms-surface px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="bg-ms-primary-soft inline-flex h-11 w-11 items-center justify-center rounded-full">
          <Icon aria-hidden className="text-ms-primary h-5 w-5" />
        </span>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-ms-body-lg text-ms-text font-medium">{title}</p>
        {description && <p className="text-ms-body text-ms-muted mx-auto max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'We could not load this',
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border-ms-border bg-ms-surface flex flex-col items-start gap-4 rounded-[12px] border p-6',
        className,
      )}
    >
      <span className="bg-ms-error-soft inline-flex h-11 w-11 items-center justify-center rounded-full">
        <AlertTriangle aria-hidden className="text-ms-error-strong h-5 w-5" />
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-ms-body-lg text-ms-text font-medium">{title}</p>
        <p className="text-ms-body text-ms-muted max-w-md">{userFacingMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Announced politely so screen-reader users know a region is still loading. */
export function LoadingState({
  label = 'Loading',
  children,
  className,
}: {
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border-ms-border bg-ms-surface rounded-[12px] border p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-1/2' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <LoadingState className="grid gap-5">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} lines={lines} />
      ))}
    </LoadingState>
  );
}
