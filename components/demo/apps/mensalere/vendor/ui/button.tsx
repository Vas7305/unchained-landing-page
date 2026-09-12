import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Slot } from 'radix-ui';

/* The product imports `@radix-ui/react-slot`, whose default export IS the
   component. This site ships the unified `radix-ui` package, where the same
   primitive is a namespace and the component is `Slot.Root`. Aliasing here
   keeps the component body below identical to the product's. */
const SlotRoot = Slot.Root;
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * §21 Button system, §22 button states.
 * Every variant supports default, hover, focus, active, disabled and loading.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 rounded-[10px] font-medium',
    'transition-colors duration-150 select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ms-primary',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-ms-primary-strong text-white hover:bg-ms-primary-hover active:bg-ms-primary-active',
        secondary:
          'border border-ms-border bg-ms-surface text-ms-text hover:bg-ms-primary-soft active:bg-ms-primary-soft',
        ghost: 'text-ms-text hover:bg-ms-primary-soft active:bg-ms-primary-soft',
        subtle: 'bg-ms-primary-soft text-ms-text hover:bg-ms-primary-soft/70',
        destructive:
          'border border-ms-error/30 bg-ms-error-soft text-ms-error-strong hover:bg-ms-error-strong hover:text-white',
        link: 'h-auto rounded-ms-sm p-0 text-ms-primary-strong underline-offset-4 hover:underline',
      },
      size: {
        // §21 minimum 44px, preferred 48px.
        sm: 'h-11 px-4 text-ms-small',
        md: 'h-12 px-5 text-ms-body',
        lg: 'h-12 px-7 text-ms-body sm:h-14',
        icon: 'h-11 w-11',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [{ variant: 'link', class: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Renders the child element instead of a <button> (e.g. a router Link). */
  asChild?: boolean;
  isLoading?: boolean;
  /** Announced while loading; falls back to the button's own label. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    block,
    asChild = false,
    isLoading = false,
    loadingLabel,
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  const Comp = asChild ? SlotRoot : 'button';

  // asChild delegates rendering, so the spinner treatment is skipped there.
  if (asChild) {
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {/* The label stays in flow so the button never changes size (§22). */}
      <span className={cn('inline-flex items-center gap-2', isLoading && 'invisible')}>
        {children}
      </span>
      {isLoading && (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          <span className="sr-only">{loadingLabel ?? 'Working'}</span>
        </span>
      )}
    </button>
  );
});

/**
 * The `secondary` treatment for a button sitting on a photograph, where the
 * usual white fill would read as a second primary action.
 *
 * Every state is measured against the darkest ground the hero's 65% wash can
 * produce (#6E6E6D): the border sits at 70%, which clears 3:1 and keeps the
 * control identifiable (SC 1.4.11), and hover inverts to a solid rather than
 * washing the fill lighter — a translucent light fill under a white label
 * measures 3.58:1 and would drop the hover state below AA.
 *
 * Shared so the bar and the hero cannot drift apart.
 */
export const ON_PHOTOGRAPH_OUTLINE = [
  'border-ms-background/70 bg-transparent text-ms-background',
  'hover:bg-ms-background hover:text-ms-text',
  'active:bg-ms-background/90 active:text-ms-text',
].join(' ');

/** The same idea for `ghost` and `icon` buttons: no border, same inverted hover. */
export const ON_PHOTOGRAPH_GHOST = [
  'text-ms-background',
  'hover:bg-ms-background hover:text-ms-text',
  'active:bg-ms-background/90 active:text-ms-text',
].join(' ');

export { buttonVariants };
