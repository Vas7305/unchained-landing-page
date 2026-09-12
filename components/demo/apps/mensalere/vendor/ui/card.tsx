import { cn } from '../lib/cn';

/**
 * §25 — cards are used selectively, for professionals, appointments, services
 * and selected panels. Sections are NOT wrapped in cards by default.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'border-ms-border bg-ms-surface rounded-[12px] border',
        interactive && 'hover:border-ms-primary/40 transition-colors duration-150',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-ms-border border-t px-5 py-4 sm:px-6', className)} {...props} />;
}
