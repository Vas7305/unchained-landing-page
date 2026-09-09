import { describe, expect, it } from 'vitest';
import { fallbackProjects } from '@/lib/projects';
import { demoRegistry, demoPath, getDemo, hasDemo, resolveScenario } from './registry';
import type { DemoTheme } from './types';

/**
 * The seam between the portfolio and the demos.
 *
 * The registry is the one module that names products, so it is the one module
 * whose mistakes are invisible: a typo in a slug produces a project whose demo
 * CTA never appears, and nothing else goes wrong. These assertions turn that
 * class of mistake into a failing build.
 */

const THEME_KEYS: (keyof DemoTheme)[] = [
  '--d-bg',
  '--d-surface',
  '--d-surface-2',
  '--d-border',
  '--d-fg',
  '--d-muted',
  '--d-accent',
  '--d-accent-fg',
  '--d-ring',
  '--d-positive',
  '--d-danger',
  '--d-radius',
];

const entries = Object.entries(demoRegistry);

describe('coverage', () => {
  /**
   * Every project in the portfolio has an interactive demo.
   *
   * This is the deliverable, stated as an assertion. The list it checks is
   * `fallbackProjects` — the portfolio this repository can see, since the live
   * one lives in a database this suite deliberately does not call.
   *
   * Adding a project without a demo will fail here. That is the intended
   * behaviour: it should be a decision somebody makes on purpose and records
   * by editing this test, not something that happens by omission and quietly
   * leaves a gap in the showcase.
   */
  it('gives every project in the portfolio a demo', () => {
    const missing = fallbackProjects
      .filter((project) => !hasDemo(project.slug))
      .map((project) => project.slug);

    expect(missing).toEqual([]);
  });

  it('registers no demo for a project that does not exist', () => {
    const known = new Set(fallbackProjects.map((project) => project.slug));
    const orphans = Object.keys(demoRegistry).filter((slug) => !known.has(slug));

    expect(orphans).toEqual([]);
  });
});

describe.each(entries)('the %s demo', (slug, definition) => {
  it('declares a device, a language and a surface label', () => {
    expect(['browser', 'phone', 'desktop']).toContain(definition.frame);
    expect(definition.lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    expect(definition.surfaceLabel.trim()).not.toBe('');
  });

  it('declares a complete theme', () => {
    for (const key of THEME_KEYS) {
      expect(definition.theme[key], `${slug} is missing ${key}`).toBeTruthy();
    }
    // No stray tokens: a name the shared primitives do not read would be dead
    // weight that looks like it is doing something.
    expect(Object.keys(definition.theme).sort()).toEqual([...THEME_KEYS].sort());
  });

  it('declares at least one scenario, with unique ids', () => {
    expect(definition.scenarios.length).toBeGreaterThan(0);

    const ids = definition.scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const scenario of definition.scenarios) {
      expect(scenario.label.trim()).not.toBe('');
    }
  });

  it('loads lazily rather than eagerly', () => {
    // The registry must hold a *function* that imports the demo. Holding the
    // module itself would put all eight demos in the initial bundle, which is
    // the one thing §11 rules out.
    expect(typeof definition.load).toBe('function');
    expect(definition.load.length).toBe(0);
  });
});

describe('lookups', () => {
  it('answers for a known slug and refuses an unknown one', () => {
    const [slug] = entries[0];

    expect(hasDemo(slug)).toBe(true);
    expect(getDemo(slug)).toBe(demoRegistry[slug]);

    expect(hasDemo('not-a-project')).toBe(false);
    expect(getDemo('not-a-project')).toBeUndefined();
  });

  it('is not fooled by inherited object properties', () => {
    // `slug in obj` would answer true for these, and `demoRegistry[slug]`
    // would hand back a function. `Object.hasOwn` is why it does not.
    expect(hasDemo('constructor')).toBe(false);
    expect(hasDemo('toString')).toBe(false);
    expect(getDemo('constructor')).toBeUndefined();
  });

  it('builds the demo path from the slug in one place', () => {
    expect(demoPath('example-slug')).toBe('/work/example-slug/demo');
  });
});

describe('scenario resolution', () => {
  const [, definition] = entries[0];

  it('defaults to the first scenario', () => {
    expect(resolveScenario(definition)).toBe(definition.scenarios[0].id);
    expect(resolveScenario(definition, null)).toBe(definition.scenarios[0].id);
  });

  it('honours a scenario the demo actually declares', () => {
    const last = definition.scenarios[definition.scenarios.length - 1];
    expect(resolveScenario(definition, last.id)).toBe(last.id);
  });

  it('falls back rather than failing on an unknown scenario', () => {
    // A stale link should open the demo, not a blank screen.
    expect(resolveScenario(definition, 'renamed-last-year')).toBe(
      definition.scenarios[0].id,
    );
  });
});
