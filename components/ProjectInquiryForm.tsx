'use client';

import { useId, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { useCommercialRouting } from '@/lib/commercial/RoutingProvider';
import {
  emptyInquiry,
  serviceInterests,
  validateInquiry,
  type InquiryDraft,
  type InquiryField,
} from '@/lib/commercial/leads';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * "Tell us briefly about your project." — the optional half of the panel.
 *
 * ─── Why it is collapsed, and why it is below the channels (§11) ──────────
 * §11 is unambiguous: a visitor must not have to complete a form before they
 * can reach WhatsApp. So the channels resolve first, sit at the top, and work
 * whether or not this is ever opened. This is a disclosure, closed by default,
 * for the visitor who would rather write than open a messaging app — which is
 * a real preference and, for a first contact with a company they have not met,
 * a common one.
 *
 * ─── Why the form is short (§10) ──────────────────────────────────────────
 * Six fields, one of them required, two of them one-or-the-other. Name, so the
 * reply can address someone; an address or a number, so there can be a reply at
 * all; company, service and message because they are what makes the first
 * response useful rather than generic. Nothing about budget, timeline, company
 * size, industry or how they heard of us: every one of those is a question a
 * commercial can ask in the conversation this form exists to start, and every
 * one of them costs submissions to ask here.
 *
 * ─── What the visitor never sees (§52) ────────────────────────────────────
 * No lead, no CRM, no pipeline, no status, no routing and no assignment. The
 * word "lead" does not appear on this screen in any of the six languages. As
 * far as the visitor is concerned they wrote to a company, and a person will
 * write back.
 */

const SERVICE_LABEL: Record<(typeof serviceInterests)[number], TranslationKey> =
  {
    'software-development': 'pillar.software-development',
    'business-automation': 'pillar.business-automation',
    'growth-systems': 'pillar.growth-systems',
  };

/** Which sentence to show for a field the visitor has to fix (§23, UX half). */
const FIELD_ERROR: Record<InquiryField, TranslationKey> = {
  name: 'inquiry.error.name',
  email: 'inquiry.error.email',
  phone: 'inquiry.error.phone',
  contact: 'inquiry.error.contact',
  message: 'inquiry.error.message',
};

const fieldClass =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground ' +
  'placeholder:text-muted-foreground transition-colors duration-200 ' +
  'focus:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <label
        htmlFor={id}
        className='text-xs font-medium text-muted-foreground'
      >
        {label}
        {optional && (
          <span className='ml-1 font-normal opacity-70'>{optional}</span>
        )}
      </label>
      {children}
    </div>
  );
}

