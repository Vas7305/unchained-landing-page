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
 * another demo is an entry here plus two folders, and touches nothing else.
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
 * presentation about it. Five products rendered in this website's palette
 * would all look like this website. Each entry therefore carries the product's
 * own colours, radius and type, which the shared primitives resolve through
 * CSS custom properties — one DemoButton that is correct in a Caribbean
 * marketplace and in a Moscow salon.
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
    fontFamily: "'Playfair Display', 'Times New Roman', Georgia, serif",
    // Copied from the @theme block in src/styles/index.css in the Lanna
    // Kamilina repository. The demo surface carries the product's full token
    // set itself, namespaced `lk-` in app/globals.css; these twelve are what
    // the site's own chrome around the demo uses so the frame stops looking
    // like it belongs to a different application.
    theme: {
      '--d-bg': '#f5f2ec',
      '--d-surface': '#efeae1',
      '--d-surface-2': '#e7e0d4',
      '--d-border': '#ded6c9',
      '--d-fg': '#191512',
      '--d-muted': '#7b7268',
      '--d-accent': '#8e6a4c',
      '--d-accent-fg': '#f5f2ec',
      '--d-ring': '#6d4f37',
      '--d-positive': '#4b6b4f',
      '--d-danger': '#8a3f36',
      '--d-radius': '3px',
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

  /* ── Point of sale: till, day's sales, cash closing ────────────────────── */
  'merxis-pos': {
    frame: 'desktop',
    lang: 'es',
    surfaceLabel: 'Merxis POS · Punto de venta para tu negocio',
    // The product's "Escritorio moderno" look in dark mode, from
    // src/appearance.css in the Merxis repository — the look of the
    // screenshot on its portfolio card.
    fontFamily:
      '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
    theme: {
      '--d-bg': '#16181c',
      '--d-surface': '#1f2228',
      '--d-surface-2': '#2a2e35',
      '--d-border': '#30353d',
      '--d-fg': '#e8eaed',
      '--d-muted': '#9aa3ae',
      '--d-accent': '#6c9bff',
      '--d-accent-fg': '#0b1220',
      '--d-ring': '#6c9bff',
      '--d-positive': '#5fd38d',
      '--d-danger': '#f97066',
      '--d-radius': '12px',
    },
    scenarios: [
      {
        id: 'turno',
        label: 'Caja abierta',
        hint: 'Media mañana: tres ventas y el ticket vacío.',
      },
      {
        id: 'cierre',
        label: 'Fin del día',
        hint: 'Siete ventas cobradas; empieza en el cierre de caja.',
      },
    ],
    load: () => import('@/components/demo/apps/merxis-pos/App'),
  },

  /* ── Day counter: milestones every ten days, daily checks and alarms ───── */
  kairos: {
    frame: 'desktop',
    lang: 'es',
    surfaceLabel: 'Kairós — Días & Hitos',
    // The product's obsidian dark theme, from frontend/src/index.css in the
    // Kairós repository — the look of the screenshot on its portfolio card.
    // Inside the window the demo sets these again for its light theme, and
    // its own three faces through next/font; this stack is what the frame's
    // title bar reads in.
    fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    theme: {
      '--d-bg': '#0B0C10',
      '--d-surface': '#14161F',
      '--d-surface-2': '#1C1F2B',
      '--d-border': '#262A36',
      '--d-fg': '#F3F4F6',
      '--d-muted': '#9CA3AF',
      '--d-accent': '#F59E0B',
      '--d-accent-fg': '#0B0C10',
      '--d-ring': '#FBBF24',
      '--d-positive': '#10B981',
      '--d-danger': '#EF4444',
      '--d-radius': '10px',
    },
    scenarios: [
      {
        id: 'medianoche',
        label: 'Cruce de hito en vivo',
        hint: 'Son las 23:59:20: a medianoche «Sin fumar» cumple 30 días. Abre el modo proyector para verlo en grande.',
      },
      {
        id: 'alarma',
        label: 'Alarma de la mañana',
        hint: 'Son las 6:59:40 y «Correr cada mañana» tiene su alarma diaria a las 7:00.',
      },
    ],
    load: () => import('@/components/demo/apps/kairos/App'),
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
