import type { DemoDefinition } from './types';

/**
 * Which products have an interactive demo, and what each one looks like before
 * its code is loaded.
 *
 * ─── This is the only file in the demo system that names a product ────────
 * That is the whole point of it. The shell, the stage, the device frames, the
 * shared UI primitives, the simulation layer and the route are written against
 * lib/demo/types.ts and contain no product name, no slug and no special case;
 * this map is the seam where the generic half meets the specific half. Adding
 * a ninth demo is an entry here plus two folders, and touches nothing else.
 *
 * ─── Why a code registry when the portfolio is a database ─────────────────
 * The portfolio is published from the admin panel and read at request time
 * (lib/portfolio.ts). A demo is not content — it is a program — so it cannot
 * arrive from a table, and a `has_demo` column would be a second source of
 * truth able to claim a demo this repository does not contain. The two are
 * joined at the point of use instead: the site offers a demo for a project
 * when the database published it AND this map has an entry for its slug. A
 * project removed from the panel loses its demo route with it, and a demo
 * added here stays invisible until the project it belongs to is published.
 *
 * ─── The theme is not decoration ──────────────────────────────────────────
 * §17: the visitor should feel they are using the product, not reading a
 * presentation about it. Eight products rendered in this website's palette
 * would all look like this website. Each entry therefore carries the product's
 * own colours, radius and type, which the shared primitives resolve through
 * CSS custom properties — one DemoButton that is correct in a Caribbean
 * marketplace and in a private-equity console.
 *
 * Contrast note: every `--d-muted` below was chosen to stay legible on both
 * `--d-bg` and `--d-surface`, and every `--d-accent-fg` against its accent.
 */
