import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { StickyCta } from '../components/StickyCta';
import { routes } from '../lib/routes';
import { setAnalyticsContext, track } from '../lib/analytics';
import { readAttribution } from '../lib/attribution';

/**
 * Application shell.
 *
 * The homepage hero runs under a transparent header; every other page starts
 * below it. Scroll position resets on navigation but is preserved for
 * in-page anchors and for back/forward, which is what makes filtered
 * portfolio browsing bearable.
 */
export function Layout() {
  const location = useLocation();
  const overHero = location.pathname === routes.home;

  useEffect(() => {
    const attribution = readAttribution();
    setAnalyticsContext({
      path: location.pathname + location.search,
      source: attribution.source,
      campaign: attribution.campaign,
      landing: attribution.landing,
    });
    track('page_viewed', { path: location.pathname });
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header overHero={overHero} />
      <main id="main" className={overHero ? '' : 'pt-[var(--header-h)]'}>
        <Outlet />
      </main>
      <Footer />
      <StickyCta />
    </div>
  );
}

/**
 * Scroll management. React Router does not reset scroll on navigation, and a
 * portfolio page that opens halfway down is disorienting. Hash targets and
 * POP navigation (back button) are left alone.
 */
export function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      let target: Element | null = null;
      try {
        target = document.querySelector(location.hash);
      } catch {
        target = null;
      }
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);

  return null;
}
