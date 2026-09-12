import { forwardRef } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Modal dialog. Radix provides focus trapping, restore-on-close, escape
 * handling and the aria wiring required by §55.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    closeLabel?: string;
  }
>(function DialogContent({ className, children, closeLabel = 'Close', ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-ms-text/25 fixed inset-0 z-50 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'border-ms-border bg-ms-surface max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[16px] border',
          'shadow-ms-raised p-6 sm:p-8',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute top-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-[10px]',
            'text-ms-muted hover:bg-ms-primary-soft hover:text-ms-text transition-colors',
            'focus-visible:outline-ms-primary focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        >
          <X aria-hidden className="h-5 w-5" />
          <span className="sr-only">{closeLabel}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-5 flex flex-col gap-2 pr-10', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-h3 text-ms-text font-semibold', className)}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-ms-body text-ms-muted', className)}
      {...props}
    />
  );
});
