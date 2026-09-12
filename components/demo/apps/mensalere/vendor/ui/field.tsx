import { createContext, useContext, useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * §23, §55 — every control has a visible label, and validation is announced.
 * Field owns the id wiring so no screen ever hand-rolls aria-describedby.
 */

interface FieldContextValue {
  id: string;
  descriptionId: string;
  errorId: string;
  hasError: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

/** Props a control should spread onto its input element. */
export function useFieldControlProps() {
  const context = useContext(FieldContext);
  if (!context) {
    return {};
  }
  const { id, descriptionId, errorId, hasError, required } = context;
  return {
    id,
    'aria-describedby': cn(descriptionId, hasError && errorId) || undefined,
    'aria-invalid': hasError || undefined,
    'aria-required': required || undefined,
  };
}

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  /** Hides the label visually but keeps it for assistive technology. */
  labelHidden?: boolean;
  className?: string;
}

export function Field({
  label,
  children,
  description,
  error,
  required = false,
  labelHidden = false,
  className,
}: FieldProps) {
  const reactId = useId();
  const id = `field-${reactId}`;
  /* LOCAL OPTIMISATION, not the product's code. This literal was rebuilt on
     every render, giving the context a new identity each time and re-rendering
     every consumer — the label, the control and the error text — whether or not
     anything about the field had changed. Memoising it is behaviour-preserving;
     the value is derived entirely from the dependencies listed. Recorded in
     docs/upstream-findings.md so the product can fix it at source. */
  const value: FieldContextValue = useMemo(
    () => ({
      id,
      descriptionId: description ? `${id}-description` : '',
      errorId: `${id}-error`,
      hasError: Boolean(error),
      required,
    }),
    [id, description, error, required],
  );

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('flex flex-col gap-2', className)}>
        <label
          htmlFor={id}
          className={cn('text-ms-small text-ms-text font-medium', labelHidden && 'sr-only')}
        >
          {label}
          {required && (
            <span className="text-ms-muted ml-1" aria-hidden>
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>

        {description && (
          <p id={value.descriptionId} className="text-ms-small text-ms-muted">
            {description}
          </p>
        )}

        {children}

        {/* Inserted only when there is an error: assistive technology
            announces an alert on insertion, and an empty live region would
            otherwise sit in the accessibility tree on every field. */}
        {error && (
          <p
            id={value.errorId}
            role="alert"
            className="text-ms-small text-ms-error-strong flex items-start gap-1.5"
          >
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
