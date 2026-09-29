'use client';

import Link from 'next/link';
import StartProjectButton from '@/components/StartProjectButton';
import { getDemo } from '@/lib/demo/registry';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { languageName } from '@/lib/i18n/languageName';
import { getShowcase, offerForProject } from '@/lib/offers';

/**
 * A portfolio project read as a sales asset: who a product like this is for,
 * what it solves, the language its interface is built in, and which offer it
 * is an example of.
 *
 * Renders nothing for a project without showcase copy in lib/offers.ts — a
 * project added in the panel keeps its ordinary card rather than growing
 * empty labels. Nothing here is an outcome: no users, revenue or results,
 * because none has been measured. The demo is the evidence.
 *
 * Used inside cards whose title link is stretched over the whole card, so the
 * one link here sits above it on the z-axis, like the demo link does.
 */
export default function ShowcasePitch({ slug }: { slug: string }) {
  const { t, locale } = useLanguage();
  const pitch = getShowcase(slug);
  if (!pitch) return null;

  const offer = offerForProject(slug);
  const demo = getDemo(slug);

  return (
    <div className='flex flex-col gap-3 border-t border-border pt-4'>
      {offer && (
        <Link
          href='/#offers'
          className='relative z-10 self-start text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors'
        >
          {t('offers.offer')} {offer.id.toUpperCase()} · {t(offer.name)}
        </Link>
      )}
      <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs leading-relaxed'>
        <dt className='font-semibold text-foreground/80'>{t('showcase.for')}</dt>
        <dd className='text-muted-foreground'>{t(pitch.audience)}</dd>
        <dt className='font-semibold text-foreground/80'>{t('showcase.solves')}</dt>
        <dd className='text-muted-foreground'>{t(pitch.problem)}</dd>
        {demo && (
          <>
            <dt className='font-semibold text-foreground/80'>
              {t('showcase.language')}
            </dt>
            <dd className='text-muted-foreground'>
              {languageName(demo.lang, locale)}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

/**
 * "Want one like this?" — opens the contact panel attributed to the project
 * (`demo_<slug>`), so the conversation starts knowing what prompted it.
 * Only for projects with showcase copy, for the same reason as above.
 */
export function ShowcaseCta({
  slug,
  title,
  className,
}: {
  slug: string;
  /** The project's name. Several of these share one visible label, so each
   *  carries its project in its accessible name. */
  title: string;
  className?: string;
}) {
  const { t } = useLanguage();
  if (!getShowcase(slug)) return null;

  return (
    <StartProjectButton source='demo' detail={slug} className={className}>
      {t('showcase.cta')}
      <span className='sr-only'> — {title}</span>
    </StartProjectButton>
  );
}
