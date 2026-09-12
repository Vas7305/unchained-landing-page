import { describe, expect, it } from 'vitest';
import { resolveProjectCopy, type Dictionaries } from './projectCopy';
import type { Project } from '@/lib/projects';
import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * The resolution chain: CMS translation → dictionary → the project row.
 *
 * This is the module that stops a project created in the panel rendering
 * `project.acme-corp.description` on the public website, so the cases below
 * are mostly about what happens when a step is ABSENT — which is the normal
 * state of a project nobody has translated yet.
 */

/** A dictionary holding exactly the keys it is given. */
function dictionary(
  entries: Record<string, string> = {},
  lists: Record<string, string[]> = {},
): Dictionaries {
  return {
    // Mirrors LanguageProvider exactly: a miss returns the KEY, which is the
    // behaviour the whole module is written around.
    t: (key: TranslationKey) => entries[key] ?? key,
    // And tList returns undefined on a miss, not the key. The two differ, and
    // the module has to handle both.
    tList: (key: ListKey) =>
      lists[key] as unknown as readonly string[],
  };
}

const bare: Project = {
  slug: 'acme-corp',
  title: 'Acme Corp',
  description: 'A description entered in the panel.',
  category: 'Marketplace Platform',
  status: 'completed',
};

describe('a project created in the panel, with no dictionary entries', () => {
  it('never returns a translation key as content', () => {
    const copy = resolveProjectCopy(bare, 'en', dictionary());

    // The regression this module exists for.
    for (const value of Object.values(copy)) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(/^project\./);
      }
    }
  });

  it('falls through to the row it was given', () => {
    const copy = resolveProjectCopy(bare, 'en', dictionary());

    expect(copy.title).toBe('Acme Corp');
    expect(copy.description).toBe('A description entered in the panel.');
    expect(copy.category).toBe('Marketplace Platform');
  });

  it('leaves an unset optional field undefined rather than inventing one', () => {
    const copy = resolveProjectCopy(bare, 'en', dictionary());

    expect(copy.challenge).toBeUndefined();
    expect(copy.outcome).toBeUndefined();
    expect(copy.capabilities).toBeUndefined();
  });

  it('does the same in a non-default locale it has no translation for', () => {
    const copy = resolveProjectCopy(bare, 'ru', dictionary());

    expect(copy.description).toBe('A description entered in the panel.');
    expect(copy.description).not.toMatch(/^project\./);
  });
});

describe('the existing projects, whose copy is in the dictionaries', () => {
  const dict = dictionary(
    {
      'project.tancerca.description': 'Una plataforma de comercio digital.',
      'project.tancerca.challenge': 'El reto en español.',
    },
    { 'project.tancerca.capabilities': ['Arquitectura', 'Pagos'] },
  );

  const seeded: Project = {
    ...bare,
    slug: 'tancerca',
    title: 'TanCerca',
    description: 'A marketplace and digital commerce platform.',
    challenge: 'The challenge in English.',
    capabilities: ['Marketplace architecture', 'Payments'],
  };

  it('keeps their hand-written translations', () => {
    const copy = resolveProjectCopy(seeded, 'es', dict);

    expect(copy.description).toBe('Una plataforma de comercio digital.');
    expect(copy.challenge).toBe('El reto en español.');
    expect(copy.capabilities).toEqual(['Arquitectura', 'Pagos']);
  });

  it('falls back to the row for a field the dictionary does not cover', () => {
    const copy = resolveProjectCopy(seeded, 'es', dict);

    // No 'project.tancerca.category' key exists in this dictionary.
    expect(copy.category).toBe('Marketplace Platform');
  });
});

describe('a project translated in the CMS', () => {
  const translated: Project = {
    ...bare,
    slug: 'tancerca',
    description: 'The English description.',
    challenge: 'The English challenge.',
    translations: {
      es: {
        description: 'La descripción del panel.',
        // `challenge` deliberately absent: this is a partial translation.
      },
    },
  };

  const dict = dictionary({
    'project.tancerca.description': 'La descripción del diccionario.',
    'project.tancerca.challenge': 'El reto del diccionario.',
  });

  it('prefers the panel translation over the dictionary', () => {
    const copy = resolveProjectCopy(translated, 'es', dict);
    expect(copy.description).toBe('La descripción del panel.');
  });

  it('falls back per FIELD, not per record', () => {
    const copy = resolveProjectCopy(translated, 'es', dict);

    // The one field the translator did not do still reads in Spanish, from the
    // dictionary — rather than the whole record snapping back to English
    // because one field was missing.
    expect(copy.challenge).toBe('El reto del diccionario.');
  });

  it('ignores a translation for a locale the visitor is not reading', () => {
    const copy = resolveProjectCopy(translated, 'fr', dict);
    expect(copy.description).toBe('La descripción del diccionario.');
  });

  it('does not let a default-locale translation override the row', () => {
    // The parent row IS the default locale. A translation row for it should
    // not exist, and if one did, honouring it would give the site two
    // competing answers for one language.
    const odd: Project = {
      ...translated,
      translations: { en: { description: 'Should not win.' } },
    };

    expect(resolveProjectCopy(odd, 'en', dictionary()).description).toBe(
      'The English description.',
    );
  });
});

describe('alt text', () => {
  it('is translated, and has no dictionary step', () => {
    const withImage: Project = {
      ...bare,
      thumbnail: '/work/acme.webp',
      thumbnailAlt: 'The Acme dashboard.',
      translations: { de: { thumbnailAlt: 'Das Acme-Dashboard.' } },
    };

    expect(resolveProjectCopy(withImage, 'de', dictionary()).thumbnailAlt).toBe(
      'Das Acme-Dashboard.',
    );
    expect(resolveProjectCopy(withImage, 'fr', dictionary()).thumbnailAlt).toBe(
      'The Acme dashboard.',
    );
  });

  it('stays undefined when nobody wrote any', () => {
    expect(resolveProjectCopy(bare, 'en', dictionary()).thumbnailAlt).toBeUndefined();
  });
});
