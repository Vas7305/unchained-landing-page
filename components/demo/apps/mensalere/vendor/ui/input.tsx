import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { useFieldControlProps } from './field';

/** §23 — inputs are 48px tall, labelled, and show validation state visibly. */
const baseInputClass = [
  'w-full rounded-[10px] border bg-ms-surface px-4 text-ms-body text-ms-text',
  'placeholder:text-ms-muted/70',
  'transition-colors duration-150',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ms-primary',
  'disabled:cursor-not-allowed disabled:bg-ms-background disabled:text-ms-muted',
  'aria-[invalid]:border-ms-error',
].join(' ');

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  const fieldProps = useFieldControlProps();
  return (
    <input
      ref={ref}
      {...fieldProps}
      className={cn(baseInputClass, 'border-ms-border h-12', className)}
      {...props}
    />
  );
});

export { baseInputClass };
