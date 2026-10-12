'use client';

import { Download } from 'lucide-react';
import { track } from '@/lib/analytics';
import { formatMegabytes, getDownload } from '@/lib/downloads';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

/**
 * The link that installs a product, for the projects that have one.
 *
 * A plain anchor, not next/link: the destination is a static file, and a
 * client-side navigation to it would be a route lookup that can only fail.
 * The size is shown because many of the people this is for pay for their data
 * by the megabyte.
 */
export default function ProductDownloadLink({
  slug,
  className,
}: {
  slug: string;
  className: string;
}) {
  const { t, locale } = useLanguage();
  const download = getDownload(slug);

  if (!download) return null;

  return (
    <a
      href={download.href}
      download
      type='application/vnd.android.package-archive'
      onClick={() => track('download_click', { project: slug })}
      className={className}
    >
      <Download size={14} aria-hidden='true' className='shrink-0' />
      {t(download.label)}
      <span className='text-xs font-normal opacity-70 whitespace-nowrap'>
        APK · {formatMegabytes(download.bytes, locale)}
      </span>
    </a>
  );
}
