'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/** Fires a view event once when a project detail page mounts. */
export default function ProjectViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (slug === 'tancerca') {
      track('tancerca_view', { slug });
    }
    track('project_click', { project: slug, source: 'detail_view' });
  }, [slug]);

  return null;
}
