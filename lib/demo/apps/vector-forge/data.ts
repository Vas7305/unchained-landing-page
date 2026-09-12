/**
 * VectorForge demo fixtures — the sample project the demo opens with.
 *
 * ─── Where these come from ────────────────────────────────────────────────
 * The three source images are the product's own brand artwork, rasterised
 * from `src/assets/brand/*.svg` in the VectorForge repository at the sizes a
 * designer would actually hand over. The `svg` on each entry is that same
 * original file, verbatim.
 *
 * That pairing is deliberate. A tracing demo has to show a before and an
 * after, and any *invented* "after" would be a drawing of a result rather
 * than a result. Here the vector genuinely is what the raster was made from,
 * so the split view shows a true reconstruction — and `outlines` are the real
 * shapes of that vector, read out of its path data, so the node overlay lands
 * on the geometry instead of on scattered dots.
 *
 * Nothing here is fetched. The PNGs are static files under
 * `public/demo/vector-forge/`, the SVGs are string literals, and the byte
 * counts are the real sizes of both.
 *
 * How the settings move the shapes: lib/demo/apps/vector-forge/trace.ts.
 */

export interface DemoSource {
  id: string;
  /** File name as it appears in the asset browser. */
  name: string;
  /** Public URL. Doubles as the "path" the product's stores carry around. */
  path: string;
  width: number;
  height: number;
  /** Real size of the PNG on disk. */
  bytes: number;
  format: 'png';
  /** The vector this raster was made from — what a perfect trace recovers. */
  svg: string;
  /** Real size of that SVG. */
  svgBytes: number;
  /** Drawable shapes in it. */
  pathCount: number;
  /**
   * One closed outline per shape, in the rendered pixel space of `svg`.
   *
   * Grouped rather than flattened because the tracer subdivides *along edges*:
   * a midpoint between two vertices of the same hexagon is on the outline, and
   * a midpoint between the last vertex of one shape and the first of the next
   * is in empty space.
   */
  outlines: readonly (readonly (readonly [number, number])[])[];
}

