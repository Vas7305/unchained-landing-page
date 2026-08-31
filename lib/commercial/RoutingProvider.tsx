'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { track } from '@/lib/analytics';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { detectCountry } from './countryDetection';
import { resolveCommercial, type RoutingOutcome } from './resolver';
import {
  newClientToken,
  recordChannelClick,
  sourceCta as ctaLabel,
  sourcePage,
  submitInquiry,
  type InquiryDraft,
  type InquiryResult,
} from './leads';
import type { ChannelKind } from './channels';

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
 *
 * ─── What Phase 7 added ───────────────────────────────────────────────────
 * The same flow, plus a record of it. Steps 1-6 are untouched: the visitor
 * still reaches a real person in one click and is never asked for anything
 * first (§11). What is new is that the panel can now also CAPTURE the inquiry —
 * optionally, below the channels — and that a channel click made by someone who
 * did submit one is attached to their lead (§44).
 *
 * The country this provider already detects for routing is reused as the lead's
 * `country_code`, and the locale it already reads is reused as the lead's
 * `language`. Nothing about the visitor is detected twice, so the lead can
 * never disagree with the routing decision about where the visitor was or what
 * language they were reading (§12).
 */

/**
 * Which CTA started this. Analytics and attribution only (§35) — the resolver
 * never sees it, and no routing rule may ever depend on it.
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

/** Where the optional inquiry form is in its life. */
export type InquiryState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'failed'; result: Exclude<InquiryResult, { kind: 'sent' }> };

interface RoutingContextValue {
  /** Open the contact panel and resolve the visitor's representative. */
  startProject: (source: CtaSource, detail?: string) => void;
  close: () => void;
  isOpen: boolean;
  /** null while resolving. */
  outcome: RoutingOutcome | null;
  /** Submit the optional project inquiry. */
  submit: (draft: InquiryDraft) => void;
  inquiry: InquiryState;
  /** Record that the visitor pressed a contact channel. */
  noteChannelClick: (channel: ChannelKind) => void;
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

  const [inquiry, setInquiry] = useState<InquiryState>({ status: 'idle' });

  /**
   * The country the routing effect determined, kept so the inquiry records the
   * SAME value that chose the representative rather than detecting it again.
   */
  const countryRef = useRef<string | null>(null);

  /** Which CTA opened the panel, for `source_cta` (§12). */
  const ctaRef = useRef<string | null>(null);

  /**
   * This inquiry's idempotency token (§43).
   *
   * Created once, on the first submission attempt, and REUSED by every retry:
   * a visitor who presses Send twice because the first attempt timed out is
   * making one inquiry, and the server recognises it as one. Held in a ref
   * rather than in state because changing it must never re-render anything.
   */
  const tokenRef = useRef<string | null>(null);

  /**
   * The token of a lead that actually exists. Distinct from `tokenRef`, which
   * exists as soon as someone tries: a channel click may only be attached to a
   * lead the server confirmed, never to an attempt that failed (§44).
   */
  const leadTokenRef = useRef<string | null>(null);

  const isOpen = source !== null;
  const outcome = resolved?.language === locale ? resolved.outcome : null;

  const startProject = useCallback((next: CtaSource, detail?: string) => {
    // §35: the CTA's context is preserved for attribution and goes no further.
    track('project_cta_clicked', {
      cta_source: next,
      ...(detail ? { detail } : {}),
    });
    ctaRef.current = ctaLabel(next, detail);
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

      countryRef.current = country;
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

  const submit = useCallback(
    (draft: InquiryDraft) => {
      // A second press while the first is in flight is the same inquiry, and a
      // press after it succeeded is nothing at all. Both are refused here as
      // well as by the server's idempotency check — one round trip saved, and
      // the button cannot be made to queue five requests (§43).
      if (inquiry.status === 'sending' || inquiry.status === 'sent') return;

      tokenRef.current ??= newClientToken();
      const clientToken = tokenRef.current;

      setInquiry({ status: 'sending' });

      void (async () => {
        const result = await submitInquiry(draft, {
          country: countryRef.current,
          language: locale,
          page: sourcePage(
            typeof window === 'undefined' ? null : window.location.pathname,
          ),
          cta: ctaRef.current,
          clientToken,
        });

        if (result.kind === 'sent') {
          leadTokenRef.current = clientToken;
          setInquiry({ status: 'sent' });
          // §34, and the same discipline as the routing events: what was sent,
          // in what language, from which CTA — and nothing the visitor typed.
          // No name, no address, no company, no message.
          track('project_inquiry_submitted', {
            language: locale,
            country_known: countryRef.current !== null,
            ...(ctaRef.current ? { cta: ctaRef.current } : {}),
            has_service: draft.service !== '',
          });
        } else {
          setInquiry({ status: 'failed', result });
        }
      })();
    },
    [inquiry.status, locale],
  );

  /**
   * §19 and §47: this records a CLICK. It does not record a conversation, a
   * reply or a contact, and the event it writes is named for what it is.
   *
   * The analytics event fires for every visitor, exactly as it did in Phase 6.
   * The database write happens only for a visitor who submitted an inquiry,
   * because only they have a lead for it to belong to.
   */
  const noteChannelClick = useCallback((channel: ChannelKind) => {
    track('contact_channel_clicked', { channel });
    recordChannelClick(leadTokenRef.current, channel);
  }, []);

  const value = useMemo<RoutingContextValue>(
    () => ({
      startProject,
      close,
      isOpen,
      outcome,
      submit,
      inquiry,
      noteChannelClick,
    }),
    [startProject, close, isOpen, outcome, submit, inquiry, noteChannelClick],
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
