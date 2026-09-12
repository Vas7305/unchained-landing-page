import { useEffect, useState } from 'react';
import { bookingLink } from '../lib/routes';
import { track } from '../lib/analytics';
import { useCtaTarget } from '../app/CtaContext';
import { ButtonLink } from './Button';
import { business, placeholders } from '../data';
import { phoneHref } from '../lib/format';

/**
 * Persistent mobile booking bar.
 *
 * Appears once the visitor has scrolled past the first screen — showing it
 * immediately would cover the hero it is supposed to support. Desktop does not
 * get one: the header CTA is always visible there.
 */
export function StickyCta() {
  const target = useCtaTarget();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVisible(window.scrollY > 420));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  if (target.hidden) return null;

  return (
    <div
      className={[
        // Pinned during route transitions alongside the header — see
        // styles/transitions.css.
        'sticky-cta-anchor',
        'fixed inset-x-0 bottom-0 z-70 border-t border-lk-line bg-lk-paper/95 backdrop-blur-md lg:hidden',
        'transition-transform duration-300 ease-[var(--ease-lk-editorial)]',
        'pb-[env(safe-area-inset-bottom)]',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      <div className="lk-shell flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="lk-type-small truncate font-medium">{target.label}</p>
          {target.detail && <p className="lk-type-meta truncate text-lk-muted">{target.detail}</p>}
        </div>

        {business.phone ? (
          <a
            href={phoneHref(business.phone)}
            onClick={() => track('phone_clicked', { surface: 'sticky' })}
            aria-label={`Позвонить ${business.phone}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lk-xs border border-lk-line-strong"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <path
                d="M4.5 3h3l1.5 3.5-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2L17 12.5v3a1.5 1.5 0 0 1-1.6 1.5C9 16.6 3.4 11 3 4.6A1.5 1.5 0 0 1 4.5 3z"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ) : (
          <span className="lk-type-meta shrink-0 text-lk-muted">{placeholders.phone}</span>
        )}

        <ButtonLink
          to={bookingLink({
            service: target.serviceSlug,
            specialist: target.specialist,
            from: target.from,
          })}
          size="md"
          className="shrink-0"
          onClick={() =>
            track('booking_started', { from: target.from, service: target.serviceSlug ?? null })
          }
        >
          Записаться
        </ButtonLink>
      </div>
    </div>
  );
}
