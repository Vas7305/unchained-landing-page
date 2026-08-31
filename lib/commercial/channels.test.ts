import { describe, expect, it } from 'vitest';
import {
  bookingHref,
  contactChannels,
  emailHref,
  telegramHref,
  whatsappHref,
} from './channels';

/**
 * These tests exist because every one of these values arrives from outside
 * (§42) and each builder's failure mode is a link that looks fine and goes
 * somewhere wrong — an empty WhatsApp chat, a t.me 404, a mailto that never
 * opens. A regression here is invisible until a lead is lost, so the shapes
 * are pinned rather than eyeballed.
 */

describe('whatsappHref', () => {
  it('drops the plus, because wa.me does not take one', () => {
    expect(whatsappHref('+79991234567')).toBe('https://wa.me/79991234567');
  });

  it('tolerates surrounding whitespace from the stored value', () => {
    expect(whatsappHref('  +34600123456  ')).toBe('https://wa.me/34600123456');
  });

  it('refuses a number with no country code rather than guessing one', () => {
    // Guessing a '+' here would produce a link that dials a stranger.
    expect(whatsappHref('79991234567')).toBeNull();
  });

  it('refuses malformed, empty and absent values', () => {
    expect(whatsappHref('+7 999 123 45 67')).toBeNull(); // never normalised here
    expect(whatsappHref('+0123456789')).toBeNull(); // no country code starts 0
    expect(whatsappHref('+123')).toBeNull(); // too short for E.164
    expect(whatsappHref('')).toBeNull();
    expect(whatsappHref(null)).toBeNull();
    expect(whatsappHref(undefined)).toBeNull();
  });
});

describe('telegramHref', () => {
  it('builds t.me from the bare stored handle', () => {
    expect(telegramHref('alex_unchained')).toBe('https://t.me/alex_unchained');
  });

  it('refuses anything that is not a valid handle', () => {
    expect(telegramHref('@alex_unchained')).toBeNull(); // stored bare, not @
    expect(telegramHref('abc')).toBeNull(); // under Telegram's 5-char floor
    expect(telegramHref('has spaces')).toBeNull();
    expect(telegramHref('../../evil')).toBeNull();
    expect(telegramHref(null)).toBeNull();
  });
});

describe('emailHref', () => {
  it('builds a mailto', () => {
    expect(emailHref('alex@example.com')).toBe('mailto:alex@example.com');
  });

  it('refuses what is plainly not an address', () => {
    expect(emailHref('alex')).toBeNull();
    expect(emailHref('alex@example')).toBeNull();
    expect(emailHref('a b@example.com')).toBeNull();
    expect(emailHref(null)).toBeNull();
  });
});

describe('bookingHref', () => {
  it('uses the configured URL verbatim (§21: never constructed)', () => {
    expect(bookingHref('https://cal.com/alex/intro')).toBe(
      'https://cal.com/alex/intro',
    );
  });

  it('refuses every non-https scheme, which is also the XSS guard', () => {
    expect(bookingHref('javascript:alert(1)')).toBeNull();
    expect(bookingHref('data:text/html,<script>')).toBeNull();
    expect(bookingHref('http://cal.com/alex')).toBeNull();
    expect(bookingHref('cal.com/alex')).toBeNull(); // not absolute
    expect(bookingHref(null)).toBeNull();
  });
});

describe('contactChannels', () => {
  it('offers the channels in the order §17 prescribes', () => {
    const channels = contactChannels({
      email: 'alex@example.com',
      calcom_url: 'https://cal.com/alex',
      telegram_username: 'alex_unchained',
      whatsapp_number: '+79991234567',
    });

    // Direct conversation first, email last, regardless of field order above.
    expect(channels.map((c) => c.kind)).toEqual([
      'whatsapp',
      'telegram',
      'calcom',
      'email',
    ]);
  });

  it('omits the channels that do not exist, leaving no dead buttons', () => {
    const channels = contactChannels({
      whatsapp_number: '+79991234567',
      telegram_username: null,
      email: 'alex@example.com',
      calcom_url: 'https://cal.com/alex',
    });

    // §17's own worked example: WhatsApp, Schedule a Call, Email.
    expect(channels.map((c) => c.kind)).toEqual([
      'whatsapp',
      'calcom',
      'email',
    ]);
  });

  it('omits a channel whose stored value is malformed', () => {
    const channels = contactChannels({
      whatsapp_number: '79991234567', // no '+' — unusable
      telegram_username: 'alex_unchained',
    });

    expect(channels.map((c) => c.kind)).toEqual(['telegram']);
  });

  it('returns nothing for a contact with no reachable channel at all', () => {
    expect(contactChannels({})).toEqual([]);
    expect(
      contactChannels({
        whatsapp_number: null,
        telegram_username: '',
        email: null,
        calcom_url: undefined,
      }),
    ).toEqual([]);
  });
});