export const demoSources: readonly DemoSource[] = [
  {
    id: 'a-app-icon',
    name: 'vectorforge-app-icon.png',
    path: '/demo/vector-forge/vectorforge-app-icon.png',
    width: 1024,
    height: 1024,
    bytes: 60_699,
    format: 'png',
    svgBytes: 1_144,
    pathCount: 7,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="vfBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F3329"></stop>
      <stop offset="0.7" stop-color="#0A1B17"></stop>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="228" fill="url(#vfBg)"></rect>
  <rect x="6" y="6" width="1012" height="1012" rx="224" fill="none" stroke="#1FB896" stroke-width="6"></rect>
  <g transform="translate(262,262) scale(5.0)">
    <polygon points="50,7 88,28.5 88,71.5 50,93 12,71.5 12,28.5" fill="none" stroke="#1FB896" stroke-width="3"></polygon>
    <path d="M32,38 L50,66 L68,38" fill="none" stroke="#5BE0C0" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <rect x="28.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B1714" stroke="#5BE0C0" stroke-width="2.4"></rect>
    <rect x="64.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B1714" stroke="#5BE0C0" stroke-width="2.4"></rect>
    <rect x="46.2" y="62.2" width="7.6" height="7.6" rx="1" fill="#5BE0C0"></rect>
  </g>
</svg>`,
    outlines: [
      [[512.0, 297.0], [702.0, 404.5], [702.0, 619.5], [512.0, 727.0], [322.0, 619.5], [322.0, 404.5]],
      [[422.0, 452.0], [512.0, 592.0], [602.0, 452.0]],
      [[403.0, 433.0], [441.0, 433.0], [441.0, 471.0], [403.0, 471.0]],
      [[583.0, 433.0], [621.0, 433.0], [621.0, 471.0], [583.0, 471.0]],
      [[493.0, 573.0], [531.0, 573.0], [531.0, 611.0], [493.0, 611.0]],
      [[0.0, 0.0], [1024.0, 0.0], [1024.0, 1024.0], [0.0, 1024.0]],
      [[6.0, 6.0], [1018.0, 6.0], [1018.0, 1018.0], [6.0, 1018.0]],
    ],
  },
  {
    id: 'a-isotype',
    name: 'vectorforge-isotype.png',
    path: '/demo/vector-forge/vectorforge-isotype.png',
    width: 512,
    height: 512,
    bytes: 13_564,
    format: 'png',
    svgBytes: 680,
    pathCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" fill="none">
  <polygon points="50,7 88,28.5 88,71.5 50,93 12,71.5 12,28.5" fill="#0E2A24" stroke="#1FB896" stroke-width="3"></polygon>
  <path d="M32,38 L50,66 L68,38" fill="none" stroke="#5BE0C0" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"></path>
  <rect x="28.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B0F14" stroke="#5BE0C0" stroke-width="2.4"></rect>
  <rect x="64.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B0F14" stroke="#5BE0C0" stroke-width="2.4"></rect>
  <rect x="46.2" y="62.2" width="7.6" height="7.6" rx="1" fill="#5BE0C0"></rect>
</svg>`,
    outlines: [
      [[256.0, 35.8], [450.6, 145.9], [450.6, 366.1], [256.0, 476.2], [61.4, 366.1], [61.4, 145.9]],
      [[163.8, 194.6], [256.0, 337.9], [348.2, 194.6]],
      [[144.4, 175.1], [183.3, 175.1], [183.3, 214.0], [144.4, 214.0]],
      [[328.7, 175.1], [367.6, 175.1], [367.6, 214.0], [328.7, 214.0]],
      [[236.5, 318.5], [275.5, 318.5], [275.5, 357.4], [236.5, 357.4]],
    ],
  },
  {
    id: 'a-inverse',
    name: 'vectorforge-isotype-inverse.png',
    path: '/demo/vector-forge/vectorforge-isotype-inverse.png',
    width: 512,
    height: 512,
    bytes: 13_593,
    format: 'png',
    svgBytes: 680,
    pathCount: 5,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" fill="none">
  <polygon points="50,7 88,28.5 88,71.5 50,93 12,71.5 12,28.5" fill="#D8EFE9" stroke="#006D5B" stroke-width="3"></polygon>
  <path d="M32,38 L50,66 L68,38" fill="none" stroke="#006D5B" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"></path>
  <rect x="28.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#FFFFFF" stroke="#006D5B" stroke-width="2.4"></rect>
  <rect x="64.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#FFFFFF" stroke="#006D5B" stroke-width="2.4"></rect>
  <rect x="46.2" y="62.2" width="7.6" height="7.6" rx="1" fill="#006D5B"></rect>
</svg>`,
    outlines: [
      [[256.0, 35.8], [450.6, 145.9], [450.6, 366.1], [256.0, 476.2], [61.4, 366.1], [61.4, 145.9]],
      [[163.8, 194.6], [256.0, 337.9], [348.2, 194.6]],
      [[144.4, 175.1], [183.3, 175.1], [183.3, 214.0], [144.4, 214.0]],
      [[328.7, 175.1], [367.6, 175.1], [367.6, 214.0], [328.7, 214.0]],
      [[236.5, 318.5], [275.5, 318.5], [275.5, 357.4], [236.5, 357.4]],
    ],
  },
];

/**
 * The project the workstation opens with.
 *
 * `dir` is a path-shaped label, not a path: nothing in this demo touches a
 * filesystem, and the product's stores only ever pass it through.
 */
export const demoProject = {
  id: 'vf-demo-brand-kit',
  name: 'VectorForge Brand Kit',
  description: 'Source marks and their traced vectors',
  dir: 'Projects/VectorForge Brand Kit',
  createdAt: Date.UTC(2026, 0, 19, 9, 30),
  updatedAt: Date.UTC(2026, 1, 3, 16, 12),
} as const;

/** Look a source up by id. */
export function findSource(id: string | null): DemoSource | undefined {
  return demoSources.find((source) => source.id === id);
}
