import { cn } from '../lib/utils';

/** Small uppercase label that sits above a heading and names the section. */
export function Eyebrow({
  children,
  className,
  tone = 'muted',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'muted' | 'accent' | 'paper';
}) {
  return (
    <span
      className={cn(
        'lk-type-eyebrow block',
        tone === 'muted' && 'text-lk-muted',
        tone === 'accent' && 'text-lk-accent',
        tone === 'paper' && 'text-lk-paper/70',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Section header: eyebrow, title, optional lead and an optional trailing
 * action that drops below the title on narrow screens instead of squeezing it.
 */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  action,
  align = 'left',
  tone = 'ink',
  as: Tag = 'h2',
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: 'ink' | 'paper';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center md:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && (
          <Eyebrow tone={tone === 'paper' ? 'paper' : 'muted'} className="mb-4">
            {eyebrow}
          </Eyebrow>
        )}
        <Tag className={cn('lk-type-display', tone === 'paper' && 'text-lk-paper')}>{title}</Tag>
        {lead && (
          <p
            className={cn(
              'lk-type-lead mt-5',
              tone === 'paper' ? 'text-lk-paper/75' : 'text-lk-ink-2',
            )}
          >
            {lead}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 md:pb-2">{action}</div>}
    </div>
  );
}

/** Constrained measure for long-form copy. */
export function Prose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('lk-type-body max-w-[var(--container-lk-text)] text-lk-ink-2', className)}>
      {children}
    </div>
  );
}
