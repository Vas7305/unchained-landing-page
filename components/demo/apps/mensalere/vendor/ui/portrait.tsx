import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';
import { initials } from '../lib/format';

/**
 * One photography treatment for the whole product (§57, and the refinement
 * brief's photography system): the same crop behaviour, the same radius, the
 * same fallback, everywhere a person is pictured.
 *
 * No stock photograph and no AI-generated face stands in for a professional. If
 * a real photograph exists it is rendered; if it does not, the frame renders a
 * quiet monogram on soft sage. That is deliberately a placeholder rather than
 * poor photography, and it keeps the composition intact until real portraits
 * are supplied.
 */
const frameVariants = cva('relative w-full overflow-hidden bg-ms-primary-soft', {
  variants: {
    ratio: {
      /** Editorial portrait — hero and profile. */
      portrait: 'aspect-[4/5]',
      /** Card portrait — professional cards. */
      card: 'aspect-[3/2]',
      square: 'aspect-square',
    },
    radius: {
      default: 'rounded-[12px]',
      /** Full-bleed inside a card: only the top corners are rounded. */
      top: 'rounded-t-[12px]',
      none: 'rounded-none',
    },
  },
  defaultVariants: { ratio: 'card', radius: 'default' },
});

export interface PortraitProps extends VariantProps<typeof frameVariants> {
  /** Used for the monogram and, when a photograph exists, its alt text. */
  name: string;
  src?: string | undefined;
  /** Describes the photograph. Omit when the name beside it already does. */
  alt?: string;
  className?: string;
}

export function Portrait({ name, src, alt, ratio, radius, className }: PortraitProps) {
  return (
    <div className={cn(frameVariants({ ratio, radius }), className)}>
      {src ? (
        <img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="text-h2 text-ms-primary-strong/70 absolute inset-0 flex items-center justify-center font-medium tracking-[0.08em]"
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}

/**
 * The same frame without a person in it: used where the composition needs an
 * image but no photograph has been approved yet. It states what it is instead
 * of pretending to be a photograph.
 */
export function ImagePlaceholder({
  label,
  ratio,
  radius,
  className,
}: VariantProps<typeof frameVariants> & { label: string; className?: string }) {
  return (
    <div className={cn(frameVariants({ ratio, radius }), 'border-ms-border border', className)}>
      <span className="text-ms-caption text-ms-muted absolute inset-x-0 bottom-0 px-4 py-3">{label}</span>
    </div>
  );
}
