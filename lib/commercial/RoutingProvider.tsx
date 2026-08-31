'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { track } from '@/lib/analytics';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { detectCountry } from './countryDetection';
import { resolveCommercial, type RoutingOutcome } from './resolver';

/**
 * The state behind "Start a Project".
 *
 * One provider, mounted once in the root layout, so that every CTA on every
 * page opens the same panel and shares the same resolved answer (§26, §35).
 * The alternative — each button owning its own state — would ask the resolver
 * again for each CTA a visitor happens to press, and could show two different
 * representatives on one page.
 *
 * ─── The flow, in order (§10) ─────────────────────────────────────────────
 *   1. a CTA calls `startProject(source)`
 *   2. the panel opens immediately, in its resolving state (§29 — the click is
 *      never left hanging while a network request decides what to render)
 *   3. country is detected
 *   4. language is read from the existing i18n locale — not detected again
 *   5. the resolver is asked
 *   6. one representative, or the global fallback, is displayed
 *
 * Steps 3-5 run in an effect keyed on the locale, which is what makes §27
 * true: switching English → Russian while the panel is open re-asks the
 * question in Russian rather than keeping an answer that was chosen for a
 * different language.
 */

/**
 * Which CTA started this. Analytics only (§35) — the resolver never sees it,
 * and no routing rule may ever depend on it.
 */
export type CtaSource =
  | 'hero'
  | 'navbar'
  | 'navbar_mobile'
  | 'cta'
  | 'engagements'
  | 'pillar'
  | 'journey'
  | 'work'
  | 'project';

interface RoutingContextValue {
  /** Open the contact panel and resolve the visitor's representative. */
  startProject: (source: CtaSource, detail?: string) => void;
  close: () => void;
  isOpen: boolean;
  /** null while resolving. */
  outcome: RoutingOutcome | null;
}

const RoutingContext = createContext<RoutingContextValue | null>(null);

export function CommercialRoutingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = useLanguage();
  const [source, setSource] = useState<CtaSource | null>(null);
  /**
   * The answer, stamped with the language it was asked in.
   *
   * Stored that way, rather than cleared when the language changes, so that
   * "we do not yet have an answer for the language on screen" is DERIVED
   * below instead of being a second piece of state an effect has to remember
   * to reset. The wrong version of this — clearing on change — is the bug
   * where a Russian visitor briefly sees the representative chosen for
   * English, and it is unreachable here by construction.
   */
  const [resolved, setResolved] = useState<{
    language: string;
    outcome: RoutingOutcome;
  } | null>(null);

  const isOpen = source !== null;
  const outcome = resolved?.language === locale ? resolved.outcome : null;

  const startProject = useCallback((next: CtaSource, detail?: string) => {
    // §35: the CTA's context is preserved for attribution and goes no further.
    track('project_cta_clicked', {
      cta_source: next,
      ...(detail ? { detail } : {}),
    });
    setSource(next);
  }, []);

  const close = useCallback(() => setSource(null), []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    void (async () => {
      const { country } = await detectCountry();
      const result = await resolveCommercial(country, locale);
      if (cancelled) return;

      setResolved({ language: locale, outcome: result });

      // §34: language and whether a country was determined at all. Never the
      // country itself, never the representative's name or any channel value —
      // an analytics provider has no business holding either.
      if (result.kind === 'commercial') {
        track('commercial_routing_success', {
          language: locale,
          country_known: country !== null,
          channels: result.commercial.channels.length,
        });
      } else {
        track('commercial_routing_fallback', {
          language: locale,
          country_known: country !== null,
          reason: result.reason,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, locale]);

  const value = useMemo<RoutingContextValue>(
    () => ({ startProject, close, isOpen, outcome }),
    [startProject, close, isOpen, outcome],
  );

  return (
    <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>
  );
}

export function useCommercialRouting(): RoutingContextValue {
  const ctx = useContext(RoutingContext);
  if (!ctx) {
    throw new Error(
      'useCommercialRouting must be used inside a <CommercialRoutingProvider>',
    );
  }
  return ctx;
}
