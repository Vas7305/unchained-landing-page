import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { baseInputClass } from './input';
import { useFieldControlProps } from './field';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  const fieldProps = useFieldControlProps();
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...fieldProps}
      className={cn(baseInputClass, 'border-ms-border resize-y py-3 leading-relaxed', className)}
      {...props}
    />
  );
});
