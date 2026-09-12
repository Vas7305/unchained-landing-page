import { forwardRef } from 'react';
import { Link } from './AppLink';
import { cn } from '../lib/utils';

/**
 * Buttons.
 *
 * Three roles only, so hierarchy stays readable on every screen:
 * `primary` is the one action the page wants, `secondary` is the alternative,
 * `quiet` is navigation dressed as a button. Corners are near-square by design.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'light';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lk-xs font-lk-sans font-medium tracking-[0.01em] ' +
  'transition-[background-color,color,border-color,transform] duration-200 ease-[var(--ease-lk-editorial)] ' +
  'select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-45';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-lk-ink text-lk-paper hover:bg-lk-ink-2',
  secondary: 'border border-lk-line-strong text-lk-ink hover:border-lk-ink hover:bg-lk-paper-2',
  quiet: 'text-lk-ink underline decoration-lk-line-strong underline-offset-[6px] hover:decoration-lk-ink',
  light: 'bg-lk-paper text-lk-ink hover:bg-lk-paper-2',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[0.8125rem]',
  md: 'h-11 px-5 text-[0.875rem]',
  lg: 'h-[3.25rem] px-7 text-[0.9375rem]',
};

/** `quiet` is text, not a box — it must not carry button padding. */
function classesFor(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean) {
  return cn(
    BASE,
    VARIANT[variant],
    variant === 'quiet' ? 'h-auto px-0 text-[0.875rem]' : SIZE[size],
    fullWidth && 'w-full',
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(classesFor(variant, size, fullWidth), className)}
      {...rest}
    />
  );
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={cn(classesFor(variant, size, fullWidth), className)} {...rest} />;
}

export interface ExternalButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function ExternalButtonLink({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className,
  ...rest
}: ExternalButtonLinkProps) {
  return <a className={cn(classesFor(variant, size, fullWidth), className)} {...rest} />;
}

/** The small "→" that ends editorial links. Decorative, never announced. */
export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('h-3.5 w-3.5', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Text link with a sliding arrow — the standard "read more" affordance. */
export function TextLink({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'group/link inline-flex items-center gap-2 text-[0.875rem] font-medium text-lk-ink',
        className,
      )}
    >
      <span className="border-b border-lk-line-strong pb-0.5 transition-colors group-hover/link:border-lk-ink">
        {children}
      </span>
      <ArrowRight className="transition-transform duration-300 ease-[var(--ease-lk-editorial)] group-hover/link:translate-x-1" />
    </Link>
  );
}
