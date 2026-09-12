/**
 * The tracer, as far as a browser can honestly go.
 *
 * ─── What this is, and what it is not ─────────────────────────────────────
 * VectorForge traces a raster image into vectors in a Rust core. That core is
 * not something a marketing page can ship, and a demo may not pretend it has.
 *
 * What this module does instead is the half of the job that *is* real. Each
 * sample source is a rasterised copy of a vector the repository still has, so
 * the perfect trace of it is known exactly — and the controls a visitor
 * reaches for then do to that vector what a tracer's equivalents do to its
 * output:
 *
 *   - **Detail** does two things at once, as it does in a real tracer. It sets
 *     how finely the outline is resampled, and it sets the grid every
 *     coordinate is snapped to. Turned down, the shapes go blocky and vertices
 *     collapse into each other; turned up, the outline carries more nodes and
 *     keeps its precision.
 *   - **Colors** caps the palette. Past the cap the colours are clustered by
 *     luminance and each group collapses to its mean, which is how a tracer
 *     flattens shading into bands.
 *   - **Smoothing** and **node simplification** give nodes back: fewer points
 *     describing the same outline, which is the trade the sliders name. What
 *     survives is also merged where two points land on the same grid cell.
 *   - **Mode** scales both the grid and the resampling density, because that
 *     is the difference between the product's four modes: how much geometry
 *     each is willing to keep.
 *
 * So the preview genuinely responds to the controls, the numbers under it are
 * measured from the SVG that was actually produced, and every one of them is a
 * function of the settings alone: the same recipe gives the same file, which
 * is the product's own claim.
 *
 * Pure and synchronous. The delay, the progress and the cancellation belong to
 * components/demo/apps/vector-forge/vendor/services/vectorize.ts, which is the
 * only asynchronous thing in this demo.
 */

import type { DemoSource } from './data';

/** The product's four trace modes. */
export type TraceMode = 'logo' | 'icon' | 'illustration' | 'precision';

export interface TraceSettings {
  mode: TraceMode;
  /** 0–100. */
  detail: number;
  /** 2–32. */
  colors: number;
  /** 0–100. */
  smoothing: number;
  /** The product's "Node simplification" switch. */
  simplify: boolean;
}

export interface TraceOutput {
  /** The SVG the preview shows and the export writes. */
  svg: string;
  /** Drawable shapes it contains. */
  pathCount: number;
  /** Vertices left after resampling, snapping and merging. */
  nodeCount: number;
  /** Those vertices, in the SVG's rendered pixel space, for the node overlay. */
  points: [number, number][];
  /** Size of `svg` in bytes. */
  bytes: number;
}

/**
 * How finely each mode works.
 *
 * An icon is small and wants few nodes; a precision trace wants all of them.
 * Each mode scales two things — the snapping grid and how densely the outline
 * is resampled — so a mode change shows up in the preview and in the node
 * count, not only in a label. The order matches the descriptions the product
 * prints on the four mode cards: "compact pixel-level accuracy", "clean edges
 * for brand marks", "rich detail and colour depth", "maximum fidelity".
 */
const MODE_GRID: Record<TraceMode, number> = {
  icon: 1.6,
  logo: 1,
  illustration: 0.8,
  precision: 0.35,
};

const MODE_DENSITY: Record<TraceMode, number> = {
  icon: 0.7,
  logo: 1,
  illustration: 1.25,
  precision: 1.5,
};

/** Extra points per edge at full detail, before the mode and smoothing scale it. */
const MAX_SUBDIVISIONS = 8;

const NUMBER = /-?\d+(?:\.\d+)?/g;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function viewBoxWidth(svg: string): number {
  const match = /viewBox="0 0 (-?\d+(?:\.\d+)?) /.exec(svg);
  return match ? Number(match[1]) : 100;
}

