'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

const THRESHOLDS = [25, 50, 75, 100];

/**
 * Fires a `scroll_depth` event once per threshold per page view.
 * Passive listener + rAF throttle so it never competes with the scroll
 * animations for frame budget.
 */
export default function ScrollDepth({ page }: { page: string }) {
  useEffect(() => {
    const reached = new Set<number>();
    let ticking = false;

    const measure = () => {
      ticking = false;

      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const percent = ((window.scrollY + window.innerHeight) / (scrollable + window.innerHeight)) * 100;

      for (const threshold of THRESHOLDS) {
        if (percent >= threshold && !reached.has(threshold)) {
          reached.add(threshold);
          track('scroll_depth', { page, depth: threshold });
        }
      }

      if (reached.size === THRESHOLDS.length) {
        window.removeEventListener('scroll', onScroll);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    measure();

    return () => window.removeEventListener('scroll', onScroll);
  }, [page]);

  return null;
}
