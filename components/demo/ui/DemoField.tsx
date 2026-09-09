'use client';

import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * A labelled control that reports its own errors.
 *
 * ─── Why the demos do not hand-roll form markup ───────────────────────────
 * Because the parts that get skipped are the parts that matter. Every field
 * here gets a real <label for>, and a field with an error gets `aria-invalid`
 * plus an `aria-describedby` pointing at the message — so the error is read
 * out when focus lands on the control rather than being a red sentence a
 * sighted visitor happens to see. Doing that once, here, is the difference
 * between eight accessible demos and eight demos that each forgot something
 * different (§19).
 *
 * The id is generated with `useId`, so a form rendered twice on one page — a
 * checkout beside a saved-address panel — cannot produce two controls with the
 * same id and a label pointing at whichever one the browser found first.
 */

function shell(hasError: boolean): string {
  return (
    'w-full bg-[var(--d-surface)] text-[var(--d-fg)] text-sm px-3 min-h-11 py-2.5 ' +
    'border transition-colors duration-150 placeholder:text-[var(--d-muted)] ' +
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--d-ring)] ' +
    (hasError ? 'border-[var(--d-danger)]' : 'border-[var(--d-border)]')
  );
}

function Frame({
  label,
  hint,
  error,
  fieldId,
  errorId,
  hintId,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  fieldId: string;
  errorId: string;
  hintId: string;
  children: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <label
        htmlFor={fieldId}
        className='text-xs font-medium text-[var(--d-muted)]'
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className='text-[11px] text-[var(--d-muted)]'>
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className='text-[11px] font-medium text-[var(--d-danger)]'
        >
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string };

export function DemoInput({
  label,
  hint,
  error,
  className = '',
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <Frame
      label={label}
      hint={hint}
      error={error}
      fieldId={id}
      errorId={errorId}
      hintId={hintId}
    >
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        style={{ borderRadius: 'var(--d-radius)' }}
        className={`${shell(Boolean(error))} ${className}`}
        {...rest}
      />
    </Frame>
  );
}

export function DemoTextarea({
  label,
  hint,
  error,
  className = '',
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <Frame
      label={label}
      hint={hint}
      error={error}
      fieldId={id}
      errorId={errorId}
      hintId={hintId}
    >
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        style={{ borderRadius: 'var(--d-radius)' }}
        className={`${shell(Boolean(error))} resize-y ${className}`}
        {...rest}
      />
    </Frame>
  );
}

export function DemoSelect({
  label,
  hint,
  error,
  children,
  className = '',
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <Frame
      label={label}
      hint={hint}
      error={error}
      fieldId={id}
      errorId={errorId}
      hintId={hintId}
    >
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        style={{ borderRadius: 'var(--d-radius)' }}
        className={`${shell(Boolean(error))} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Frame>
  );
}
