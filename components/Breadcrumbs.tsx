import Link from 'next/link';

export type Crumb = {
  name: string;
  /** Omitted on the current page, which is rendered as plain text. */
  href?: string;
};

/**
 * A subtle breadcrumb trail. Deliberately quiet — the same muted small text
 * the rest of the page chrome uses — because it is orientation, not
 * navigation furniture competing with the navbar.
 *
 * Labels are passed in already translated so this stays a plain component that
 * either a server or a client page can render.
 */
export default function Breadcrumbs({
  items,
  label,
  className,
}: {
  items: Crumb[];
  /** Accessible name for the landmark, e.g. "Breadcrumb". */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ol className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground'>
        {items.map((item, index) => (
          <li key={item.name} className='flex items-center gap-x-2'>
            {index > 0 && (
              <span aria-hidden='true' className='text-muted-foreground/40'>
                /
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className='hover:text-foreground transition-colors duration-200'
              >
                {item.name}
              </Link>
            ) : (
              <span aria-current='page' className='text-foreground/70'>
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
