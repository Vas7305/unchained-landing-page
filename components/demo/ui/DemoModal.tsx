'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * A dialog that behaves like one.
 *
 * ─── What "modal focus behavior" costs, and why it is here once ───────────
 * §19 asks for it by name, and it is the single most commonly skipped piece of
 * accessible UI: a dialog that opens without moving focus leaves a screen
 * reader user reading the page behind it, and one that does not trap focus
 * lets Tab walk out of the dialog into content that is visually covered and
 * logically gone. Implemented once here, every demo's confirmation, match
 * announcement and detail overlay gets it.
 *
 * What this does:
 *   · moves focus into the dialog on open, preferring the element marked
 *     `data-autofocus` and falling back to the dialog itself;
 *   · returns focus to whatever opened it on close — the visitor ends up back
 *     where they were, not at the top of the document;
 *   · cycles Tab and Shift+Tab inside the dialog;
 *   · closes on Escape;
 *   · marks the surface `aria-modal` and labels it from its own heading.
 *
 * The page behind is inert to the pointer via the backdrop, and the demo
 * surface itself does not scroll while a dialog is open. Body scroll is left
 * alone deliberately: the demo is a panel inside a normal page, and locking
 * the whole document because a simulated dialog opened would be the demo
 * reaching outside its own boundary.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function DemoModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  labelClose = 'Close',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  labelClose?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const focusables = useCallback((): HTMLElement[] => {
    const panel = panelRef.current;
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  // Open: remember where focus was, then move it in.
  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? panel)?.focus();

    return () => {
      // Only restore if the opener is still in the document; a dialog that
      // closed because its trigger was removed should not throw.
      const target = restoreTo.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  // The key handler reads the latest `onClose` through a ref rather than
  // depending on it. A caller that passes an inline arrow — which is every
  // caller — hands us a new function each render, and depending on it would
  // tear the document listener down and rebuild it on every keystroke the
  // dialog causes. The subscription belongs to `open`, not to the callback.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape closes; Tab cycles.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, focusables]);

  if (!open) return null;

  return (
    <div className='absolute inset-0 z-30 flex items-end sm:items-center justify-center'>
      <div
        className='absolute inset-0 bg-black/55 backdrop-blur-[2px]'
        onClick={onClose}
        aria-hidden='true'
      />
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={{ borderRadius: 'var(--d-radius)' }}
        className='relative w-full sm:w-[min(26rem,90%)] max-h-[88%] overflow-y-auto bg-[var(--d-surface)] border border-[var(--d-border)] shadow-2xl p-5 m-3 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
      >
        <div className='flex items-start justify-between gap-4'>
          <h2
            id={titleId}
            className='text-base font-semibold text-[var(--d-fg)] leading-snug'
          >
            {title}
          </h2>
          <button
            type='button'
            onClick={onClose}
            aria-label={labelClose}
            className='shrink-0 -mt-1 -mr-1 p-2 text-[var(--d-muted)] hover:text-[var(--d-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
          >
            <X size={16} aria-hidden='true' />
          </button>
        </div>

        {description && (
          <p
            id={descId}
            className='mt-2 text-xs leading-relaxed text-[var(--d-muted)]'
          >
            {description}
          </p>
        )}

        {children && <div className='mt-4'>{children}</div>}
        {footer && <div className='mt-5 flex flex-col gap-2'>{footer}</div>}
      </div>
    </div>
  );
}
