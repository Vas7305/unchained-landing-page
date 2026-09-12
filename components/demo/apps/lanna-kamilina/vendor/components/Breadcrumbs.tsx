import { Link } from './AppLink';
import { cn } from '../lib/utils';

export interface Crumb {
  name: string;
  path?: string;
}

/** Orientation for deep-linked arrivals — most visitors do not land on the homepage. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Хлебные крошки" className={cn('lk-type-meta text-lk-muted', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.path ?? item.name} className="flex items-center gap-2">
              {item.path && !last ? (
                <Link to={item.path} className="transition-colors hover:text-lk-ink">
                  {item.name}
                </Link>
              ) : (
                <span className={cn(last && 'text-lk-ink-2')} aria-current={last ? 'page' : undefined}>
                  {item.name}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-lk-line-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 border border-dashed border-lk-line-strong px-6 py-14 text-center',
        className,
      )}
    >
      <p className="lk-type-subtitle">{title}</p>
      {body && <p className="lk-type-body max-w-md text-lk-muted">{body}</p>}
      {action}
    </div>
  );
}
