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
 * ─── The theme is not decoration, and it is not invented ──────────────────
 * §17: the visitor should feel they are using the product. A prospect looking
 * at these demos is being told "this is what we built for them" — so a demo in
 * a colour the product does not use is not a stylistic liberty, it is a false
 * statement about our own work.
 *
 * Every value below is therefore TAKEN FROM THE PRODUCT, not chosen. Six of
 * the eight are copied out of the product's own design-token file — the same
 * file its components consume — so the demo and the product cannot disagree:
 *
 *   tancerca         /d/Tancerca/src/index.css              (HSL, converted)
 *   lanna-kamilina   /d/Lanna-Kamilina/src/styles/index.css
 *   lazara-sersa     /d/Sersa Sarria/styles/tokens.css
 *   mensalere        /d/Mensalere/src/styles/index.css
 *   frito            /d/Frito/src/constants/tokens.ts
 *   vector-forge     /d/VectorForge-V-1.0/src/styles/tokens.css
 *
 * The two without a reachable source — `klassisches-ballet`, which was not
 * pursued, and `unchained-os`, which is not on this machine — are sampled from
 * the screenshots in public/work/ instead, decoded pixel by pixel: dominant
 * colours for grounds and surfaces, a chroma filter for the brand accents.
 * Those two are marked as sampled where they appear below.
 *
 * When a product is redesigned, re-copy its tokens. Never adjust by eye: the
 * first pass of this work did, and every palette it produced was wrong.
 *
 * Contrast note: every `--d-muted` was checked against both `--d-bg` and
 * `--d-surface`, and every `--d-accent-fg` against its accent.
 */
