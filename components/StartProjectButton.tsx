'use client';

import {
  useCommercialRouting,
  type CtaSource,
} from '@/lib/commercial/RoutingProvider';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import { track } from '@/lib/analytics';

/**
 * Every "Start a Project" on the site.
 *
 * §52: there is exactly one of these, so there is no CTA left pointing at the
 * old Cal.com redirect and no way to add one by accident — a new CTA either
 * uses this component or it is not a project inquiry.
 *
 * ─── Why className and children rather than variants ──────────────────────
 * These buttons already exist, in five places, each with its own size, weight,
 * shadow and trailing icon that belong to the section around them. Replacing
 * that with a fixed set of variants would mean either restyling five sections
 * — a redesign, which §54 rules out — or inventing five variants that are each
 * used once, which is a lookup table pretending to be an abstraction.
 *
 * So the caller keeps its own appearance and this component owns the parts
 * that must not vary: it is a real <button>, it announces that it opens a
 * dialog, it fires both the existing funnel event and the new attribution
 * event, and it opens the one shared panel.
 */
export default function StartProjectButton({
  source,
  detail,
  onOpened,
  className,
  children,
}: {
  source: CtaSource;
  /** Extra attribution, e.g. which engagement card was pressed. */
  detail?: string;
  /**
   * Housekeeping the surrounding section owes itself once the panel is up —
   * the mobile navigation uses it to close the menu that would otherwise stay
   * open behind the dialog. Not a place for anything the panel depends on.
   */
  onOpened?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const { startProject } = useCommercialRouting();
  const t = useTranslation();

  return (
    <button
      type='button'
      // Not aria-expanded: the dialog is not owned by this button — five of
      // them open the same one — and a controls relationship to an element
      // that does not exist until it opens would be a broken reference.
      aria-haspopup='dialog'
      onClick={() => {
        // The event this site has always fired, with the property name and the
        // values it has always used, so the existing funnel keeps counting
        // across the change (§54).
        track('start_project_click', { location: source });
        startProject(source, detail);
        onOpened?.();
      }}
      className={className}
    >
      {children ?? t('nav.startProject')}
    </button>
  );
}
