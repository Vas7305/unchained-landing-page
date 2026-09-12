import { useCallback, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { business, mapUrls, placeholders } from '../data';
import { formatPhone, phoneHref, telegramHref, whatsappHref } from '../lib/format';
import { track } from '../lib/analytics';
import type { AnalyticsEvent } from '../lib/analytics';
import { useEscape, useOutsideClick } from '../hooks/useUi';
import { PlaceholderToken } from './Meta';

/**
 * Contact channels.
 *
 * Each channel renders as a real link when the salon has supplied the value,
 * and as a visible placeholder token when it has not — never as an invented
 * number. Every channel reports its own analytics event, since "clicked
 * Telegram" and "clicked phone" are different intents.
 */

interface ChannelProps {
  label: string;
  value: string | null;
  placeholder: string;
  href?: string;
  event: AnalyticsEvent;
  surface: string;
  display?: string;
  className?: string;
  external?: boolean;
}

function Channel({
  label,
  value,
  placeholder,
  href,
  event,
  surface,
  display,
  className,
  external,
}: ChannelProps) {
  if (!value) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <span className="lk-type-meta text-lk-muted uppercase">{label}</span>
        <PlaceholderToken>{placeholder}</PlaceholderToken>
      </div>
    );
  }

  // A real value with no link yet — the text still belongs on the page.
  if (!href) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <span className="lk-type-meta text-lk-muted uppercase">{label}</span>
        <span className="lk-type-body">{display ?? value}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="lk-type-meta text-lk-muted uppercase">{label}</span>
      <a
        href={href}
        onClick={() => track(event, { surface })}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="lk-type-body w-fit border-b border-lk-line-strong pb-0.5 transition-colors hover:border-lk-ink"
      >
        {display ?? value}
      </a>
    </div>
  );
}

export function ContactChannels({
  surface,
  className,
  layout = 'stack',
}: {
  surface: string;
  className?: string;
  layout?: 'stack' | 'grid';
}) {
  return (
    <div
      className={cn(
        layout === 'grid'
          ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'
          : 'flex flex-col gap-5',
        className,
      )}
    >
      <Channel
        label="Телефон"
        value={business.phone}
        placeholder={placeholders.phone}
        href={business.phone ? phoneHref(business.phone) : undefined}
        display={business.phone ? formatPhone(business.phone) : undefined}
        event="phone_clicked"
        surface={surface}
      />
      <Channel
        label="Telegram"
        value={business.telegram}
        placeholder={placeholders.telegram}
        href={business.telegram ? telegramHref(business.telegram) : undefined}
        event="telegram_clicked"
        surface={surface}
        external
      />
      <Channel
        label="WhatsApp"
        value={business.whatsapp}
        placeholder={placeholders.whatsapp}
        href={business.whatsapp ? whatsappHref(business.whatsapp) : undefined}
        display={business.whatsapp ? formatPhone(business.whatsapp) : undefined}
        event="whatsapp_clicked"
        surface={surface}
        external
      />
      <div className="flex flex-col gap-1.5">
        <span className="lk-type-meta text-lk-muted uppercase">Адрес</span>
        <AddressChooser surface={surface} triggerClassName="lk-type-body" />
      </div>
    </div>
  );
}

/**
 * Address chooser.
 *
 * A click on the address has two right answers in Moscow — Yandex Maps and
 * 2GIS — and a browser can only follow one link per click, so the address
 * opens a small menu instead of guessing. The trigger inherits its colour from
 * the surrounding text so it reads correctly on the dark footer as well; the
 * panel forces its own palette back, since surfaces that restyle their links
 * would otherwise bleach it.
 */
export function AddressChooser({
  surface,
  className,
  triggerClassName,
}: {
  surface: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEscape(open, close);
  useOutsideClick(containerRef, open, close);

  const options = [
    { label: 'Яндекс Карты', href: mapUrls.yandex },
    { label: '2ГИС', href: mapUrls.twoGis },
  ].filter((option): option is { label: string; href: string } => Boolean(option.href));

  if (!business.address) {
    return (
      <PlaceholderToken className={cn(className, triggerClassName)}>
        {placeholders.address}
      </PlaceholderToken>
    );
  }

  // No map link at all — the address is still worth showing as text.
  if (!options.length) {
    return <span className={cn(className, triggerClassName)}>{business.address}</span>;
  }

  return (
    <div ref={containerRef} className={cn('relative w-fit', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'w-fit cursor-pointer border-b border-current/30 pb-0.5 text-left transition-colors hover:border-current',
          triggerClassName,
        )}
      >
        {business.address}
        <span className="sr-only"> — открыть на карте</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Открыть адрес на карте"
          className="absolute top-full left-0 z-50 mt-2 min-w-[12rem] border border-lk-line bg-lk-paper shadow-[0_12px_32px_-12px_rgba(0,0,0,0.28)]"
        >
          {options.map((option, index) => (
            <a
              key={option.label}
              role="menuitem"
              href={option.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                track('map_clicked', { surface, platform: option.label });
                close();
              }}
              className={cn(
                'flex items-center justify-between gap-6 px-4 py-3 text-[0.8125rem] text-lk-ink! transition-colors hover:bg-lk-ink/[0.05]',
                index > 0 && 'border-t border-lk-line!',
              )}
            >
              {option.label}
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 shrink-0 text-lk-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                aria-hidden="true"
              >
                <path d="M6 3h7v7M13 3L3.5 12.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Opening hours. Rows without real times render the placeholder, not "0:00". */
export function OpeningHoursList({ className }: { className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-2', className)}>
      {business.openingHours.map((entry) => (
        <div key={entry.label} className="flex items-baseline justify-between gap-6">
          <dt className="lk-type-small text-lk-muted">{entry.label}</dt>
          <dd className="lk-type-small lk-numeric">
            {entry.opens && entry.closes ? (
              `${entry.opens} – ${entry.closes}`
            ) : (
              <PlaceholderToken>{placeholders.hours}</PlaceholderToken>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Map platform links — Yandex and 2GIS are how Moscow actually navigates. */
/** Both entries are constants — neither depends on a prop or on state. */
const MAP_LINKS = [
  { label: 'Яндекс Карты', href: mapUrls.yandex, token: placeholders.maps },
  { label: '2ГИС', href: mapUrls.twoGis, token: placeholders.maps },
];

export function MapLinks({ surface, className }: { surface: string; className?: string }) {
  const links = MAP_LINKS;

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {links.map((link) =>
        link.href ? (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('map_clicked', { surface, platform: link.label })}
            className="inline-flex h-10 items-center rounded-lk-xs border border-lk-line-strong px-4 text-[0.8125rem] transition-colors hover:border-lk-ink"
          >
            {link.label}
          </a>
        ) : (
          <span
            key={link.label}
            className="inline-flex h-10 items-center gap-2 rounded-lk-xs border border-dashed border-lk-line-strong px-4 text-[0.8125rem] text-lk-muted"
          >
            {link.label}
            <span className="lk-type-meta">{link.token}</span>
          </span>
        ),
      )}
    </div>
  );
}
