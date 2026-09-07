import { describe, expect, it } from 'vitest';
import { metadata as homeMetadata } from './page';
import { metadata as softwareMetadata } from './software-development/page';
import { metadata as automationMetadata } from './business-automation/page';
import { metadata as growthMetadata } from './growth-systems/page';
import { metadata as journeyMetadata } from './journey/page';
import { metadata as workMetadata } from './work/page';
import { generateMetadata as projectMetadata } from './work/[slug]/page';
import { SITE_OG_IMAGE } from '@/lib/metadata';
import { siteConfig } from '@/lib/site';
import { pillarContent } from '@/lib/pillar-content';
import { fallbackProjects, findProject } from '@/lib/projects';

/**
 * The regression this module exists to prevent: a page advertising itself
 * socially as the home page. Every indexable route is checked against the home
 * page's Open Graph title, description and URL — the three values the root
 * layout used to hand out to anything that did not override them.
 *
 * Route modules are imported directly and their exported metadata inspected;
 * the project has no DOM test environment and this does not add one.
 *
 * ─── Which portfolio these assertions run against ─────────────────────────
 * The project pages read public.unchained_projects through lib/portfolio.ts,
 * and this suite sets no Supabase environment variables — so loadProjects()
 * takes its not-configured path and the routes render `fallbackProjects`,
 * which is what the lookups below resolve against. That is deliberate: this
 * module is about metadata, not about content, and pointing a unit test at a
 * live database would make it fail for reasons that have nothing to do with
 * an Open Graph tag.
 */

const HOME_OG_TITLE = `${siteConfig.name} — ${siteConfig.tagline}`;

type Og = {
  title?: unknown;
  description?: unknown;
  url?: unknown;
  images?: unknown;
  siteName?: unknown;
  type?: unknown;
};

const routes = [
  { name: '/software-development', meta: softwareMetadata, path: '/software-development' },
  { name: '/business-automation', meta: automationMetadata, path: '/business-automation' },
  { name: '/growth-systems', meta: growthMetadata, path: '/growth-systems' },
  { name: '/journey', meta: journeyMetadata, path: '/journey' },
  { name: '/work', meta: workMetadata, path: '/work' },
];

describe('the home page', () => {
  const og = homeMetadata.openGraph as Og;

  it('keeps its own title, description and canonical', () => {
    expect(homeMetadata.title).toEqual({ absolute: HOME_OG_TITLE });
    expect(homeMetadata.description).toBe(siteConfig.description);
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });

  it('owns the Open Graph block that used to sit in the root layout', () => {
    expect(og.title).toBe(HOME_OG_TITLE);
    expect(og.description).toBe(siteConfig.description);
    expect(og.url).toBe(`${siteConfig.url}/`);
    expect(og.images).toEqual([SITE_OG_IMAGE]);
    expect(og.type).toBe('website');
  });
});

describe.each(routes)('$name', ({ meta, path }) => {
  const og = meta.openGraph as Og;

  it('canonicalises to itself', () => {
    expect(meta.alternates?.canonical).toBe(path);
  });

  it('does not inherit the home page Open Graph values', () => {
    expect(og).toBeDefined();
    expect(og.title).not.toBe(HOME_OG_TITLE);
    expect(og.description).not.toBe(siteConfig.description);
    expect(og.url).not.toBe(`${siteConfig.url}/`);
  });

  it('advertises its own URL', () => {
    expect(og.url).toBe(`${siteConfig.url}${path}`);
  });

  it('has a title and description of its own', () => {
    expect(typeof meta.title).toBe('string');
    expect(meta.description).toBeTruthy();
    expect(og.title).toBe(`${meta.title as string} — ${siteConfig.name}`);
    expect(og.description).toBe(meta.description);
  });

  it('keeps a valid OG image and the site name', () => {
    expect(og.images).toEqual([SITE_OG_IMAGE]);
    expect(og.siteName).toBe(siteConfig.name);
  });

  it('is left indexable', () => {
    expect(meta.robots).toBeUndefined();
  });
});

describe('the pillar pages', () => {
  it('take their titles and descriptions from the pillar content file', () => {
    expect(softwareMetadata.title).toBe(
      pillarContent['software-development'].metaTitle,
    );
    expect(automationMetadata.description).toBe(
      pillarContent['business-automation'].metaDescription,
    );
    expect(growthMetadata.title).toBe(pillarContent['growth-systems'].metaTitle);
  });

  it('do not share one another’s social identity', () => {
    const titles = [softwareMetadata, automationMetadata, growthMetadata].map(
      (m) => (m.openGraph as Og).title,
    );
    expect(new Set(titles).size).toBe(3);
  });
});

describe('/work/[slug]', () => {
  it('gives a published project its own metadata and its own image', async () => {
    const meta = await projectMetadata({
      params: Promise.resolve({ slug: 'tancerca' }),
    });
    const og = meta.openGraph as Og;
    const project = findProject(fallbackProjects, 'tancerca')!;

    expect(meta.alternates?.canonical).toBe('/work/tancerca');
    expect(og.url).toBe(`${siteConfig.url}/work/tancerca`);
    expect(og.title).toBe(`${project.title} — ${siteConfig.name}`);
    expect(og.title).not.toBe(HOME_OG_TITLE);
    expect(og.description).not.toBe(siteConfig.description);
    expect(og.images).toEqual([project.heroImage]);
    expect(og.type).toBe('article');
  });

  it('keeps a detailed project indexable', () => {
    // Module 1's publication gate, unchanged.
    expect(findProject(fallbackProjects, 'tancerca')?.detailed).toBe(true);
  });

  it('keeps a project without a published page out of the index, with an image', async () => {
    const undetailed = findProject(fallbackProjects, 'unchained-os');
    expect(undetailed?.detailed).not.toBe(true);

    const meta = await projectMetadata({
      params: Promise.resolve({ slug: undetailed!.slug }),
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect((meta.openGraph as Og).images).not.toEqual([undefined]);
  });

  it('does not fall back to home page metadata for an unknown slug', async () => {
    const meta = await projectMetadata({
      params: Promise.resolve({ slug: 'no-such-project' }),
    });
    expect(meta.title).toBe('Project not found');
    expect(meta.openGraph).toBeUndefined();
  });
});