export default function ProjectInquiryForm() {
  const { t } = useLanguage();
  const { submit, inquiry } = useCommercialRouting();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InquiryDraft>(emptyInquiry);
  const [invalidField, setInvalidField] = useState<InquiryField | null>(null);

  const formId = useId();
  const field = (name: string) => `${formId}-${name}`;

  function set<K extends keyof InquiryDraft>(key: K, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Clearing on edit rather than revalidating on every keystroke: telling
    // someone their address is malformed while they are still typing it is
    // correct and useless.
    if (invalidField) setInvalidField(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateInquiry(draft);
    if (problem) {
      setInvalidField(problem);
      return;
    }
    submit(draft);
  }

  // §54's spirit, applied to the visitor's side: once the message is in, the
  // form is replaced by an acknowledgement rather than being left open to be
  // sent again. The channels above stay live — someone who wrote and then
  // decided to send a WhatsApp too should not be stopped.
  if (inquiry.status === 'sent') {
    return (
      <div
        className='flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-left'
        role='status'
      >
        <CheckCircle2
          size={18}
          aria-hidden='true'
          className='mt-0.5 shrink-0 text-foreground'
        />
        <div className='flex flex-col gap-1'>
          <span className='text-sm font-semibold text-foreground'>
            {t('inquiry.sentTitle')}
          </span>
          <span className='text-sm text-muted-foreground'>
            {t('inquiry.sentBody')}
          </span>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={formId}
        className='inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground'
      >
        {t('inquiry.toggle')}
        <ChevronDown size={15} aria-hidden='true' />
      </button>
    );
  }

  const sending = inquiry.status === 'sending';
  const failure = inquiry.status === 'failed' ? inquiry.result.kind : null;

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      className='flex w-full flex-col gap-3.5 text-left'
    >
      <p className='text-sm text-muted-foreground'>{t('inquiry.title')}</p>

      <Field id={field('name')} label={t('inquiry.name')}>
        <input
          id={field('name')}
          name='name'
          type='text'
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={120}
          autoComplete='name'
          required
          aria-invalid={invalidField === 'name' || undefined}
          className={fieldClass}
        />
      </Field>

      <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
        <Field id={field('email')} label={t('inquiry.email')}>
          <input
            id={field('email')}
            name='email'
            type='email'
            inputMode='email'
            value={draft.email}
            onChange={(e) => set('email', e.target.value)}
            maxLength={200}
            autoComplete='email'
            aria-invalid={
              invalidField === 'email' || invalidField === 'contact' || undefined
            }
            className={fieldClass}
          />
        </Field>

        <Field id={field('phone')} label={t('inquiry.phone')}>
          <input
            id={field('phone')}
            name='phone'
            type='tel'
            inputMode='tel'
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
            maxLength={32}
            autoComplete='tel'
            aria-invalid={
              invalidField === 'phone' || invalidField === 'contact' || undefined
            }
            className={fieldClass}
          />
        </Field>
      </div>

      <Field
        id={field('company')}
        label={t('inquiry.company')}
        optional={t('inquiry.optional')}
      >
        <input
          id={field('company')}
          name='company'
          type='text'
          value={draft.company}
          onChange={(e) => set('company', e.target.value)}
          maxLength={200}
          autoComplete='organization'
          className={fieldClass}
        />
      </Field>

      <Field
        id={field('service')}
        label={t('inquiry.service')}
        optional={t('inquiry.optional')}
      >
        <select
          id={field('service')}
          name='service'
          value={draft.service}
          onChange={(e) => set('service', e.target.value)}
          className={fieldClass}
        >
          {/* The empty option is "they did not say", and it is stored as
              nothing rather than as a service they did not pick (§13). */}
          <option value=''>{t('inquiry.servicePlaceholder')}</option>
          {serviceInterests.map((service) => (
            <option key={service} value={service}>
              {t(SERVICE_LABEL[service])}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id={field('message')}
        label={t('inquiry.message')}
        optional={t('inquiry.optional')}
      >
        <textarea
          id={field('message')}
          name='message'
          rows={3}
          value={draft.message}
          onChange={(e) => set('message', e.target.value)}
          maxLength={2000}
          aria-invalid={invalidField === 'message' || undefined}
          className={`${fieldClass} resize-y`}
        />
      </Field>

      {/*
        §22, the honeypot. Hidden from people in three independent ways — off
        screen, out of the tab order, and hidden from the accessibility tree —
        because a field that is only `display: none` is skipped by some bots and
        a field that is only `aria-hidden` is still tabbed into by a screen
        reader user. Anything that fills it is not a person, and the server
        answers such a submission with a cheerful success and writes nothing.
      */}
      <div aria-hidden='true' className='absolute -left-[9999px] h-0 w-0 overflow-hidden'>
        <label htmlFor={field('website')}>Website</label>
        <input
          id={field('website')}
          name='website'
          type='text'
          tabIndex={-1}
          autoComplete='off'
          value={draft.honeypot}
          onChange={(e) => set('honeypot', e.target.value)}
        />
      </div>

      {(invalidField || failure) && (
        <p role='alert' className='text-sm text-destructive'>
          {invalidField
            ? t(FIELD_ERROR[invalidField])
            : failure === 'rate_limited'
              ? t('inquiry.error.rateLimited')
              : failure === 'invalid'
                ? t('inquiry.error.invalid')
                : t('inquiry.error.unavailable')}
        </p>
      )}

      <button
        type='submit'
        disabled={sending}
        className='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-colors duration-200 hover:bg-foreground/90 disabled:opacity-60'
      >
        {sending && (
          <Loader2 size={16} aria-hidden='true' className='animate-spin' />
        )}
        {t(sending ? 'inquiry.sending' : 'inquiry.send')}
      </button>

      <p className='text-xs leading-relaxed text-muted-foreground'>
        {t('inquiry.privacy')}
      </p>
    </form>
  );
}