export const demoRegistry: Record<string, DemoDefinition> = {
  /* ── Marketplace and delivery, consumer side ───────────────────────────── */
  tancerca: {
    frame: 'phone',
    lang: 'es',
    surfaceLabel: 'TanCerca',
    theme: {
      '--d-bg': '#f4f1ec',
      '--d-surface': '#ffffff',
      '--d-surface-2': '#faf7f3',
      '--d-border': '#e4ded5',
      '--d-fg': '#231d18',
      '--d-muted': '#6d6157',
      '--d-accent': '#c8481f',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#a63a17',
      '--d-positive': '#2f7d4f',
      '--d-danger': '#b3261e',
      '--d-radius': '14px',
    },
    scenarios: [
      {
        id: 'nuevo',
        label: 'Cliente nuevo',
        hint: 'Carrito vacío, sin dirección guardada.',
      },
      {
        id: 'habitual',
        label: 'Cliente habitual',
        hint: 'Dirección guardada y un pedido anterior para repetir.',
      },
    ],
    load: () => import('@/components/demo/apps/tancerca/App'),
  },

  /* ── Salon services, catalogue and booking ─────────────────────────────── */
  'lanna-kamilina': {
    frame: 'browser',
    lang: 'ru',
    surfaceLabel: 'lannakamilina.ru',
    fontFamily: 'Georgia, "Times New Roman", serif',
    theme: {
      '--d-bg': '#f7f3ee',
      '--d-surface': '#ffffff',
      '--d-surface-2': '#f2ebe3',
      '--d-border': '#e0d5c8',
      '--d-fg': '#2b2019',
      '--d-muted': '#6b5c50',
      '--d-accent': '#8c3a52',
      '--d-accent-fg': '#fdf8f4',
      '--d-ring': '#732c42',
      '--d-positive': '#41684c',
      '--d-danger': '#a32d24',
      '--d-radius': '4px',
    },
    scenarios: [{ id: 'zapis', label: 'Онлайн-запись' }],
    load: () => import('@/components/demo/apps/lanna-kamilina/App'),
  },

  /* ── Makeup artist portfolio and enquiry ───────────────────────────────── */
  'lazara-sersa': {
    frame: 'browser',
    lang: 'en',
    surfaceLabel: 'lazarasersa.com',
    theme: {
      // Copied from the product's own /d/Sersa Sarria/styles/tokens.css, whose
      // values are themselves sampled from the brand lockup: `paper` #e9d2cc is
      // the artwork's ground and `rose-taupe` #be968e is the LS monogram.
      //
      // These drive the *frame* around the demo — its address bar and window
      // chrome. Inside the frame the product's full stylesheet is in force
      // through vendor/styles/surface.module.css, so this is deliberately the
      // same palette rather than a second opinion about it.
      '--d-bg': '#e9d2cc',
      '--d-surface': '#faf4f2',
      '--d-surface-2': '#f2e4e0',
      '--d-border': '#e0c6c0',
      '--d-fg': '#191412',
      '--d-muted': '#6e5853',
      '--d-accent': '#191412',
      '--d-accent-fg': '#faf4f2',
      '--d-ring': '#8c4b39',
      '--d-positive': '#4b6b4f',
      '--d-danger': '#8c4b39',
      '--d-radius': '2px',
    },
    scenarios: [{ id: 'portfolio', label: 'Portfolio & enquiry' }],
    load: () => import('@/components/demo/apps/lazara-sersa/App'),
  },

  /* ── Single-night gala: programme and seat reservation ─────────────────── */
  'klassisches-ballet': {
    frame: 'browser',
    lang: 'de',
    surfaceLabel: 'klassisches-ballett-gala.de',
    fontFamily: 'Georgia, "Times New Roman", serif',
    theme: {
      '--d-bg': '#0b0f18',
      '--d-surface': '#131926',
      '--d-surface-2': '#1a2231',
      '--d-border': '#2a3446',
      '--d-fg': '#f2ece0',
      '--d-muted': '#a79f8f',
      '--d-accent': '#c9a961',
      '--d-accent-fg': '#14100a',
      '--d-ring': '#dcc083',
      '--d-positive': '#8bb083',
      '--d-danger': '#d9736a',
      '--d-radius': '2px',
    },
    scenarios: [
      {
        id: 'vorverkauf',
        label: 'Vorverkauf',
        hint: 'Alle Kategorien sind verfügbar.',
      },
      {
        id: 'endspurt',
        label: 'Letzte Plätze',
        hint: 'Zwei Kategorien sind bereits ausverkauft.',
      },
    ],
    load: () => import('@/components/demo/apps/klassisches-ballet/App'),
  },

  /* ── Psychology consultations: directory and appointment booking ───────── */
  mensalere: {
    frame: 'browser',
    // English, not Spanish. The vendored frontend is the product's own, and
    // the product ships in English — "Find the right professional", "How it
    // works", "Login". The Spanish here was this demo's assumption before the
    // application's source was read.
    lang: 'en',
    surfaceLabel: 'mensalere.com',
    theme: {
      // Copied from the product's own /d/Mensalere/src/styles/index.css.
      // These drive the *frame* around the demo; inside it the same tokens are
      // in force through the `ms-`-namespaced @theme in app/globals.css, so
      // this is the same palette rather than a second opinion about it.
      '--d-bg': '#f9f8f5',
      '--d-surface': '#ffffff',
      '--d-surface-2': '#e9eee9',
      '--d-border': '#e6e4df',
      '--d-fg': '#20201f',
      '--d-muted': '#6f706d',
      '--d-accent': '#637469',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#55645a',
      '--d-positive': '#637469',
      '--d-danger': '#9c4e4e',
      '--d-radius': '8px',
    },
    scenarios: [{ id: 'find', label: 'Find a professional' }],
    load: () => import('@/components/demo/apps/mensalere/App'),
  },

  /* ── Dating app: onboarding, discovery, matches, conversation ──────────── */
  frito: {
    frame: 'phone',
    lang: 'es',
    surfaceLabel: 'Frito',
    theme: {
      '--d-bg': '#100d18',
      '--d-surface': '#1a1526',
      '--d-surface-2': '#241d33',
      '--d-border': '#352c4a',
      '--d-fg': '#f6f2ff',
      '--d-muted': '#aca0c6',
      '--d-accent': '#ff4d6d',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#ff7d95',
      '--d-positive': '#4ecf9a',
      '--d-danger': '#ff6b6b',
      '--d-radius': '22px',
    },
    scenarios: [
      { id: 'registro', label: 'Usuario nuevo', hint: 'Empieza en el registro.' },
      {
        id: 'activo',
        label: 'Con conversaciones',
        hint: 'Perfil listo y dos matches esperando.',
      },
    ],
    load: () => import('@/components/demo/apps/frito/App'),
  },

  /* ── Private-equity operating system ───────────────────────────────────── */
  'unchained-os': {
    frame: 'desktop',
    lang: 'en',
    surfaceLabel: 'Unchained OS — Fund I',
    theme: {
      '--d-bg': '#0b0d11',
      '--d-surface': '#14171e',
      '--d-surface-2': '#1b1f28',
      '--d-border': '#262c38',
      '--d-fg': '#e8ecf3',
      '--d-muted': '#8e99ab',
      '--d-accent': '#5b8def',
      '--d-accent-fg': '#08101f',
      '--d-ring': '#7ba5f5',
      '--d-positive': '#3fbf85',
      '--d-danger': '#e2685e',
      '--d-radius': '8px',
    },
    scenarios: [
      {
        id: 'pipeline',
        label: 'Pipeline review',
        hint: 'Start on the deal pipeline.',
      },
      {
        id: 'allocation',
        label: 'Capital allocation',
        hint: 'Start with the committee ready to allocate.',
      },
    ],
    load: () => import('@/components/demo/apps/unchained-os/App'),
  },

  /* ── Desktop asset production workstation ──────────────────────────────── */
  'vector-forge': {
    frame: 'desktop',
    lang: 'en',
    surfaceLabel: 'VectorForge 1.0',
    theme: {
      '--d-bg': '#15171c',
      '--d-surface': '#1d2027',
      '--d-surface-2': '#252932',
      '--d-border': '#323744',
      '--d-fg': '#e9ecf2',
      '--d-muted': '#919aab',
      '--d-accent': '#6d5efc',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#9488ff',
      '--d-positive': '#41c08a',
      '--d-danger': '#e2685e',
      '--d-radius': '6px',
    },
    scenarios: [{ id: 'trace', label: 'Trace & package' }],
    load: () => import('@/components/demo/apps/vector-forge/App'),
  },
};

/** Whether a project slug has an interactive demo in this repository. */
export function hasDemo(slug: string): boolean {
  return Object.hasOwn(demoRegistry, slug);
}

/** A project's demo definition, or undefined. */
export function getDemo(slug: string): DemoDefinition | undefined {
  return Object.hasOwn(demoRegistry, slug) ? demoRegistry[slug] : undefined;
}

/** The path a project's demo lives at. One place builds it. */
export function demoPath(slug: string): string {
  return `/work/${slug}/demo`;
}

/**
 * The scenario to start from, given whatever the URL or the control offered.
 *
 * Falls back to the demo's first scenario rather than throwing: a stale link
 * carrying a scenario that has since been renamed should open the demo, not a
 * blank screen.
 */
export function resolveScenario(
  definition: DemoDefinition,
  requested?: string | null,
): string {
  const match = definition.scenarios.find((s) => s.id === requested);
  return (match ?? definition.scenarios[0]).id;
}
