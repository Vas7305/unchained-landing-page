'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { demoNavigate } from './router-bridge';

/**
 * The router, adapted for the demo.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────
 * Mensalere is a single-page application built on react-router-dom, and its
 * components import `Link` to move between routes. Inside this demo there are
 * no routes to move between — the whole application runs in one panel on a
 * page belonging to a different site — and a real navigation would carry the
 * visitor away from it.
 *
 * So the import specifier is rewritten to this module and the behaviour is
 * swapped: the component keeps its props and its class contract, and a click
 * reports the destination to the demo instead of pushing history. Only `Link`
 * is reproduced, because `Link` is all the vendored tree imports — the rest of
 * react-router's surface would be dead code pretending to be an adapter.
 *
 * It renders a <button> rather than an <a>, because an anchor that does not
 * navigate is a lie to assistive technology. The inline style restores what an
 * <a> inherits from the product's stylesheet and a <button> does not.
 */
export interface LinkProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> {
  to: string;
  children?: ReactNode;
}

export function Link({ to, children, className, ...rest }: LinkProps) {
  return (
    <button
      type='button'
      data-to={to}
      onClick={() => demoNavigate(to)}
      className={className}
      style={{
        appearance: 'none',
        background: 'none',
        border: 0,
        padding: 0,
        margin: 0,
        font: 'inherit',
        color: 'inherit',
        textAlign: 'inherit',
        cursor: 'pointer',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
