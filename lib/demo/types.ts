/**
 * The demo system's vocabulary.
 *
 * ─── What this layer is ───────────────────────────────────────────────────
 * Every product in the portfolio can be accompanied by an *interactive demo*:
 * a working, frontend-only reconstruction of the product's most representative
 * workflow, running entirely on local state. The demo is not a screenshot and
 * it is not the product — it is a third thing, and this file describes it.
 *
 * ─── Nothing here names a product ─────────────────────────────────────────
 * Deliberately. The only module that knows which products exist is
 * lib/demo/registry.ts, which is a mapping and nothing else. Everything the
 * shell, the stage, the frames and the shared UI do is expressed in terms of
 * the types below, so adding a ninth demo means adding a registry entry and a
 * folder — never editing shared infrastructure.
 *
 * ─── The data path a demo is allowed to have ──────────────────────────────
 *
 *     UI (components/demo/apps/<slug>)
 *       ↓  dispatch
 *     State (lib/demo/apps/<slug>/state.ts — pure reducer)
 *       ↓  read / write
 *     Repository (same module — pure functions over fixtures)
 *       ↓
 *     Fixtures (lib/demo/apps/<slug>/data.ts — deterministic, fictional)
 *
 * There is no fifth arrow. A demo module importing `@/lib/portfolio`,
 * `@/lib/commercial/*`, `fetch`, or anything that reaches a network is a bug,
 * and lib/demo/isolation.test.ts fails the build over it.
 */

import type { ComponentType } from 'react';

/**
 * The device the product actually lives on.
 *
 * This is presentational, but it is not decoration: a consumer PWA shown in a
 * desktop window and a desktop tool shown in a phone both misrepresent the
 * product. The frame is the first thing the visitor reads about what they are
 * looking at.
 */
export type DemoFrame = 'browser' | 'phone' | 'desktop';

/**
 * A demo's own colour identity, as CSS custom properties.
 *
 * The site is one design language and the products are not; a marketplace, a
 * private-equity console and a dating app that all rendered in this site's
 * palette would demonstrate nothing. So each demo declares its own tokens and
 * the shared UI primitives are written against those names rather than against
 * Tailwind colours — which is what lets one <DemoButton> look correct inside
 * eight different products.
 *
 * The `--d-` prefix keeps them from colliding with the site's own `--color-*`
 * and shadcn tokens, which stay in force outside the demo surface.
 */
export interface DemoTheme {
  /** Page ground behind the product's own chrome. */
  '--d-bg': string;
  /** Cards, panels, bars — the raised surface. */
  '--d-surface': string;
  /** A second raised surface, for nesting inside the first. */
  '--d-surface-2': string;
  /** Hairlines and dividers. */
  '--d-border': string;
  /** Primary text. */
  '--d-fg': string;
  /** Secondary text. Must stay legible on `--d-bg` AND `--d-surface`. */
  '--d-muted': string;
  /** The product's brand colour: primary buttons, active states. */
  '--d-accent': string;
  /** Text on `--d-accent`. */
  '--d-accent-fg': string;
  /** Focus ring. Kept separate so it can be brightened for contrast. */
  '--d-ring': string;
  /** Success / positive state. */
  '--d-positive': string;
  /** Error / destructive state. */
  '--d-danger': string;
  /** Corner radius the product uses, as a CSS length. */
  '--d-radius': string;
}

/**
 * One curated starting position for a demo.
 *
 * A scenario is not a settings screen — it is a second story worth telling
 * about the same product ("a first-time buyer" vs "a customer with an order in
 * flight"). Demos that only have one story declare exactly one, and the shell
 * then renders no scenario control at all rather than a select with a single
 * option in it.
 */
export interface DemoScenario {
  id: string;
  /** Shown in the shell's control bar, in the product's own language. */
  label: string;
  /** One line on what this scenario sets up. Optional. */
  hint?: string;
}

/** The single prop every demo application receives. */
export interface DemoAppProps {
  /** Which of the demo's declared scenarios to start from. */
  scenarioId: string;
}

/**
 * Everything the site knows about one product's demo without loading it.
 *
 * The split matters for §11: the shell renders the frame, the address bar, the
 * theme and the scenario control from this object, which is a few hundred
 * bytes sitting in the registry, and only `load()` pulls the demo's own code.
 * Opening the portfolio therefore costs nothing; opening a demo costs one
 * chunk.
 */
export interface DemoDefinition {
  frame: DemoFrame;
  /**
   * BCP-47 tag for the product's own interface.
   *
   * Demos are presented in the language their product is actually built in —
   * a Cuban marketplace in Spanish, a Moscow salon in Russian — because that
   * is what the product is. The tag is set as `lang` on the demo surface so
   * screen readers switch voice at the boundary instead of reading Spanish
   * with an English synthesiser. The shell around it stays in the visitor's
   * chosen site language.
   */
  lang: string;
  /**
   * What the frame's address bar or title bar reads.
   *
   * A hostname for `browser`, an application title for `desktop` and `phone`.
   * Never a live link — the frame is a drawing, not a browser.
   */
  surfaceLabel: string;
  theme: DemoTheme;
  /** Optional font stack for the product's own identity. */
  fontFamily?: string;
  /** At least one. The first is the default. */
  scenarios: readonly DemoScenario[];
  /**
   * The demo's code, as a dynamic import.
   *
   * Called by <DemoStage> through React.lazy, so the chunk is fetched when the
   * demo route mounts and never before. Nothing outside that call site may
   * invoke it.
   */
  load: () => Promise<{ default: ComponentType<DemoAppProps> }>;
}
