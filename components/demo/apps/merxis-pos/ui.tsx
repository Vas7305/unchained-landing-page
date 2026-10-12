'use client';

import type { ReactNode } from 'react';
import { radius } from './tokens';

/** Pieces the Merxis screens share: the product's card and its label/value row. */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      style={radius}
      className={`bg-[var(--d-surface)] border border-[var(--d-border)] p-5 ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * One line of a summary: a muted label, a figure. A figure that starts with a
 * minus sign is drawn in red, as the product does, whatever tone was asked for.
 */
export function Row({
  term,
  value,
  tone,
  strong = false,
}: {
  term: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  const negative = /^[-−]/.test(value);
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? 'border-t border-[var(--d-border)] pt-2 font-medium' : ''}`}
    >
      <dt className={strong ? '' : 'text-[var(--d-muted)]'}>{term}</dt>
      <dd
        className={`tabular-nums ${strong ? 'text-lg' : ''}`}
        style={{ color: negative ? 'var(--d-danger)' : tone }}
      >
        {value}
      </dd>
    </div>
  );
}
