'use client';

import { Dialog } from 'radix-ui';
import {
  CalendarClock,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import { track } from '@/lib/analytics';
import { useCommercialRouting } from '@/lib/commercial/RoutingProvider';
import type { Channel, ChannelKind } from '@/lib/commercial/channels';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * What the visitor sees after pressing "Start a Project".
 *
 * ─── Why a dialog and not a redirect ──────────────────────────────────────
 * §15: the visitor is not thrown into an external application. They are shown
 * who will read their message and given the choice of how to say it. The panel
 * answers the only two questions a prospective client actually has at this
 * moment (§16) — "who will I speak with?" and "how do I reach them?" — and it
 * answers them in customer-facing language. No routing rule, priority,
 * assignment, region or identifier appears anywhere on this screen, because
 * none of that is the visitor's business or interest.
 *
 * ─── Accessibility (§36) ──────────────────────────────────────────────────
 * Radix's Dialog supplies the parts that are easy to get wrong: focus moves
 * into the panel on open and back to the CTA that opened it on close, focus is
 * trapped while it is open, Escape closes it, the rest of the page is inert
 * and `aria-hidden`, and Title/Description are wired to `aria-labelledby` and
 * `aria-describedby` rather than guessed at.
 *
 * What is left is this file's responsibility, and is done here: every channel
 * is a real link with visible text (never an unlabelled icon), the whole card
 * is NOT one clickable region, the resolving state is announced through a live
 * region rather than only spun at, the close control has a text label, and the
 * site-wide `:focus-visible` outline is inherited rather than suppressed.
 *
 * ─── SEO (§39, §40) ───────────────────────────────────────────────────────
 * Nothing here is prerendered. The panel mounts only on interaction, so no
 * representative's name, number or address appears in the static export, in
 * the sitemap or in any crawlable page — and no per-representative route
 * exists to be crawled.
 */

const CHANNEL_META: Record<
  ChannelKind,
  { label: TranslationKey; icon: LucideIcon; external: boolean }
> = {
  whatsapp: { label: 'contact.whatsapp', icon: MessageCircle, external: true },
  telegram: { label: 'contact.telegram', icon: Send, external: true },
  calcom: { label: 'contact.scheduleCall', icon: CalendarClock, external: true },
  // A mailto: is handed to the mail client, not to a page. Opening it in a new
  // tab leaves an empty one behind on every desktop browser (§43).
  email: { label: 'contact.email', icon: Mail, external: false },
};

/**
 * One channel.
 *
 * `emphasis` is what §17 and §44 ask for: the first available channel is the
 * most direct one that exists for this person, so it is the one that reads as
 * the primary action — on a phone, that is almost always WhatsApp, one tap
 * from the panel opening.
 */
function ChannelLink({
  channel,
  emphasis,
}: {
  channel: Channel;
  emphasis: 'primary' | 'secondary';
}) {
  const { t } = useLanguage();
  const { label, icon: Icon, external } = CHANNEL_META[channel.kind];

  return (
    <a
      href={channel.href}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : undefined)}
      onClick={() => {
        track('contact_channel_clicked', { channel: channel.kind });
        // The booking event this site already fired, kept alive now that the
        // booking link is one channel among several rather than the CTA (§54).
        if (channel.kind === 'calcom') {
          track('booking_cta_click', { location: 'contact_panel' });
        }
      }}
      // min-h-12 rather than a tap-target utility: 48px is the comfortable
      // minimum on a phone, and these are the buttons §44 wants frictionless.
      className={`inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-5 text-sm font-semibold transition-colors duration-200 ${
        emphasis === 'primary'
          ? 'bg-foreground text-background hover:bg-foreground/90'
          : 'bg-secondary text-foreground hover:bg-accent glow-border'
      }`}
    >
      <Icon size={16} aria-hidden='true' />
      {t(label)}
      {external && <span className='sr-only'> — {t('contact.newTab')}</span>}
    </a>
  );
}

function Channels({ channels }: { channels: readonly Channel[] }) {
  return (
    <div className='grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2'>
      {channels.map((channel, index) => (
        <ChannelLink
          key={channel.kind}
          channel={channel}
          emphasis={index === 0 ? 'primary' : 'secondary'}
        />
      ))}
    </div>
  );
}

/**
 * The three states, and only three.
 *
 * §22 and §30 both resolve to the same fallback screen: an unrouted country, a
 * region with nobody active, a timeout, a 500 and an unconfigured build are
 * indistinguishable here, deliberately. "Commercial routing failed" is not a
 * sentence a prospective client should ever read, and the difference between
 * those causes is an operational concern that reaches the team through
 * analytics instead.
 */
function PanelBody() {
  const { t } = useLanguage();
  const { outcome } = useCommercialRouting();

  if (outcome === null) {
    return (
      <div
        className='flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground'
        // The panel opens instantly and this replaces itself when the answer
        // arrives; a screen reader is told, rather than left in silence (§29).
        role='status'
        aria-live='polite'
      >
        <Loader2 size={16} aria-hidden='true' className='animate-spin' />
        {t('contact.loading')}
      </div>
    );
  }

  if (outcome.kind === 'commercial') {
    const { name, role, channels } = outcome.commercial;

    return (
      <div className='flex flex-col items-center gap-6'>
        <div className='flex flex-col items-center gap-1.5 text-center'>
          <span className='text-[11px] font-medium uppercase tracking-widest text-muted-foreground'>
            {t('contact.regionalContact')}
          </span>
          {/* The name and the role come from the database and are shown as
              stored — they are this person's, not ours to translate. */}
          <span className='text-xl font-bold text-foreground'>{name}</span>
          {role && (
            <span className='text-sm text-muted-foreground'>{role}</span>
          )}
        </div>

        <Channels channels={channels} />
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center gap-6'>
      <div className='flex flex-col items-center gap-2 text-center'>
        <p className='text-sm text-foreground'>{t('contact.unavailable')}</p>
        <p className='text-sm text-muted-foreground'>{t('contact.fallback')}</p>
      </div>

      {outcome.channels.length > 0 ? (
        <Channels channels={outcome.channels} />
      ) : (
        // Nothing configured anywhere. Saying so plainly beats a button that
        // goes nowhere, and §22 forbids inventing a contact to fill the gap.
        <p className='text-center text-sm text-muted-foreground'>
          {t('contact.noChannels')}
        </p>
      )}
    </div>
  );
}

export default function CommercialContactPanel() {
  const { t } = useLanguage();
  const { isOpen, close } = useCommercialRouting();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(next) => next || close()}>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 z-90 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0' />

        <Dialog.Content className='fixed left-1/2 top-1/2 z-100 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-7 overflow-y-auto rounded-3xl bg-card p-7 shadow-2xl glow-border sm:p-9 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'>
          <Dialog.Close
            aria-label={t('contact.close')}
            className='absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground'
          >
            <X size={17} aria-hidden='true' />
          </Dialog.Close>

          <div className='flex flex-col gap-2.5 pr-8 text-center'>
            <Dialog.Title className='text-2xl font-extrabold leading-tight tracking-tight gradient-text sm:text-3xl'>
              {t('contact.title')}
            </Dialog.Title>
            <Dialog.Description className='text-sm leading-relaxed text-muted-foreground'>
              {t('contact.subtitle')}
            </Dialog.Description>
          </div>

          <PanelBody />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
