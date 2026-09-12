'use client';

import type { ReactNode } from 'react';

import styles from './DirectionalLink.module.css';

/**
 * The product's internal link, adapted for the demo.
 *
 * ─── Why this one component is not copied verbatim ────────────────────────
 * Everything else in `vendor/` is the application's own code. This is the one
 * piece that cannot be: the real `DirectionalLink` calls `useRouter().push()`
 * inside `document.startViewTransition`, which in the product moves between
 * pages and in the demo would navigate the visitor off the Unchained Business
 * site entirely.
 *
 * So the visual contract is kept and the service behind it is swapped — the
 * adapter layer the brief asks for. Callers still pass `href` and a
 * `className`, the class still comes from the product's own CSS modules, and
 * the element still looks like the link it replaces. What changes is that a
 * click reports the destination to the demo instead of to the router.
 *
 * It renders a <button> rather than an <a>, because an anchor with no
 * destination is a lie to assistive technology: this control does not
 * navigate. The module below restores the typography an <a> would have
 * inherited from the product's base stylesheet.
 */
export function DirectionalLink({
  href,
  children,
  className = '',
  onNavigate,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** Where the demo wants the click to go, if anywhere. */
  onNavigate?: (href: string) => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className'>) {
  return (
    <button
      type='button'
      data-href={href}
      onClick={() => onNavigate?.(href)}
      className={`${styles.link} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
