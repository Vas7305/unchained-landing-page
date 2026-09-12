import type { DurationRange, PriceInfo } from '../types';
import { cn } from '../lib/utils';
import { formatDuration, formatPrice, formatRating } from '../lib/format';

/* ------------------------------------------------------------------ stars */

export function Stars({
  value,
  className,
  size = 12,
}: {
  value: number;
  className?: string;
  size?: number;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn('inline-flex items-center gap-[2px]', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((index) => {
        const fill = rounded >= index ? 1 : rounded >= index - 0.5 ? 0.5 : 0;
        return (
          <svg key={index} width={size} height={size} viewBox="0 0 20 20" className="shrink-0">
            <defs>
              <linearGradient id={`half-${index}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.8l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 13.78l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"
              fill={fill === 1 ? 'currentColor' : fill === 0.5 ? `url(#half-${index})` : 'none'}
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
              opacity={fill ? 1 : 0.32}
            />
          </svg>
        );
      })}
    </span>
  );
}

/** Rating with an accessible text equivalent — stars alone say nothing to a screen reader. */
export function RatingLine({
  value,
  count,
  className,
  showStars = true,
}: {
  value: number;
  count?: number;
  className?: string;
  showStars?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[0.8125rem]', className)}>
      {showStars && <Stars value={value} className="text-lk-accent" />}
      <span className="lk-numeric font-medium">{formatRating(value)}</span>
      {typeof count === 'number' && <span className="lk-numeric text-lk-muted">({count})</span>}
      <span className="sr-only">
        Рейтинг {formatRating(value)} из 5{typeof count === 'number' ? `, ${count} оценок` : ''}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------- tags */

export function Chip({
  children,
  active = false,
  as: Tag = 'span',
  className,
  ...rest
}: {
  children: React.ReactNode;
  active?: boolean;
  as?: 'span' | 'button';
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      // A chip rendered as a button must never default to type="submit" — one
      // dropped inside a form would silently submit it.
      {...(Tag === 'button' ? { type: 'button' as const } : {})}
      className={cn(
        'inline-flex h-9 items-center rounded-lk-xs border px-3.5 text-[0.8125rem] whitespace-nowrap',
        'transition-colors duration-200',
        active
          ? 'border-lk-ink bg-lk-ink text-lk-paper'
          : 'border-lk-line-strong text-lk-ink-2 hover:border-lk-ink hover:text-lk-ink',
        Tag === 'button' && 'cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'lk-type-meta inline-flex items-center rounded-lk-xs border border-lk-line px-2 py-1 text-lk-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ price / time */

/**
 * Price. When a price is a floor rather than a fixed number, the reason is
 * shown alongside it — that is what makes "от" honest instead of evasive.
 */
export function PriceTag({
  price,
  className,
  size = 'md',
  showFactors = false,
}: {
  price: PriceInfo;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showFactors?: boolean;
}) {
  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      <span
        className={cn(
          'lk-numeric font-medium whitespace-nowrap',
          size === 'sm' && 'text-[0.875rem]',
          size === 'md' && 'text-[1rem]',
          size === 'lg' && 'lk-type-subtitle font-lk-display',
        )}
      >
        {formatPrice(price)}
      </span>
      {showFactors && price.factors?.length ? (
        <span className="lk-type-meta text-lk-muted">Зависит от: {price.factors.join(', ').toLowerCase()}</span>
      ) : null}
    </span>
  );
}

export function DurationTag({
  duration,
  className,
}: {
  duration: DurationRange;
  className?: string;
}) {
  return (
    <span className={cn('lk-numeric lk-type-small whitespace-nowrap text-lk-muted', className)}>
      {formatDuration(duration)}
    </span>
  );
}

/** Thin vertical rule between inline meta items. */
export function MetaDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('text-lk-line-strong', className)}>
      ·
    </span>
  );
}

/* ------------------------------------------------------------ placeholders */

/**
 * A business fact that has not been supplied yet.
 *
 * Rendered visibly rather than guessed at: a wrong phone number is worse than
 * an obviously missing one. Every token here is greppable in `data/business.ts`.
 */
export function PlaceholderToken({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lk-xs border border-dashed border-lk-line-strong bg-lk-paper-2/60 px-1.5 py-0.5',
        'lk-type-small text-lk-muted',
        className,
      )}
      title="Данные будут заполнены реальной информацией салона"
    >
      {children}
    </span>
  );
}
