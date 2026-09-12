import { cn } from '../lib/cn';

/** §51 — skeletons stand in for content, never for a full-screen spinner. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('bg-ms-border/60 animate-pulse rounded-[8px]', className)}
      {...props}
    />
  );
}
