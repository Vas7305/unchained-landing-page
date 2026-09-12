import { forwardRef } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Checkbox and radio, plus the "option card" pattern used by the questionnaire
 * and booking flow. Both keep a 44px+ target and never rely on colour alone
 * to signal selection (§39, §55).
 */

const controlClass = [
  'peer flex h-5 w-5 shrink-0 items-center justify-center border border-ms-border bg-ms-surface',
  'transition-colors duration-150',
  'data-[state=checked]:border-ms-primary data-[state=checked]:bg-ms-primary',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ms-primary',
  'disabled:opacity-50',
].join(' ');

export const Checkbox = forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(controlClass, 'rounded-[6px]', className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check aria-hidden className="h-3.5 w-3.5 text-white" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export const RadioGroup = forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className, ...props }, ref) {
  return <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-3', className)} {...props} />;
});

export const RadioGroupItem = forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(controlClass, 'rounded-full', className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-white" />
    </RadioGroupPrimitive.Item>
  );
});

/**
 * Label + control laid out as a selectable row. The whole row is the target,
 * which is what makes the questionnaire usable on a phone (§79).
 */
export function OptionRow({
  id,
  control,
  title,
  description,
  selected,
  className,
}: {
  id: string;
  control: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  selected: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'bg-ms-surface flex cursor-pointer items-start gap-3 rounded-[10px] border p-4',
        'hover:border-ms-primary/40 transition-colors duration-150',
        'has-[:focus-visible]:outline-ms-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        selected ? 'border-ms-primary bg-ms-primary-soft/40' : 'border-ms-border',
        className,
      )}
    >
      <span className="mt-0.5">{control}</span>
      <span className="flex flex-col gap-1">
        <span className="text-ms-body text-ms-text font-medium">{title}</span>
        {description && <span className="text-ms-small text-ms-muted">{description}</span>}
      </span>
    </label>
  );
}
