/**
 * The homepage's published questions.
 *
 * Shared by the rendered accordion (`components/FAQ.tsx`) and the FAQPage
 * JSON-LD on the homepage, so the two cannot drift: the schema describes the
 * questions the page actually shows, and nothing was written to obtain it.
 */

import { en } from '@/lib/i18n/dictionaries/en';
import type { TranslationKey } from '@/lib/i18n/dictionaries';
import type { FaqEntry } from '@/lib/structured-data';

export const faqItems: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'faq.q1', a: 'faq.a1' },
  { q: 'faq.q2', a: 'faq.a2' },
  { q: 'faq.q3', a: 'faq.a3' },
  { q: 'faq.q4', a: 'faq.a4' },
  { q: 'faq.q5', a: 'faq.a5' },
  { q: 'faq.q6', a: 'faq.a6' },
  { q: 'faq.q7', a: 'faq.a7' },
];

/**
 * The English text of those questions. The homepage is prerendered as
 * `lang="en"` and the JSON-LD ships in that static HTML, so English is the
 * language the schema has to describe — a visitor switching language changes
 * the rendered copy on the client, not the crawled document.
 */
export function englishFaqEntries(): FaqEntry[] {
  return faqItems.map((item) => ({ question: en[item.q], answer: en[item.a] }));
}
