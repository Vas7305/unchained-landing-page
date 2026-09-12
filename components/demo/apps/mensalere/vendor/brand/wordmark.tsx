import { Link } from '../router';
import { cn } from '../lib/cn';

/**
 * §19 — the MVP wordmark is typography only. No icon, no symbol, no generated
 * SVG mark. The logo will be designed separately.
 */
export function Wordmark({
  className,
  as = 'link',
  size = 'md',
  tone = 'default',
}: {
  className?: string;
  as?: 'link' | 'text';
  size?: 'sm' | 'md';
  /** `inverse` is for the wordmark sitting on a photograph or dark ground. */
  tone?: 'default' | 'inverse';
}) {
  const content = (
    <span
      className={cn(
        'font-semibold tracking-[0.18em] uppercase',
        tone === 'inverse' ? 'text-ms-background' : 'text-ms-text',
        size === 'sm' ? 'text-ms-small' : 'text-ms-body',
      )}
    >
      Mensalere
    </span>
  );

  if (as === 'text') {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center rounded-ms-sm transition-opacity hover:opacity-70',
        'focus-visible:outline-ms-primary focus-visible:outline-2 focus-visible:outline-offset-4',
        className,
      )}
    >
      {content}
      <span className="sr-only">MENSALERE home</span>
    </Link>
  );
}
