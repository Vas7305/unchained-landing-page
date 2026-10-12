import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatMegabytes, getDownload, productDownloads } from './downloads';
import { fallbackProjects } from './projects';
import { dictionaries } from './i18n/dictionaries';

/**
 * A download link is a promise that a file is there. These hold every entry
 * to the file it names, so a link to a missing APK, or a size that no longer
 * matches it, fails here rather than on a visitor's phone.
 */

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

describe('product downloads', () => {
  for (const [slug, download] of Object.entries(productDownloads)) {
    describe(slug, () => {
      const file = publicDir + download.href;

      it('names a file that exists in public/', () => {
        expect(existsSync(file)).toBe(true);
      });

      it('states the exact size of that file', () => {
        expect(statSync(file).size).toBe(download.bytes);
      });

      it('belongs to a project the site knows', () => {
        expect(fallbackProjects.map((p) => p.slug)).toContain(slug);
      });

      it('has a label in every language', () => {
        for (const dictionary of Object.values(dictionaries)) {
          expect(dictionary[download.label]).toBeTruthy();
        }
      });
    });
  }

  it('has nothing for a project without a download', () => {
    expect(getDownload('mensalere')).toBeUndefined();
    expect(getDownload('constructor')).toBeUndefined();
  });

  it('formats sizes in the visitor’s locale', () => {
    expect(formatMegabytes(6_194_600, 'en')).toBe('6.2 MB');
    expect(formatMegabytes(6_194_600, 'de')).toBe('6,2 MB');
  });
});
