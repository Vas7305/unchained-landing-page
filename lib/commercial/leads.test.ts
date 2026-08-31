import { describe, expect, it } from 'vitest';
import {
  isServiceInterest,
  leadPayload,
  serviceInterests,
  sourceCta,
  sourcePage,
  toInquiryResult,
  validateInquiry,
  emptyInquiry,
  type InquiryContext,
} from './leads';

/**
 * What these pin, and why each one is worth a test.
 *
 * The form is the only place on this website that sends a stranger's details
 * anywhere, and every function below decides something about what leaves the
 * browser. A regression in `leadPayload` sends the wrong attribution and is
 * invisible for months — the lead still arrives, it is simply mis-attributed,
 * and the country report quietly lies. A regression in `sourcePage` sends a
 * query string full of campaign parameters to a table that has no business
 * holding them (§20). A regression in `validateInquiry` costs a real inquiry.
 *
 * None of these tests reach the network. The security-relevant rules are
 * enforced in `public.create_public_lead` and verified there, in the migration's
 * own probe; what is checked here is that the browser sends the right SHAPE.
 */

const context: InquiryContext = {
  country: 'RU',
  language: 'ru',
  page: '/',
  cta: 'hero_start_project',
  clientToken: '11111111-2222-4333-8444-555555555555',
};

describe('validateInquiry', () => {
  const draft = { ...emptyInquiry, name: 'Anna', email: 'anna@example.com' };

  it('accepts a name with an email', () => {
    expect(validateInquiry(draft)).toBeNull();
  });

  it('accepts a name with only a phone number', () => {
    expect(
      validateInquiry({ ...emptyInquiry, name: 'Anna', phone: '+7 999 123 45 67' }),
    ).toBeNull();
  });

  it('refuses an inquiry nobody can reply to', () => {
    // The single most important rule on this form: a message with no way back
    // is not an opportunity, it is a dead end (§23).
    expect(validateInquiry({ ...emptyInquiry, name: 'Anna' })).toBe('contact');
  });

  it('requires a name', () => {
    expect(validateInquiry({ ...draft, name: '   ' })).toBe('name');
    expect(validateInquiry({ ...draft, name: 'x'.repeat(121) })).toBe('name');
  });

  it('names the field that is wrong, so the form can point at it', () => {
    expect(validateInquiry({ ...draft, email: 'anna@' })).toBe('email');
    expect(validateInquiry({ ...draft, phone: 'call me' })).toBe('phone');
    expect(validateInquiry({ ...draft, message: 'x'.repeat(2001) })).toBe('message');
  });

  it('tolerates the punctuation people actually type in a phone number', () => {
    for (const phone of ['+34 600 123 456', '+7 (999) 123-45-67', '07700900123']) {
      expect(validateInquiry({ ...emptyInquiry, name: 'Anna', phone })).toBeNull();
    }
  });
});

describe('sourcePage', () => {
  it('keeps the path', () => {
    expect(sourcePage('/')).toBe('/');
    expect(sourcePage('/software-development')).toBe('/software-development');
    expect(sourcePage('/work/tancerca')).toBe('/work/tancerca');
  });

  it('drops the query string and the fragment', () => {
    // §20: a query string is where a campaign id, a session token or somebody's
    // email address rides along. None of it answers "which page produced this".
    expect(sourcePage('/?utm_source=ads&email=someone@example.com')).toBe('/');
    expect(sourcePage('/journey#2026-08')).toBe('/journey');
  });

  it('returns null rather than repairing something unexpected', () => {
    expect(sourcePage('https://example.com/')).toBeNull();
    expect(sourcePage('/пример')).toBeNull();
    expect(sourcePage('')).toBeNull();
    expect(sourcePage(null)).toBeNull();
  });
});

describe('sourceCta', () => {
  it('builds the label §12 uses as its example', () => {
    expect(sourceCta('hero')).toBe('hero_start_project');
  });

  it('lets a section say which of its buttons was pressed', () => {
    expect(sourceCta('engagements', 'build')).toBe('engagements_build');
    expect(sourceCta('project', 'tancerca')).toBe('project_tancerca');
  });

  it('normalises anything that would not survive the database CHECK', () => {
    expect(sourceCta('Navbar', 'Start Project')).toBe('navbar_start_project');
    expect(sourceCta('hero', 'a--b')).toBe('hero_a_b');
  });

  it('returns null when there is nothing to attribute', () => {
    expect(sourceCta(null)).toBeNull();
    expect(sourceCta(undefined)).toBeNull();
  });
});

