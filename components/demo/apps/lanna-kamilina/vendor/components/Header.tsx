import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NavLink } from './AppLink';
import { cn } from '../lib/utils';
import { bookingLink, primaryNav, routes } from '../lib/routes';
import { track } from '../lib/analytics';
import { useEscape, useScrollLock, useScrolledPast } from '../hooks/useUi';
import { business, placeholders } from '../data';
import { formatPhone, phoneHref } from '../lib/format';
import { ButtonLink } from './Button';
import { Logo } from './Logo';

/**
 * Site header.
 *
 * Over the homepage hero it is transparent and weightless; the moment the page
 * scrolls it acquires a surface so links stay legible over any content. The
 * booking action is present at every width — on mobile it lives in the sticky
 * bar rather than being buried in the menu.
 */
export function Header({ overHero = false }: { overHero?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolledPast(16);
  const location = useLocation();

  useScrollLock(menuOpen);
  useEscape(menuOpen, () => setMenuOpen(false));

  // The menu closes when the visitor navigates. Adjusting during render rather
  // than from an effect: an effect runs after the new page has painted, so the
  // menu stayed open over it for a frame — most visible on a slow phone, which
  // is the only place this menu exists.
  const [lastLocation, setLastLocation] = useState(location.key);
  if (lastLocation !== location.key) {
    setLastLocation(location.key);
    if (menuOpen) setMenuOpen(false);
  }

  const solid = scrolled || !overHero || menuOpen;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-200 focus:rounded-lk-xs focus:bg-lk-ink focus:px-4 focus:py-2 focus:text-lk-paper"
      >
        Перейти к содержимому
      </a>

      <header
        className={cn(
          // `site-header-anchor` holds the header still while a route slides
          // underneath it — see styles/transitions.css. It must stay a global
          // class: `view-transition-name` cannot be scoped or the matching
          // pseudo-element rules stop applying.
          'site-header-anchor',
          'fixed inset-x-0 top-0 z-90 transition-[background-color,border-color,box-shadow] duration-300',
          solid
            ? 'border-b border-lk-line bg-lk-paper/92 backdrop-blur-md'
            : 'border-b border-transparent bg-transparent',
        )}
        style={{ height: 'var(--header-h)' }}
      >
        <div className="lk-shell flex h-full items-center justify-between gap-6">
          <Logo />

          <nav aria-label="Основная навигация" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {primaryNav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => track('nav_clicked', { label: item.label, to: item.to })}
                    className={({ isActive }) =>
                      cn(
                        'relative py-2 text-[0.875rem] transition-colors duration-200',
                        'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-lk-ink after:transition-transform after:duration-300',
                        'hover:after:scale-x-100',
                        isActive ? 'text-lk-ink after:scale-x-100' : 'text-lk-ink-2 hover:text-lk-ink',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink
              to={bookingLink({ from: 'header' })}
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => track('booking_started', { from: 'header' })}
            >
              Забронировать
            </ButtonLink>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="-mr-2 flex h-11 w-11 items-center justify-center lg:hidden"
            >
              <span className="sr-only">{menuOpen ? 'Закрыть меню' : 'Открыть меню'}</span>
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
                {menuOpen ? (
                  <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                ) : (
                  <path d="M2 6h16M2 14h16" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      id="mobile-menu"
      className="lk-animate-fade fixed inset-0 z-80 flex flex-col bg-lk-paper pt-[var(--header-h)] lg:hidden"
    >
      <div className="lk-shell flex flex-1 flex-col overflow-y-auto py-8">
        <nav aria-label="Меню">
          <ul className="flex flex-col">
            {primaryNav.map((item, index) => (
              <li key={item.to} className="border-b border-lk-line">
                <NavLink
                  to={item.to}
                  onClick={() => {
                    track('nav_clicked', { label: item.label, to: item.to, surface: 'mobile' });
                    onClose();
                  }}
                  className="lk-animate-fade-up lk-type-title block py-4"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink
            to={bookingLink({ from: 'mobile-menu' })}
            size="lg"
            fullWidth
            onClick={() => {
              track('booking_started', { from: 'mobile-menu' });
              onClose();
            }}
          >
            Записаться онлайн
          </ButtonLink>
          <ButtonLink
            to={routes.discovery}
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onClose}
          >
            Подобрать образ
          </ButtonLink>
        </div>

        <div className="mt-auto pt-10">
          <p className="lk-type-meta mb-2 text-lk-muted uppercase">Связаться</p>
          {business.phone ? (
            <a
              href={phoneHref(business.phone)}
              onClick={() => track('phone_clicked', { surface: 'mobile-menu' })}
              className="lk-type-subtitle lk-numeric block"
            >
              {formatPhone(business.phone)}
            </a>
          ) : (
            <p className="lk-type-subtitle text-lk-muted">{placeholders.phone}</p>
          )}
        </div>
      </div>
    </div>
  );
}
