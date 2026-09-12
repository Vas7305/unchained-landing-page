import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/** §27 — indicators stay subtle. Badges carry meaning, not decoration. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-ms-caption font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-ms-background text-ms-muted ring-1 ring-inset ring-ms-border',
        accent: 'bg-ms-primary-soft text-ms-text',
        outline: 'text-ms-muted ring-1 ring-inset ring-ms-border',
        error: 'bg-ms-error-soft text-ms-error-strong',
        warning: 'bg-ms-warning-soft text-ms-warning-strong',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
