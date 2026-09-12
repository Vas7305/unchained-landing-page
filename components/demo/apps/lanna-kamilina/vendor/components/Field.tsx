import { useId } from 'react';
import { cn } from '../lib/utils';

/**
 * Form controls.
 *
 * Every field is labelled, every error is announced, and required fields say
 * so in words rather than with a red asterisk nobody decodes.
 */

const CONTROL =
  'w-full rounded-lk-xs border bg-lk-paper px-3.5 py-3 text-[0.9375rem] text-lk-ink placeholder:text-lk-muted/70 ' +
  'transition-colors duration-200 focus:outline-none';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    className: string;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="lk-type-small font-medium text-lk-ink">
        {label}
        {!required && <span className="ml-2 font-normal text-lk-muted">необязательно</span>}
      </label>

      {hint && (
        <p id={hintId} className="lk-type-meta text-lk-muted">
          {hint}
        </p>
      )}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        className: cn(CONTROL, error ? 'border-lk-critical' : 'border-lk-line-strong focus:border-lk-ink'),
      })}

      {error && (
        <p id={errorId} role="alert" className="lk-type-small text-lk-critical">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(props.className, 'resize-y')} />;
}

/** Checkbox with the label as the hit target — required for 152-ФЗ consent. */
export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          className={cn(
            'mt-[3px] h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-lk-xs border bg-lk-paper',
            'transition-colors duration-150',
            'checked:border-lk-ink checked:bg-lk-ink',
            error ? 'border-lk-critical' : 'border-lk-line-strong',
          )}
          style={{
            backgroundImage: checked
              ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23F5F2EC' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E\")"
              : undefined,
            backgroundSize: '14px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <span className="lk-type-small text-lk-ink-2">{children}</span>
      </label>
      {error && (
        <p role="alert" className="lk-type-small text-lk-critical">
          {error}
        </p>
      )}
    </div>
  );
}
