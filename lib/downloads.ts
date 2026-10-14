import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * Products a visitor can install straight from this site, by project slug.
 *
 * ─── Why a code map and not a column ──────────────────────────────────────
 * The same reasoning as lib/demo/registry.ts. The file is in this repository,
 * under public/, and ships with the deploy that contains this entry; a
 * database row could point at a file the build does not have. The link is
 * shown where the project is published AND this map has its slug.
 *
 * ─── Replacing a file ─────────────────────────────────────────────────────
 * Copy the new build over the old one, byte for byte, and update `bytes`.
 * downloads.test.ts fails while the two disagree, so the size the page shows
 * cannot quietly go stale.
 */
export interface ProductDownload {
  /** Site-relative path of the file in public/. Served as a static asset. */
  href: string;
  /** What the link reads, in the visitor's language. */
  label: TranslationKey;
  /** Exact size of the file, in bytes. */
  bytes: number;
}

export const productDownloads: Record<string, ProductDownload> = {
  // The signed release APK, as built from the Merxis repository.
  'merxis-pos': {
    href: '/downloads/merxis/MerxisPOS.apk',
    label: 'download.merxis-pos.android',
    bytes: 6_247_882,
  },
  // The signed release APK (1.0.3), as built from the Kairos repository.
  kairos: {
    href: '/downloads/kairos/Kairos.apk',
    label: 'download.kairos.android',
    bytes: 4_733_111,
  },
};

/** A project's download, or undefined. */
export function getDownload(slug: string): ProductDownload | undefined {
  return Object.hasOwn(productDownloads, slug)
    ? productDownloads[slug]
    : undefined;
}

/** "6.2 MB", "6,2 Mo", "6,2 МБ" — decimal megabytes, in the visitor's locale. */
export function formatMegabytes(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 1,
  }).format(bytes / 1_000_000);
}
