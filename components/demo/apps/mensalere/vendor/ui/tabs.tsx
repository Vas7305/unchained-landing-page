import { forwardRef } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '../lib/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('border-ms-border flex gap-1 border-b', className)}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative -mb-px inline-flex h-11 items-center border-b-2 border-transparent px-3',
        'text-ms-small text-ms-muted font-medium transition-colors',
        'hover:text-ms-text data-[state=active]:border-ms-primary data-[state=active]:text-ms-text',
        'focus-visible:outline-ms-primary focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn('pt-6', className)} {...props} />;
});
