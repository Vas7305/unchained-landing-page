'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import DemoSpinner from './DemoSpinner';

/**
 * The one button every demo uses.
 *
 * ─── Why this is not the site's button ────────────────────────────────────
 * The site's buttons are the site's identity. Inside a demo the visitor is
 * meant to be looking at the *product's* identity, so this resolves its colour
 * and radius from the `--d-*` custom properties the surface sets, which is
 * what lets the same component be a Caribbean marketplace's primary action and
 * a private-equity console's without a per-product copy (§16).
 *
 * ─── The pending state is part of the contract ────────────────────────────
 * Demo actions stand in for network operations (§8), so the button owns what a
 * pending operation looks like: the label stays put so the layout does not
 * jump, the spinner replaces the icon slot, `aria-busy` is set for assistive
 * technology, and the button disables itself so a second click cannot submit
 * the same booking twice — which is a real bug in real products and would be a
 * real bug here.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap ' +
  'transition-colors duration-200 disabled:opacity-55 disabled:cursor-not-allowed ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]';

const sizes: Record<Size, string> = {
  // 44px and 40px minimum heights: these are touch targets first (§18), and
  // several of these demos are phone products where they are the only target.
  sm: 'text-xs px-3 min-h-9',
  md: 'text-sm px-4 min-h-11',
  lg: 'text-sm px-6 min-h-12',
};

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--d-accent)] text-[var(--d-accent-fg)] hover:brightness-110',
  secondary:
    'bg-[var(--d-surface-2)] text-[var(--d-fg)] border border-[var(--d-border)] hover:bg-[var(--d-surface)]',
  ghost: 'text-[var(--d-muted)] hover:text-[var(--d-fg)] hover:bg-[var(--d-surface-2)]',
  danger: 'bg-[var(--d-danger)] text-white hover:brightness-110',
};

export default function DemoButton({
  variant = 'primary',
  size = 'md',
  pending = false,
  block = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  /** Renders the spinner, sets `aria-busy` and blocks re-submission. */
  pending?: boolean;
  block?: boolean;
  /** Leading icon. Replaced by the spinner while pending. */
  icon?: ReactNode;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      style={{ borderRadius: 'var(--d-radius)' }}
      className={`${base} ${sizes[size]} ${variants[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {pending ? <DemoSpinner /> : icon}
      {children}
    </button>
  );
}
