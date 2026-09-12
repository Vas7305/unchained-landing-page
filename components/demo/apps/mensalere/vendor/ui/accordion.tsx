import { forwardRef } from 'react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import { Plus } from 'lucide-react';
import { cn } from '../lib/cn';

/** Used for the homepage FAQ (§28). Radix supplies the disclosure semantics. */

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn('border-ms-border border-b', className)}
      {...props}
    />
  );
});

export const AccordionTrigger = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'group flex flex-1 items-start justify-between gap-6 py-5 text-left',
          'text-ms-body-lg text-ms-text hover:text-ms-primary-strong font-medium transition-colors',
          'focus-visible:outline-ms-primary focus-visible:outline-2 focus-visible:outline-offset-2',
          className,
        )}
        {...props}
      >
        {children}
        <Plus
          aria-hidden
          className="text-ms-muted mt-1 h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-45"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content ref={ref} className="overflow-hidden" {...props}>
      <div className={cn('text-ms-body text-ms-muted max-w-2xl pr-8 pb-6', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});
