import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

/** SSR-safe media query subscription. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Locks background scroll while an overlay is open, preserving scrollbar width. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [active]);
}

/** Fires once the page has scrolled past `offset` — drives the compact header. */
export function useScrolledPast(offset = 24): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPast(window.scrollY > offset));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [offset]);

  return past;
}

/** Escape-to-close, shared by the mobile menu and every dialog. */
export function useEscape(active: boolean, onEscape: () => void): void {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    },
    [onEscape],
  );

  useEffect(() => {
    if (!active) return;
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, handler]);
}

/** Pointer-outside-to-close, shared by every popover. */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = ref.current;
      if (node && !node.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref, active, onOutside]);
}
