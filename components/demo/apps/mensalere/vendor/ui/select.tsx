import { forwardRef } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';
import { useField } from './field';

/**
 * Accessible select built on Radix (keyboard, typeahead and focus management
 * come from the primitive; §55). Used only where a native list is not enough.
 */

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...props }, ref) {
  const field = useField();
  const id = field?.id;
  const descriptionId = field?.descriptionId;
  const errorId = field?.errorId;
  const hasError = field?.hasError;
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      id={id}
      aria-describedby={cn(descriptionId, hasError && errorId) || undefined}
      aria-invalid={hasError || undefined}
      className={cn(
        'border-ms-border flex h-12 w-full items-center justify-between gap-2 rounded-[10px] border',
        'bg-ms-surface text-ms-body text-ms-text px-4 text-left transition-colors duration-150',
        // A long option label truncates instead of widening its column.
        '[&>span:first-child]:truncate',
        'data-[placeholder]:text-ms-muted/80',
        'focus-visible:outline-ms-primary focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:text-ms-muted disabled:cursor-not-allowed',
        hasError && 'border-ms-error',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden className="text-ms-muted h-4 w-4 shrink-0" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={6}
        className={cn(
          'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'border-ms-border bg-ms-surface shadow-ms-soft rounded-[10px] border',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-pointer items-center justify-between gap-2 rounded-ms-md select-none',
        'text-ms-body text-ms-text px-3 py-2.5 outline-none',
        'data-[highlighted]:bg-ms-primary-soft data-[state=checked]:font-medium',
        'data-[disabled]:text-ms-muted data-[disabled]:pointer-events-none',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden className="text-ms-primary h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
});
