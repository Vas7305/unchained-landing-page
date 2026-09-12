import { useCallback } from 'react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type { To } from 'react-router-dom';
import { navPosition } from '../lib/routes';
import { awaitCommit } from '../app/routeTransitionState';

/**
 * Internal links that carry the page out sideways.
 *
 * These stand in for `Link` and `NavLink` from react-router and take exactly
 * the same props, so every call site keeps the markup it already had and only
 * its import changes. Making the *primitive* directional rather than adding a
 * prop at each of the site's link call sites is what stops the motion from
 * being something a new link has to remember to opt into.
 *
 * The direction comes from where the two paths sit in the site's route order,
 * so every link agrees with every other one and no caller has to know which
 * way "forward" is from wherever it happens to be rendered.
 *
 * Anything this cannot drive — no View Transitions support, reduced motion, a
 * modified click, a new tab, an off-site href — falls straight through to
 * react-router's own behaviour, so the link is never worse than an ordinary
 * one.
 */

/** Set on <html> for the length of the transition; the CSS selects on it. */
const DIRECTION_ATTRIBUTE = 'data-nav-direction';

/**
 * DEMO DIVERGENCE — the product animates navigation with a View Transition,
 * which snapshots the WHOLE document. Inside a demo panel that would slide
 * this website sideways, header and all, because the transition belongs to the
 * page rather than to the panel.
 *
 * Switching it off here takes the path the product already has for browsers
 * without the API — a plain react-router navigation — which is why nothing
 * else in this file changes, and why the product's `transitions.css` is not
 * vendored at all.
 */
const VIEW_TRANSITIONS_AVAILABLE = false;

/**
 * The pathname a `To` will land on. Query and hash are deliberately dropped:
 * they decide *what* the page shows, never where it sits in the site, and a
 * filtered portfolio view is not a journey to somewhere else.
 */
function pathOf(to: To): string {
  if (typeof to === 'string') return to.split(/[?#]/)[0];
  return to.pathname ?? '';
}

function useDirectionalClick(
  to: To,
  onClick?: React.MouseEventHandler<HTMLAnchorElement>,
): React.MouseEventHandler<HTMLAnchorElement> {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      // Never take over a click the visitor meant for the browser: new tab,
      // new window, download, or a non-primary button.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.currentTarget.target;
      if (target && target !== '_self') return;

      if (!VIEW_TRANSITIONS_AVAILABLE) return;
      if (typeof document.startViewTransition !== 'function') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const destination = pathOf(to);
      // Off-site, or a `to` with no pathname of its own — not ours to animate.
      if (!destination.startsWith('/')) return;
      // Same page: there is no travel to animate. Changing only the query —
      // a portfolio filter, a service category — lands here too, and should:
      // the page is being refined, not left.
      if (destination === pathname) return;

      event.preventDefault();

      const root = document.documentElement;
      const direction =
        navPosition(destination) < navPosition(pathname) ? 'back' : 'forward';
      root.setAttribute(DIRECTION_ATTRIBUTE, direction);

      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            awaitCommit(resolve);
            navigate(to);
          }),
      );

      const clear = () => root.removeAttribute(DIRECTION_ATTRIBUTE);
      transition.finished.then(clear, clear);
    },
    [navigate, onClick, pathname, to],
  );
}

export function Link({ to, onClick, ...rest }: React.ComponentProps<typeof RouterLink>) {
  const handleClick = useDirectionalClick(to, onClick);
  return <RouterLink to={to} onClick={handleClick} {...rest} />;
}

export function NavLink({ to, onClick, ...rest }: React.ComponentProps<typeof RouterNavLink>) {
  const handleClick = useDirectionalClick(to, onClick);
  return <RouterNavLink to={to} onClick={handleClick} {...rest} />;
}