describe('leadPayload', () => {
  it('sends what the visitor typed and the attribution the browser knows', () => {
    const payload = leadPayload(
      {
        name: '  Anna Petrova  ',
        email: 'ANNA@example.com ',
        phone: '',
        company: 'Petrova Ltd',
        service: 'software-development',
        message: 'We need a booking system.',
        honeypot: '',
      },
      context,
    );

    expect(payload).toEqual({
      p_name: 'Anna Petrova',
      p_email: 'ANNA@example.com',
      p_phone: null,
      p_company_name: 'Petrova Ltd',
      p_country_code: 'RU',
      p_language: 'ru',
      p_service_interest: 'software-development',
      p_message: 'We need a booking system.',
      p_source_page: '/',
      p_source_cta: 'hero_start_project',
      p_client_token: '11111111-2222-4333-8444-555555555555',
      p_honeypot: null,
    });
  });

  it('never sends an assigned commercial', () => {
    // §14: there is ONE assignment decision and the browser does not make it.
    // A payload key that named a representative would be the whole defect.
    const payload = leadPayload(
      { ...emptyInquiry, name: 'Anna', email: 'anna@example.com' },
      context,
    );
    const keys = Object.keys(payload);
    expect(keys.some((k) => /commercial|assign|priority|routing/i.test(k))).toBe(false);
  });

  it('sends an undetermined country as null rather than guessing one', () => {
    // §12: an absent country is an honest record. A guessed one routes and
    // reports the lead to the wrong market for as long as it exists.
    const payload = leadPayload(
      { ...emptyInquiry, name: 'Anna', email: 'anna@example.com' },
      { ...context, country: null },
    );
    expect(payload.p_country_code).toBeNull();
  });

  it('refuses to invent a service the site does not offer', () => {
    const payload = leadPayload(
      { ...emptyInquiry, name: 'Anna', email: 'a@b.co', service: 'blockchain' },
      context,
    );
    expect(payload.p_service_interest).toBeNull();
  });

  it('passes a filled honeypot through, so the server can drop it', () => {
    // The browser does not decide. It reports what was in the field and the
    // server answers with a silent success — which is what stops a bot from
    // learning that the field is the reason it failed (§22).
    const payload = leadPayload(
      { ...emptyInquiry, name: 'Bot', email: 'b@o.tt', honeypot: 'https://spam' },
      context,
    );
    expect(payload.p_honeypot).toBe('https://spam');
  });
});

describe('the service taxonomy', () => {
  it('is exactly the three pillars the website publishes', () => {
    // §13: no parallel taxonomy. These slugs are the routes, the analytics
    // labels, the `pillar.*` translation keys and the seeded rows in
    // public.unchained_services — one vocabulary, four places.
    expect([...serviceInterests]).toEqual([
      'software-development',
      'business-automation',
      'growth-systems',
    ]);
  });

  it('rejects anything else', () => {
    expect(isServiceInterest('software-development')).toBe(true);
    expect(isServiceInterest('digital-products')).toBe(false);
    expect(isServiceInterest('')).toBe(false);
    expect(isServiceInterest(undefined)).toBe(false);
  });
});

describe('toInquiryResult', () => {
  it('reads the three answers the RPC can give', () => {
    expect(toInquiryResult({ success: true })).toEqual({ kind: 'sent' });
    expect(toInquiryResult({ success: false, reason: 'invalid' })).toEqual({
      kind: 'invalid',
    });
    expect(toInquiryResult({ success: false, reason: 'rate_limited' })).toEqual({
      kind: 'rate_limited',
    });
  });

  it('never reports success for anything it does not understand', () => {
    // Telling someone their message was sent when it was not is the one
    // failure this form must not have.
    expect(toInquiryResult(null)).toEqual({ kind: 'unavailable' });
    expect(toInquiryResult('ok')).toEqual({ kind: 'unavailable' });
    expect(toInquiryResult({})).toEqual({ kind: 'unavailable' });
    expect(toInquiryResult({ success: 'true' })).toEqual({ kind: 'unavailable' });
  });
});
