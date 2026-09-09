/**
 * VectorForge demo fixtures.
 *
 * The workstation's sample project: a handful of source files, the four trace
 * modes the product ships, and the icon package a launch actually needs.
 *
 * ─── The one fixture that is not invented ─────────────────────────────────
 * The icon sizes. Those are the real list — 16 through 512, the Apple touch
 * icon at 180, the maskable Android icon, `favicon.ico` — because that list is
 * the product's whole argument: it is tedious, it is exact, and getting it
 * wrong is why people end up with a blurry tab icon. Inventing a prettier list
 * would have thrown away the only part of this demo that teaches anything.
 *
 * Everything else — the file names, the byte counts, the path and node counts
 * — is fabricated but internally consistent: `traceOf` in state.ts derives
 * every number from the source and the settings, so the same recipe always
 * produces the same output. That reproducibility is the product's other
 * argument, and a demo with random results would contradict it.
 */

export type SourceKind = 'flat' | 'detailed' | 'photographic';

export interface DemoAsset {
  id: string;
  name: string;
  kind: SourceKind;
  width: number;
  height: number;
  /** Source size in bytes. */
  bytes: number;
  /** Distinct colours in the source. Drives palette handling. */
  colours: number;
}

export const assets: readonly DemoAsset[] = [
  {
    id: 'a-logo',
    name: 'northwind-logo.png',
    kind: 'flat',
    width: 1200,
    height: 400,
    bytes: 184_320,
    colours: 3,
  },
  {
    id: 'a-mark',
    name: 'app-mark.png',
    kind: 'flat',
    width: 1024,
    height: 1024,
    bytes: 96_256,
    colours: 2,
  },
  {
    id: 'a-badge',
    name: 'quality-badge.png',
    kind: 'detailed',
    width: 900,
    height: 900,
    bytes: 412_672,
    colours: 12,
  },
  {
    id: 'a-illustration',
    name: 'hero-illustration.png',
    kind: 'detailed',
    width: 2400,
    height: 1350,
    bytes: 1_884_160,
    colours: 34,
  },
  {
    id: 'a-photo',
    name: 'team-photo.jpg',
    kind: 'photographic',
    width: 3000,
    height: 2000,
    bytes: 3_512_320,
    colours: 4096,
  },
];

export interface DemoMode {
  id: string;
  name: string;
  detail: string;
  /** Defaults the mode loads. The visitor can still move them. */
  threshold: number;
  smoothing: number;
  /** Maximum colours in the traced output. */
  palette: number;
  /** Source kinds this mode is designed for. */
  suits: readonly SourceKind[];
}

export const modes: readonly DemoMode[] = [
  {
    id: 'logo',
    name: 'Logo',
    detail: 'Two or three flat colours, hard edges, minimum node count.',
    threshold: 62,
    smoothing: 30,
    palette: 4,
    suits: ['flat'],
  },
  {
    id: 'icon',
    name: 'Icon',
    detail: 'Single-shape marks optimised to stay legible at 16 px.',
    threshold: 55,
    smoothing: 45,
    palette: 2,
    suits: ['flat'],
  },
  {
    id: 'illustration',
    name: 'Illustration',
    detail: 'Many colours, soft transitions, layered output.',
    threshold: 48,
    smoothing: 60,
    palette: 24,
    suits: ['flat', 'detailed'],
  },
  {
    id: 'precision',
    name: 'Precision',
    detail: 'Maximum fidelity. Slower, and produces far more nodes.',
    threshold: 40,
    smoothing: 15,
    palette: 64,
    suits: ['flat', 'detailed', 'photographic'],
  },
];

/** The icon and favicon package a launch needs. */
export interface IconTarget {
  id: string;
  label: string;
  file: string;
  /** Pixel size, or 0 for a multi-resolution container. */
  size: number;
  /** Selected by default: the set nobody should have to think about. */
  standard: boolean;
}

export const iconTargets: readonly IconTarget[] = [
  { id: 'ico', label: 'favicon.ico (16/32/48)', file: 'favicon.ico', size: 0, standard: true },
  { id: 'png-16', label: '16 × 16', file: 'favicon-16x16.png', size: 16, standard: true },
  { id: 'png-32', label: '32 × 32', file: 'favicon-32x32.png', size: 32, standard: true },
  { id: 'png-48', label: '48 × 48', file: 'favicon-48x48.png', size: 48, standard: false },
  { id: 'apple-180', label: 'Apple touch icon (180)', file: 'apple-touch-icon.png', size: 180, standard: true },
  { id: 'png-192', label: 'Android 192', file: 'android-chrome-192x192.png', size: 192, standard: true },
  { id: 'maskable-512', label: 'Maskable 512', file: 'maskable-icon-512x512.png', size: 512, standard: true },
  { id: 'png-256', label: '256 × 256', file: 'icon-256x256.png', size: 256, standard: false },
  { id: 'svg', label: 'Scalable SVG', file: 'icon.svg', size: 0, standard: true },
];

/** The steps the tracer reports while it works. */
export const TRACE_STEPS = [
  'Reading source',
  'Quantising palette',
  'Detecting edges',
  'Fitting curves',
  'Simplifying paths',
  'Optimising output',
] as const;

export const EXPORT_STEPS = [
  'Rendering raster targets',
  'Writing manifest',
  'Compressing package',
] as const;

export function findAsset(id: string): DemoAsset | undefined {
  return assets.find((asset) => asset.id === id);
}

export function findMode(id: string): DemoMode | undefined {
  return modes.find((mode) => mode.id === id);
}

/** `184 KB`, the way a file browser writes it. */
export function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
