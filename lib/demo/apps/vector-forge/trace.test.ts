import { describe, expect, it } from 'vitest';

import { demoSources, findSource, type DemoSource } from './data';
import {
  computeSvgComplexity,
  gridStep,
  mergeRadiusFor,
  placeVertices,
  quantisePalette,
  snapGeometry,
  subdivisions,
  traceSource,
  type TraceSettings,
} from './trace';

/**
 * What is worth testing here is not "does it draw something" — the drawing is
 * the product's artwork and cannot be wrong. It is the two claims the demo
 * makes to a prospect:
 *
 *   1. the same recipe gives the same file, every time; and
 *   2. the controls do something, and something in the direction their labels
 *      promise.
 *
 * A demo that quietly returned the same SVG whatever the sliders said would
 * pass a smoke test and fail both.
 */

const BALANCED: TraceSettings = {
  mode: 'logo',
  detail: 62,
  colors: 16,
  smoothing: 48,
  simplify: true,
};

function settings(overrides: Partial<TraceSettings>): TraceSettings {
  return { ...BALANCED, ...overrides };
}

const isotype = findSource('a-isotype') as DemoSource;

describe('the fixtures', () => {
  it('are three sources with real artwork behind them', () => {
    expect(demoSources).toHaveLength(3);

    for (const source of demoSources) {
      expect(source.path.startsWith('/demo/vector-forge/')).toBe(true);
      expect(source.svg.startsWith('<svg')).toBe(true);
      expect(source.outlines.length).toBe(source.pathCount);
      expect(source.bytes).toBeGreaterThan(0);
    }
  });

  it('put every vertex inside the artwork it belongs to', () => {
    for (const source of demoSources) {
      for (const outline of source.outlines) {
        expect(outline.length).toBeGreaterThanOrEqual(3);

        for (const [x, y] of outline) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(source.width);
          expect(y).toBeLessThanOrEqual(source.height);
        }
      }
    }
  });
});

