'use client';

import { STATUS_META, type ProjectStatus } from '@/lib/projects';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslation();
  const meta = STATUS_META[status];

  return (
    <span className={`status-pill ${meta.className}`}>
      <span className='status-dot' aria-hidden='true' />
      {t(('status.' + status + '.label') as TranslationKey)}
    </span>
  );
}
