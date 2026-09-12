import type { BookingRequest } from '../../types';
import { ANY_SPECIALIST } from '../../types';
import {
  formatDayMonth,
  formatDuration,
  formatPrice,
  telegramHref,
  weekdayShort,
} from '../../lib/format';
import { business, getService, getSpecialist, IS_DEMO_CONTENT } from '../../data';

/**
 * BOOKING DELIVERY
 *
 * Until the salon has a booking system of its own, an appointment reaches a
 * human the way it always has here — as a message in a messenger, except the
 * visitor no longer has to type it. Two channels, because Moscow uses both and
 * a customer already has one of them open.
 *
 * WhatsApp accepts prefilled text in the link itself. Telegram does not: a
 * `t.me` link can only open the chat, so the request goes to the clipboard and
 * the visitor pastes it. That asymmetry is Telegram's, not ours, and the UI
 * says so rather than pretending both behave alike.
 */
export type DeliveryChannel = 'whatsapp' | 'telegram';

export const deliveryLabels: Record<DeliveryChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

/**
 * The message an administrator actually reads: what, with whom, when, and who
 * to call back. The date is spelled out rather than shown as «сегодня»,
 * because the message is read later than it is sent.
 */
export function bookingMessage(request: BookingRequest, reference: string): string {
  const service = getService(request.serviceId);
  const specialist =
    request.specialist === ANY_SPECIALIST ? null : getSpecialist(request.specialist);

  const lines = [
    'Здравствуйте! Заявка на запись — Lanna Kamilina.',
    '',
    `Заявка: ${reference}`,
    `Услуга: ${service?.title ?? '—'}`,
    `Мастер: ${specialist?.name ?? 'без предпочтения'}`,
    `Когда: ${weekdayShort(request.date)}, ${formatDayMonth(request.date)}, ${request.time}`,
  ];

  if (service) {
    lines.push(`Длительность: ${formatDuration(service.duration)}`);
    // Demo prices are illustrative — quoting one to the salon would invent a deal.
    if (!IS_DEMO_CONTENT) lines.push(`Стоимость: ${formatPrice(service.price)}`);
  }

  lines.push('', `Имя: ${request.name}`, `Телефон: ${request.phone}`);
  if (request.comment) lines.push(`Комментарий: ${request.comment}`);

  return lines.join('\n');
}

/**
 * `https://wa.me/<digits>?text=…` — opens the chat with the request typed but
 * unsent, so the visitor stays in control of what leaves their phone.
 * `null` when the salon has no WhatsApp number: there is nowhere to deliver to.
 */
export function bookingWhatsappHref(
  request: BookingRequest,
  reference: string,
  number: string | null = business.whatsapp,
): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(bookingMessage(request, reference))}`;
}

/**
 * The salon's Telegram chat. No prefilled text is possible for a normal
 * account, so the caller copies the message instead — see `bookingHandoff`.
 * `null` when the salon has no Telegram: there is nowhere to deliver to.
 */
export function bookingTelegramHref(handle: string | null = business.telegram): string | null {
  return handle ? telegramHref(handle) : null;
}

/** Where a booking can be sent right now — a channel with no account is not offered. */
export function availableChannels(): DeliveryChannel[] {
  const channels: DeliveryChannel[] = [];
  if (business.whatsapp) channels.push('whatsapp');
  if (business.telegram) channels.push('telegram');
  return channels;
}

export interface BookingHandoff {
  channel: DeliveryChannel;
  href: string;
  message: string;
  /** Telegram cannot carry the text in the link — the visitor pastes it. */
  requiresPaste: boolean;
}

/** Everything a caller needs to hand one booking to one channel. */
export function bookingHandoff(
  request: BookingRequest,
  reference: string,
  channel: DeliveryChannel,
): BookingHandoff | null {
  const message = bookingMessage(request, reference);
  const href =
    channel === 'whatsapp' ? bookingWhatsappHref(request, reference) : bookingTelegramHref();

  if (!href) return null;
  return { channel, href, message, requiresPaste: channel === 'telegram' };
}