export const demoRegistry: Record<string, DemoDefinition> = {
  /* ── Marketplace and delivery, consumer side ───────────────────────────── */
  tancerca: {
    // Shown in a browser, because that is what the sampled screenshot is: the
    // marketplace as a visitor meets it, tropical sky band and all.
    frame: 'browser',
    lang: 'es',
    surfaceLabel: 'tancercadeti.com',
    theme: {
      // From the product's own tokens (/d/Tancerca/src/index.css), converted
      // from HSL: primary `161 85% 27%`, background `0 0% 99%`, foreground
      // `220 20% 10%`, muted-foreground `220 9% 44%`, border `220 13% 91%`,
      // secondary `161 20% 95%`, radius 0.6rem.
      '--d-bg': '#fcfcfc',
      '--d-surface': '#ffffff',
      '--d-surface-2': '#f0f5f3',
      '--d-border': '#e5e7eb',
      '--d-fg': '#141920',
      '--d-muted': '#666d7a',
      '--d-accent': '#0a7f5a',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#0a7f5a',
      '--d-positive': '#0a7f5a',
      '--d-danger': '#c2321f',
      '--d-radius': '10px',
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
    // No global serif: the site sets its display type in serif but keeps the
    // navigation and body in a letterspaced sans, so the switch is made per
    // element in the demo rather than across the whole surface.
    theme: {
      // From the product's own tokens (/d/Lanna-Kamilina/src/styles/index.css).
      // Its accent is a muted bronze, not the ink this demo first assumed —
      // "a punctuation mark, never a background wash", as that file puts it.
      '--d-bg': '#f5f2ec',
      '--d-surface': '#ffffff',
      '--d-surface-2': '#efeae1',
      '--d-border': '#ded6c9',
      '--d-fg': '#191512',
      '--d-muted': '#7b7268',
      '--d-accent': '#8e6a4c',
      '--d-accent-fg': '#f5f2ec',
      '--d-ring': '#6d4f37',
      '--d-positive': '#4b6b4f',
      '--d-danger': '#8a3f36',
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
    fontFamily: 'Georgia, "Times New Roman", serif',
    theme: {
      // From the product's own tokens (/d/Sersa Sarria/styles/tokens.css),
      // which are themselves sampled from the brand lockup: paper #e9d2cc is
      // the artwork's ground and rose-taupe #be968e is the LS monogram. Body
      // text uses the AA-safe siblings that file documents.
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
    // English, not German. The screenshot's own navigation reads CAST · THE
    // EXPERIENCE · PERFORMANCES · ABOUT and its call to action is "RESERVE
    // YOUR EVENING": the company is being introduced to a European audience in
    // English. The demo followed the project's German name into the wrong
    // language until the screenshot was read.
    lang: 'en',
    surfaceLabel: 'klassischesballett.com',
    fontFamily: 'Georgia, "Times New Roman", serif',
    theme: {
      // Sampled: near-black ground #030303, gold #c9a84d (the reserve button),
      // lighter gold #d6c06a (the italic display line), white #fffdfc.
      '--d-bg': '#030303',
      '--d-surface': '#0d0c0a',
      '--d-surface-2': '#16140f',
      '--d-border': '#2a2620',
      '--d-fg': '#fffdfc',
      '--d-muted': '#a79e8c',
      '--d-accent': '#c9a84d',
      '--d-accent-fg': '#14100a',
      '--d-ring': '#d6c06a',
      '--d-positive': '#8fb183',
      '--d-danger': '#d9736a',
      '--d-radius': '2px',
    },
    scenarios: [
      {
        id: 'presale',
        label: 'Pre-sale',
        hint: 'Every category is still available.',
      },
      {
        id: 'final',
        label: 'Final seats',
        hint: 'Two categories have already sold out.',
      },
    ],
    load: () => import('@/components/demo/apps/klassisches-ballet/App'),
  },

  /* ── Psychology consultations: directory and appointment booking ───────── */
  mensalere: {
    frame: 'browser',
    // English. The screenshot reads "Talking to someone can be the first step",
    // "Find the right psychology professional", How it works · Professionals ·
    // Login. Spanish was this demo's assumption, not the product's language.
    lang: 'en',
    surfaceLabel: 'mensalere.com',
    theme: {
      // From the product's own tokens (/d/Mensalere/src/styles/index.css).
      // Its brand colour is a muted sage, and that file documents the darker
      // siblings used wherever the colour carries text, with the measured
      // contrast ratios beside them.
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
      // From the product's own tokens (/d/Frito/src/constants/tokens.ts),
      // whose header reads "DO NOT modify values. These are the ONLY valid
      // design tokens." Fire #fc3803 is the accent, #22c55e is the like
      // button, and the app's borders are white at 8%.
      '--d-bg': '#080808',
      '--d-surface': '#121212',
      '--d-surface-2': '#181818',
      '--d-border': 'rgba(255,255,255,0.08)',
      '--d-fg': '#ffffff',
      '--d-muted': '#a1a1aa',
      '--d-accent': '#fc3803',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#ff663d',
      '--d-positive': '#22c55e',
      '--d-danger': '#fc3803',
      '--d-radius': '16px',
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
    surfaceLabel: 'Unchained — Deal Analyzer',
    theme: {
      // Sampled from the application itself, not a marketing page: ground
      // #09090b, panels and cards #18181c, the violet of the logo tile and the
      // active navigation item #915ec8, and the green #19c48b the dashboard
      // uses for returns. Blue was this demo's invention.
      '--d-bg': '#09090b',
      '--d-surface': '#18181c',
      '--d-surface-2': '#202027',
      '--d-border': '#2a2a31',
      '--d-fg': '#ededf0',
      '--d-muted': '#8e8e99',
      '--d-accent': '#915ec8',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#af83c4',
      '--d-positive': '#19c48b',
      '--d-danger': '#ef4444',
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
    surfaceLabel: 'VectorForge',
    theme: {
      // From the product's own tokens (/d/VectorForge-V-1.0/src/styles/
      // tokens.css). The workstation's chrome is #0a0e13, its panels #121821,
      // its raised surfaces #1b2430, and its accent ramp runs
      // #006d5b → #0a8f76 → #1fb896 → #5be0c0.
      '--d-bg': '#0b0f14',
      '--d-surface': '#121821',
      '--d-surface-2': '#1b2430',
      '--d-border': '#2b3440',
      '--d-fg': '#ecf1f6',
      '--d-muted': '#8a95a4',
      '--d-accent': '#0a8f76',
      '--d-accent-fg': '#ffffff',
      '--d-ring': '#5be0c0',
      '--d-positive': '#34c759',
      '--d-danger': '#fc3803',
      '--d-radius': '12px',
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
