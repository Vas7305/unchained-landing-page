'use client';

import { useState } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Construction } from 'lucide-react';

import type { DemoAppProps } from '@/lib/demo/types';

import { AppFrame } from './vendor/layout/AppFrame';
import { EmptyState } from './vendor/composites/EmptyState';
import { ConvertPanel } from './vendor/screens/ConvertPanel';
import { ConvertScreen } from './vendor/screens/ConvertScreen';
import { ToastContainer } from './vendor/primitives/Toast';
import { resetDemoStores } from './vendor/demo-reset';
import { useUiStore } from './vendor/stores/uiStore';
import surface from './vendor/styles/surface.module.css';

/**
 * The two faces the product's tokens name.
 *
 * `--font-ui` is Inter and `--font-mono` is JetBrains Mono in
 * `src/styles/tokens.css`; vendor/styles/surface.module.css points those
 * tokens at the variables declared here. Loading them through next/font means
 * they are self-hosted, preloaded with the demo chunk and subject to the same
 * `font-display: swap` as the rest of the site — and, because only this module
 * imports them, they are not paid for by a visitor who never opens a demo.
 */
const vfSans = Inter({
  variable: '--font-vf-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const vfMono = JetBrains_Mono({
  variable: '--font-vf-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

/**
 * The screens in the sidebar that this demo does not carry.
 *
 * VectorForge ships eight. Convert is the one the product is judged on and the
 * one vendored here in full; Enhance, Optimize, Web Assets, Batch and Export
 * each sit on their own stack of Tauri commands — an upscaler, an SVG
 * optimiser, a package builder — and standing in for them with drawings would
 * be exactly the thing this work exists to stop doing.
 *
 * So the navigation stays real and honest about it: the entries are there,
 * they respond, and they say what they are. The component saying so is the
 * product's own `EmptyState`.
 */
function NotInDemo({ title }: { title: string }) {
  return (
    <EmptyState
      icon={<Construction size={32} strokeWidth={1} />}
      title={`${title} is not part of this demo`}
      description="Convert is the screen running here, with the product's own interface and its real controls. The rest of the workstation is in the application itself."
    />
  );
}

const SCREEN_TITLES: Record<string, string> = {
  dashboard: 'The dashboard',
  enhance: 'Enhance',
  optimize: 'Optimize',
  web: 'Web Assets',
  batch: 'Batch Processing',
  export: 'Export',
  settings: 'Settings',
};

/**
 * VectorForge — the product's own workstation, running on demo fixtures.
 *
 * ─── What belongs to the product ──────────────────────────────────────────
 * Everything under `vendor/` that is not marked otherwise: the frame, the
 * sidebar, the top bar, the resizers, the whole primitive and composite
 * library, the Convert screen and its options panel, the design tokens, and
 * the Zustand stores that hold conversion state, history, toasts and the UI.
 * Those are the application's files, copied from its repository, with `@/`
 * import specifiers rewritten to relative paths and nothing else touched.
 *
 * ─── What belongs to the demo ─────────────────────────────────────────────
 * Four things, each one a place where the desktop application reaches outside
 * itself:
 *
 *   1. `vendor/services/*` — the Tauri IPC layer. VectorForge's tracer,
 *      optimiser, file dialogs and thumbnailer are Rust commands. The adapters
 *      keep every export's name and signature and answer from fixtures. The
 *      real work that remains is in lib/demo/apps/vector-forge/trace.ts.
 *   2. `vendor/stores/projectStore.ts` and `enhanceStore.ts` — the two stores
 *      that exist to manage things on disk.
 *   3. `vendor/styles/surface.module.css` — the product's tokens, scoped so
 *      they cannot reach the website around them.
 *   4. `vendor/demo-reset.ts` — because Zustand stores outlive a remount and
 *      the Reset control has to mean something.
 *
 * Divergences inside otherwise-untouched product files are marked in place
 * with a `DEMO DIVERGENCE` comment; there are five, all of them removals of a
 * call into the operating system.
 */
export default function VectorForgeDemo({ scenarioId }: DemoAppProps) {
  const screen = useUiStore((s) => s.screen);

  /**
   * Reset, before anything below renders.
   *
   * A `useState` initialiser runs during the first render of this component
   * and before its children's, which is what the stores need: an effect would
   * let the old assets paint for a frame first. The value is discarded — this
   * is a lifecycle hook being used for its timing, deliberately, and the
   * alternative (a module-level flag) would not re-run on a remount, which is
   * the entire point.
   */
  useState(() => {
    resetDemoStores();
    return null;
  });

  // The scenario the shell was opened with. There is one, and the workstation
  // opens on Convert with the sample project loaded; the parameter is read so
  // that adding a second scenario later is a change in one place.
  void scenarioId;

  return (
    <div className={`${surface.surface} ${vfSans.variable} ${vfMono.variable}`}>
      <AppFrame rightPanelContent={screen === 'convert' ? <ConvertPanel /> : undefined}>
        {screen === 'convert' ? (
          <ConvertScreen />
        ) : (
          <NotInDemo title={SCREEN_TITLES[screen] ?? screen} />
        )}
      </AppFrame>
      <ToastContainer />
    </div>
  );
}
