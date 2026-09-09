'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

/**
 * What a simulated operation just did, announced rather than only drawn.
 *
 * ─── The accessibility requirement this exists to meet ────────────────────
 * §19 asks for screen-reader-friendly status messages, and a demo is full of
 * them: an item added, a slot taken, a card declined, an export written. Every
 * one of those is a change somewhere other than where the visitor's focus is,
 * which is exactly the case a live region is for.
 *
 * `role="status"` (polite) for success and information; `role="alert"`
 * (assertive) for failures, because a refusal that is read after the next
 * three announcements has not been communicated. The region is rendered even
 * when empty — a live region inserted at the same moment as its text is
 * frequently missed by assistive technology, which is the usual reason this
 * pattern silently fails.
 */

export type DemoStatusTone = 'success' | 'error' | 'info';

const tones: Record<
  DemoStatusTone,
  { color: string; border: string; Icon: typeof Info }
> = {
  success: {
    color: 'var(--d-positive)',
    border: 'color-mix(in oklab, var(--d-positive) 40%, transparent)',
    Icon: CheckCircle2,
  },
  error: {
    color: 'var(--d-danger)',
    border: 'color-mix(in oklab, var(--d-danger) 40%, transparent)',
    Icon: AlertCircle,
  },
  info: {
    color: 'var(--d-muted)',
    border: 'var(--d-border)',
    Icon: Info,
  },
};

export default function DemoStatus({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: DemoStatusTone;
  /** Null or undefined keeps the region mounted and silent. */
  children?: ReactNode;
  className?: string;
}) {
  const { color, border, Icon } = tones[tone];
  const empty = children === null || children === undefined || children === false;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={empty ? 'sr-only' : className}
    >
      {!empty && (
        <div
          className='flex items-start gap-2 px-3 py-2.5 text-xs leading-relaxed'
          style={{
            color,
            border: `1px solid ${border}`,
            borderRadius: 'var(--d-radius)',
            background: 'color-mix(in oklab, currentColor 8%, transparent)',
          }}
        >
          <Icon size={14} className='mt-px shrink-0' aria-hidden='true' />
          <span className='text-[var(--d-fg)]'>{children}</span>
        </div>
      )}
    </div>
  );
}
