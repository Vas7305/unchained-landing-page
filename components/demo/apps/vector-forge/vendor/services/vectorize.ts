/**
 * The vectorizer, adapted for the demo.
 *
 * ─── The shape that is kept ───────────────────────────────────────────────
 * `convertStore.startVectorization` is the product's, unmodified. It builds an
 * `AbortController`, dynamically imports this module, calls `vectorize` with a
 * progress callback and the signal, and writes the result into the store. All
 * of that keeps working because this module keeps the contract:
 *
 *   - progress arrives in stages, by the product's own stage names, which is
 *     what `formatStage` in ConvertScreen prints under the bar;
 *   - the promise rejects with an `AbortError` when the signal fires, which is
 *     what makes the Cancel button real;
 *   - the result is a `VectorizationResult`, so the preview, the node overlay
 *     and the metadata panel all read it the way they always did.
 *
 * ─── What is gone ─────────────────────────────────────────────────────────
 * The `invoke` into the Rust core, the 250ms IPC progress poll, the SVG cache
 * written to disk, and the `project.json` registration that followed it. The
 * work itself is `traceSource` — pure, synchronous and deterministic. See
 * lib/demo/apps/vector-forge/trace.ts for what it actually computes.
 */

import { demoSources } from '@/lib/demo/apps/vector-forge/data';
import { traceSource, type TraceMode } from '@/lib/demo/apps/vector-forge/trace';

import type { ImageFile, VectorizationOptions, VectorizationResult } from '../types';

export { computeSvgComplexity } from '@/lib/demo/apps/vector-forge/trace';

/**
 * The stages the product reports, and how far through each one leaves the bar.
 *
 * Taken from `STAGE_LABELS` in ConvertScreen — these are the strings the
 * screen already knows how to render, so the progress text below the bar is
 * the product's, not the demo's.
 */
const STAGES: readonly (readonly [stage: string, pct: number])[] = [
  ['loading', 12],
  ['resizing', 28],
  ['configuring', 41],
  ['tracing', 86],
  ['finalizing', 97],
];

/** Total wall time of a trace. Long enough to read, short enough to sit through. */
const TRACE_MS = 2200;

function aborted(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export async function vectorize(
  file: ImageFile,
  opts: VectorizationOptions,
  projectDir: string,
  onProgress?: (pct: number, stage: string) => void,
  signal?: AbortSignal,
): Promise<VectorizationResult> {
  void projectDir;

  if (signal?.aborted) throw aborted();

  const source = demoSources.find((candidate) => candidate.path === file.path);

  // The product throws when the core refuses the file, and the store turns
  // that into the red message under the sliders. Reachable, not decorative.
  if (!source) {
    throw new Error(`No tracer input for ${file.name}`);
  }

  // Computed before the progress runs: the settings that matter are the ones
  // the visitor was looking at when they pressed the button, not the ones they
  // nudged while it worked.
  const traced = traceSource(source, {
    mode: opts.mode as TraceMode,
    detail: opts.detail,
    colors: opts.colors,
    smoothing: opts.smoothing,
    simplify: true,
  });

  const perStage = Math.round(TRACE_MS / STAGES.length);

  for (const [stage, pct] of STAGES) {
    await wait(perStage, signal);
    onProgress?.(pct, stage);
  }

  return {
    svg: traced.svg,
    nodeCount: traced.nodeCount,
    pathCount: traced.pathCount,
    points: traced.points,
    // Fixed rather than `Date.now()`: the metadata panel prints it, and the
    // same recipe producing the same file is the product's whole argument.
    generatedAt: Date.UTC(2026, 1, 3, 16, 12),
    sourcePath: file.path,
    cachePath: '',
  };
}

/**
 * Sleep, unless the trace is cancelled first.
 *
 * The listener is removed on both exits — a cancelled trace that leaves a
 * listener on a long-lived `AbortSignal` is the kind of leak that only shows up
 * after the twentieth cancel.
 */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(aborted());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(aborted());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