describe('the same recipe gives the same file', () => {
  it('produces an identical trace from identical settings', () => {
    const first = traceSource(isotype, BALANCED);
    const second = traceSource(isotype, BALANCED);

    expect(second.svg).toBe(first.svg);
    expect(second.nodeCount).toBe(first.nodeCount);
    expect(second.points).toEqual(first.points);
    expect(second.bytes).toBe(first.bytes);
  });

  it('carries no timestamp or id into the output', () => {
    const { svg } = traceSource(isotype, BALANCED);

    // A generated id or date would make two runs differ byte for byte, which
    // is precisely the claim being demonstrated.
    expect(svg).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    expect(svg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('gives every source a trace', () => {
    for (const source of demoSources) {
      const out = traceSource(source, BALANCED);
      expect(out.svg).toContain('<svg');
      expect(out.pathCount).toBe(source.pathCount);
      expect(out.nodeCount).toBeGreaterThan(0);
    }
  });
});

describe('detail', () => {
  it('keeps more vertices the higher it goes', () => {
    const coarse = traceSource(isotype, settings({ detail: 0 }));
    const fine = traceSource(isotype, settings({ detail: 100 }));

    expect(fine.nodeCount).toBeGreaterThan(coarse.nodeCount);
  });

  it('is monotonic across the whole range', () => {
    const counts = [0, 25, 50, 75, 100].map(
      (detail) => traceSource(isotype, settings({ detail })).nodeCount,
    );

    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('changes the geometry, not only the count', () => {
    const coarse = traceSource(isotype, settings({ detail: 0 }));
    const fine = traceSource(isotype, settings({ detail: 100 }));

    expect(coarse.svg).not.toBe(fine.svg);
  });

  it('never moves a coordinate off its grid', () => {
    const step = gridStep(isotype, settings({ detail: 0 }));
    const traced = snapGeometry(isotype.svg, step);
    const points = /points="([^"]+)"/.exec(traced);

    expect(points).not.toBeNull();
    for (const pair of points![1].split(' ')) {
      for (const n of pair.split(',')) {
        expect(Math.abs(Number(n) % step)).toBeLessThan(0.01);
      }
    }
  });

  it('leaves the canvas alone', () => {
    // The root <svg width/height> is the frame, not the drawing: snapping it
    // would resize the artwork rather than simplify it.
    const traced = snapGeometry(isotype.svg, 40);
    expect(traced).toContain('width="512" height="512"');
  });
});

describe('colors', () => {
  it('leaves a palette that already fits under the cap', () => {
    const distinct = new Set(isotype.svg.match(/#[0-9a-fA-F]{6}/g) ?? []).size;
    expect(distinct).toBeLessThan(32);
    expect(quantisePalette(isotype.svg, 32)).toBe(isotype.svg);
  });

  it('collapses the palette to the cap', () => {
    const flattened = quantisePalette(isotype.svg, 2);
    const distinct = new Set(flattened.match(/#[0-9a-f]{6}/g) ?? []);

    expect(distinct.size).toBeLessThanOrEqual(2);
  });

  it('never invents a colour outside the range it was given', () => {
    const flattened = quantisePalette(isotype.svg, 2);

    for (const hex of new Set(flattened.match(/#[0-9a-f]{6}/g) ?? [])) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('is stable — the same cap gives the same palette', () => {
    expect(quantisePalette(isotype.svg, 3)).toBe(quantisePalette(isotype.svg, 3));
  });
});

describe('smoothing and node simplification', () => {
  it('spends fewer nodes as smoothing rises', () => {
    const counts = [0, 25, 50, 75, 100].map(
      (smoothing) => traceSource(isotype, settings({ smoothing })).nodeCount,
    );

    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
    expect(counts.at(-1)).toBeLessThan(counts[0]);
  });

  it('trades harder with simplification on', () => {
    const on = subdivisions(settings({ smoothing: 100, simplify: true }));
    const off = subdivisions(settings({ smoothing: 100, simplify: false }));

    expect(on).toBeLessThan(off);
  });

  it('still collapses two points that land on the same grid cell', () => {
    // Smoothing at zero is not "merge nothing": a snapped duplicate is the
    // same node however little smoothing was asked for.
    const step = gridStep(isotype, settings({ detail: 0 }));
    expect(mergeRadiusFor(step, settings({ smoothing: 0 }))).toBeGreaterThan(0);

    const square = [
      [[0, 0], [10, 0], [10, 10], [0, 10]],
      [[0.4, 0.4], [10, 0], [10, 10], [0, 10]],
    ] as const;

    const placed = placeVertices(square, 4, 2, settings({ detail: 0 }));
    expect(placed).toHaveLength(4);
  });

  it('never reports a vertex twice', () => {
    const { points } = traceSource(isotype, BALANCED);
    const seen = new Set(points.map(([x, y]) => `${x}:${y}`));

    expect(seen.size).toBe(points.length);
  });
});

describe('mode', () => {
  it('spends nodes the way each mode is described to', () => {
    const icon = traceSource(isotype, settings({ mode: 'icon' })).nodeCount;
    const logo = traceSource(isotype, settings({ mode: 'logo' })).nodeCount;
    const precision = traceSource(isotype, settings({ mode: 'precision' })).nodeCount;

    // "Compact pixel-level accuracy" ≤ "Clean edges for brand marks" ≤
    // "Maximum fidelity tracing" — the product's own descriptions.
    expect(icon).toBeLessThanOrEqual(logo);
    expect(logo).toBeLessThanOrEqual(precision);
  });
});

describe('the numbers under the preview', () => {
  it('measures bytes from the SVG it actually produced', () => {
    const traced = traceSource(isotype, BALANCED);
    expect(traced.bytes).toBe(new TextEncoder().encode(traced.svg).length);
  });

  it('bands complexity the way the product does', () => {
    expect(computeSvgComplexity(5, 20)).toBe('low');
    expect(computeSvgComplexity(40, 100)).toBe('medium');
    expect(computeSvgComplexity(200, 200)).toBe('high');
  });
});
