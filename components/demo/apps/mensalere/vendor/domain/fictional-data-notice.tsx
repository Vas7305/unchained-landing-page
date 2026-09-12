import { Info } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * §58 — the prototype runs on invented data. Saying so plainly is more honest
 * than presenting fictional professionals as though they were real.
 */
export function FictionalDataNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        // Surface rather than soft sage: muted text needs the lighter ground
        // to clear 4.5:1 (§55).
        'border-ms-border bg-ms-surface text-ms-small text-ms-muted flex items-start gap-2 rounded-[10px] border px-4 py-3',
        className,
      )}
    >
      <Info aria-hidden className="text-ms-primary mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Preview build. The professionals shown here are fictional examples used to design the
        service. No real profile, photograph, availability or price is represented.
      </span>
    </p>
  );
}