/**
 * The grid, in the SVG's own user units.
 *
 * Detail 100 lands at a quarter of a percent of the artwork's width — below
 * what anybody can see — and detail 0 at a little over two percent, which is
 * visibly chunky without destroying the mark. Anything coarser would look like
 * a bug rather than a setting.
 */
export function gridStep(source: DemoSource, settings: TraceSettings): number {
  const fraction = 0.0025 + ((100 - clamp(settings.detail, 0, 100)) / 100) * 0.02;
  return viewBoxWidth(source.svg) * fraction * MODE_GRID[settings.mode];
}

function snap(value: number, step: number): number {
  if (step <= 0) return value;
  // Rounded to three places so the output is a stable string: floating point
  // would otherwise put 34.199999999999996 in one build and 34.2 in the next.
  return Number((Math.round(value / step) * step).toFixed(3));
}

/* ── Colour ─────────────────────────────────────────────────────────────── */

const HEX = /#[0-9a-fA-F]{6}\b/g;

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mean(hexes: readonly string[]): string {
  const total = hexes.reduce(
    (acc, hex) => [
      acc[0] + parseInt(hex.slice(1, 3), 16),
      acc[1] + parseInt(hex.slice(3, 5), 16),
      acc[2] + parseInt(hex.slice(5, 7), 16),
    ],
    [0, 0, 0],
  );
  const channel = (sum: number) =>
    Math.round(sum / hexes.length)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(total[0])}${channel(total[1])}${channel(total[2])}`;
}

/**
 * Cap the palette at `limit` colours.
 *
 * Clustered by luminance rather than by hue, because that is what a tracer
 * working from a rasterised image has to do: it sees tones, not intentions.
 * Groups are contiguous and evenly sized, so the mapping depends on the
 * artwork and the limit and on nothing else.
 */
export function quantisePalette(svg: string, limit: number): string {
  const distinct = [...new Set(svg.match(HEX) ?? [])].map((hex) => hex.toLowerCase());
  if (distinct.length <= limit) return svg;

  const ordered = [...distinct].sort((a, b) => luminance(a) - luminance(b));
  const perGroup = Math.ceil(ordered.length / limit);
  const mapping = new Map<string, string>();

  for (let start = 0; start < ordered.length; start += perGroup) {
    const group = ordered.slice(start, start + perGroup);
    const replacement = mean(group);
    for (const hex of group) mapping.set(hex, replacement);
  }

  return svg.replace(HEX, (hex) => mapping.get(hex.toLowerCase()) ?? hex);
}

/* ── Geometry ───────────────────────────────────────────────────────────── */

/** Attributes whose numbers are positions or sizes in user space. */
const GEOMETRY_ATTRS = /\s(points|d|x|y|width|height|cx|cy|r|x1|y1|x2|y2)="([^"]*)"/g;

/**
 * Snap every coordinate in the document to the grid.
 *
 * Only the attributes above are touched: snapping `stroke-width` would change
 * the weight of the artwork, which is not something a detail control does. The
 * root `<svg width/height>` is left alone for the same reason — it is the
 * canvas, not the drawing.
 */
export function snapGeometry(svg: string, step: number): string {
  const rootEnd = svg.indexOf('>') + 1;
  const head = svg.slice(0, rootEnd);
  const body = svg.slice(rootEnd);

  const snapped = body.replace(
    GEOMETRY_ATTRS,
    (_match, attr: string, value: string) =>
      ` ${attr}="${value.replace(NUMBER, (n) => String(snap(Number(n), step)))}"`,
  );

  return head + snapped;
}

/* ── Vertices ───────────────────────────────────────────────────────────── */

/**
 * How many points to place between each pair of corners.
 *
 * Detail asks for them, the mode scales the request, and smoothing gives some
 * back — which is what smoothing is: fewer nodes describing the same outline,
 * bought at the cost of how tightly the curve follows the original. The
 * simplification switch makes that trade harder, as the product's label says.
 */
export function subdivisions(settings: TraceSettings): number {
  const asked =
    (clamp(settings.detail, 0, 100) / 100) * MAX_SUBDIVISIONS * MODE_DENSITY[settings.mode];
  const returned = (clamp(settings.smoothing, 0, 100) / 100) * (settings.simplify ? 0.75 : 0.4);

  return Math.round(asked * (1 - returned));
}

/**
 * Walk one closed outline, placing nodes as the settings ask for them.
 *
 * The three operations are the tracer's, in the tracer's order: resample the
 * edge, snap what comes out to the grid, then drop anything that landed on top
 * of something already placed. Low detail therefore loses nodes twice over —
 * fewer are asked for, and a coarser grid collapses more of those that were —
 * which is why the count moves as far as it does across the slider.
 */
function walkOutline(
  outline: readonly (readonly [number, number])[],
  step: number,
  mergeRadius: number,
  extra: number,
  kept: [number, number][],
): void {
  const place = (x: number, y: number) => {
    const sx = snap(x, step);
    const sy = snap(y, step);
    const near = kept.some(
      ([kx, ky]) => Math.hypot(kx - sx, ky - sy) <= Math.max(mergeRadius, 0.01),
    );
    if (!near) kept.push([sx, sy]);
  };

  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i];
    place(ax, ay);

    // The last edge closes the shape. A three-point path — the tick inside the
    // mark — is open, but treating it as closed only ever adds points along a
    // line the artwork already draws, so the distinction costs nothing here.
    const [bx, by] = outline[(i + 1) % outline.length];
    for (let k = 1; k <= extra; k++) {
      const t = k / (extra + 1);
      place(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
}

/**
 * Every node the trace ends up with, across every shape.
 *
 * `step` and `mergeRadius` arrive in the same pixel space as the outlines, so
 * callers convert once rather than this function guessing.
 */
export function placeVertices(
  outlines: DemoSource['outlines'],
  step: number,
  mergeRadius: number,
  settings: TraceSettings,
): [number, number][] {
  const kept: [number, number][] = [];
  const extra = subdivisions(settings);

  for (const outline of outlines) {
    walkOutline(outline, step, mergeRadius, extra, kept);
  }

  return kept;
}

/**
 * How close is close enough to be the same node.
 *
 * Smoothing is the slider that buys a softer outline by spending vertices, and
 * the simplification switch is the product's blunter version of the same
 * trade. With both at zero the radius is still not zero — two nodes snapped to
 * the same grid point are the same node regardless of what the sliders say.
 */
export function mergeRadiusFor(step: number, settings: TraceSettings): number {
  const fromSmoothing = (clamp(settings.smoothing, 0, 100) / 100) * (settings.simplify ? 1.4 : 0.8);
  return step * (0.5 + fromSmoothing);
}

/* ── The trace ──────────────────────────────────────────────────────────── */

/** Run the settings over a source and report what came out. */
export function traceSource(source: DemoSource, settings: TraceSettings): TraceOutput {
  const step = gridStep(source, settings);
  const svg = quantisePalette(snapGeometry(source.svg, step), clamp(settings.colors, 2, 32));

  // Outlines are stored in rendered pixels; the grid is in user units.
  const scale = source.width / viewBoxWidth(source.svg);
  const pixelStep = step * scale;
  const points = placeVertices(
    source.outlines,
    pixelStep,
    mergeRadiusFor(pixelStep, settings),
    settings,
  );

  return {
    svg,
    pathCount: source.pathCount,
    nodeCount: points.length,
    points,
    bytes: new TextEncoder().encode(svg).length,
  };
}

/** The product's own complexity banding, unchanged. */
export function computeSvgComplexity(
  pathCount: number,
  nodeCount: number,
): 'low' | 'medium' | 'high' {
  const score = pathCount * 2 + nodeCount;
  if (score < 100) return 'low';
  if (score < 500) return 'medium';
  return 'high';
}
