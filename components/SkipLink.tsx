'use client';

import { useTranslation } from '@/lib/i18n/LanguageProvider';

export default function SkipLink() {
  const t = useTranslation();

  return (
    <a
      href='#main'
      className='sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-foreground focus:text-background focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold'
    >
      {t('common.skipToContent')}
    </a>
  );
}
