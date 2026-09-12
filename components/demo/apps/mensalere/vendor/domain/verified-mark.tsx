import { BadgeCheck } from 'lucide-react';
import { cn } from '../lib/cn';

/** §27 — a single, quiet indicator. Not a badge collection. */
export function VerifiedMark({ className }: { className?: string }) {
  return (
    <span className={cn('text-ms-caption text-ms-muted inline-flex items-center gap-1.5', className)}>
      <BadgeCheck aria-hidden className="text-ms-primary h-4 w-4" />
      Verified professional
    </span>
  );
}
