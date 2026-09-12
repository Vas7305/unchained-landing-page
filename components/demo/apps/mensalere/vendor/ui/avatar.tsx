import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';
import { initials } from '../lib/format';

/**
 * §57 — no stock or AI-generated face stands in for a person. Until a real
 * photograph exists, the avatar renders the professional's initials on soft
 * sage. It is obviously a placeholder, which is the point.
 */
const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-ms-primary-soft font-medium text-ms-text',
  {
    variants: {
      size: {
        sm: 'h-9 w-9 text-ms-caption',
        md: 'h-12 w-12 text-ms-small',
        lg: 'h-16 w-16 text-ms-body',
        xl: 'h-24 w-24 text-h3',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | undefined;
  className?: string;
}

export function Avatar({ name, src, size, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        // The name is already adjacent in every usage, so the image is decorative.
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(avatarVariants({ size }), 'object-cover', className)}
      />
    );
  }

  return (
    <span aria-hidden className={cn(avatarVariants({ size }), className)}>
      {initials(name)}
    </span>
  );
}
