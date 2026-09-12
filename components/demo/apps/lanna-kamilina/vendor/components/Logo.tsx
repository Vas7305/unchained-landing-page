import { Link } from './AppLink';
import { cn } from '../lib/utils';
import { routes } from '../lib/routes';

/**
 * Wordmark. Letter-spaced display type rather than a graphic — it stays crisp
 * at any size, needs no asset, and reads as editorial rather than as a badge.
 */
export function Logo({
  className,
  tone = 'ink',
  withCity = false,
}: {
  className?: string;
  tone?: 'ink' | 'paper';
  withCity?: boolean;
}) {
  return (
    <Link
      to={routes.home}
      className={cn('group inline-flex flex-col leading-none', className)}
      aria-label="Lanna Kamilina — на главную"
    >
      <span
        className={cn(
          'font-lk-display text-[1.0625rem] tracking-[0.24em] uppercase sm:text-[1.125rem]',
          tone === 'paper' ? 'text-lk-paper' : 'text-lk-ink',
        )}
      >
        Lanna&nbsp;Kamilina
      </span>
      {withCity && (
        <span
          className={cn(
            'lk-type-meta mt-1.5 tracking-[0.2em] uppercase',
            tone === 'paper' ? 'text-lk-paper/55' : 'text-lk-muted',
          )}
        >
          Москва · с 1999
        </span>
      )}
    </Link>
  );
}
