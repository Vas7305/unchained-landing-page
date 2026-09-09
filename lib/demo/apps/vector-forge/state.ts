import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  assets,
  findAsset,
  findMode,
  iconTargets,
  modes,
  type DemoAsset,
  type DemoMode,
} from './data';

/**
 * VectorForge — trace, package, export.
 *
 * ─── The property this demo exists to prove ───────────────────────────────
 * Reproducibility. The product replaced a chain of free web converters whose
 * output "differed depending on who prepared it and on what day", so a demo
 * whose trace results were random would be arguing against the thing it is
 * demonstrating. `traceOf` is therefore a pure function of the source and the
 * settings: the same recipe produces byte-for-byte the same summary, every
 * time, and the version history is a record of recipes rather than of files.
 *
 * ─── And the constraint that makes it a tool ──────────────────────────────
 * Not every mode suits every source. Tracing a photograph in Logo mode is a
 * mistake the old chain of converters would happily make and quietly produce
 * mush from; here it is refused, with the reason and the mode that would work.
 * That refusal is the demo's deterministic error path (§20).
 */

export type Tab = 'trace' | 'package' | 'batch';

export interface TraceSettings {
  modeId: string;
  threshold: number;
  smoothing: number;
  palette: number;
}

export interface TraceResult {
  /** Version number within this asset's history, starting at 1. */
  version: number;
  assetId: string;
  settings: TraceSettings;
  paths: number;
  nodes: number;
  colours: number;
  /** Output size in bytes. */
  bytes: number;
  sourceBytes: number;
}

export interface PackageResult {
  files: { file: string; size: number; bytes: number }[];
  totalBytes: number;
}

export interface BatchItem {
  assetId: string;
  status: 'queued' | 'running' | 'done' | 'skipped';
  /** Why a queued item was skipped, when it was. */
  reason?: string;
}

export interface State {
  scenarioId: string;
  tab: Tab;
  assetId: string;
  settings: TraceSettings;
  tracing: boolean;
  /** Index into TRACE_STEPS while running, -1 when idle. */
  traceStep: number;
  result: TraceResult | null;
  /** Asset id → every trace produced for it, newest last. */
  versions: Record<string, TraceResult[]>;
  failure: string | null;
  /** Icon targets ticked for the package. */
  targets: string[];
  packaging: boolean;
  packageStep: number;
  packageResult: PackageResult | null;
  batch: BatchItem[];
  batchRunning: boolean;
  notice: string | null;
}

const firstAsset = assets[0];

/**
 * The icon targets ticked by default — the set nobody should have to think
 * about. Computed once here rather than re-derived at every reset and every
 * "standard set" click, and copied on use so no caller can mutate the source.
 */
const STANDARD_TARGET_IDS = iconTargets.flatMap((target) =>
  target.standard ? [target.id] : [],
);

function settingsFor(modeId: string): TraceSettings {
  const mode = findMode(modeId) ?? modes[0];
  return {
    modeId: mode.id,
    threshold: mode.threshold,
    smoothing: mode.smoothing,
    palette: mode.palette,
  };
}

export function createInitialState(scenarioId: string): State {
  return {
    scenarioId,
    tab: 'trace',
    assetId: firstAsset.id,
    settings: settingsFor('logo'),
    tracing: false,
    traceStep: -1,
    result: null,
    versions: {},
    failure: null,
    targets: [...STANDARD_TARGET_IDS],
    packaging: false,
    packageStep: -1,
    packageResult: null,
    batch: [],
    batchRunning: false,
    notice: null,
  };
}

export type Action =
  | { type: 'setTab'; tab: Tab }
  | { type: 'selectAsset'; assetId: string }
  | { type: 'setMode'; modeId: string }
  | { type: 'setParam'; name: 'threshold' | 'smoothing' | 'palette'; value: number }
  | { type: 'traceStart' }
  | { type: 'traceStep'; step: number }
  | { type: 'traceFailed'; message: string }
  | { type: 'traceSucceeded'; result: TraceResult }
  | { type: 'restoreVersion'; assetId: string; version: number }
  | { type: 'toggleTarget'; targetId: string }
  | { type: 'selectStandardTargets' }
  | { type: 'packageStart' }
  | { type: 'packageStep'; step: number }
  | { type: 'packageFailed'; message: string }
  | { type: 'packageSucceeded'; result: PackageResult }
  | { type: 'queueAll' }
  | { type: 'batchStart' }
  | { type: 'batchItem'; assetId: string; status: BatchItem['status']; reason?: string }
  | { type: 'batchDone' }
  | { type: 'dismissNotice' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab, failure: null };

    case 'selectAsset':
      return {
        ...state,
        assetId: action.assetId,
        // The result belonged to the previous source; the history keeps it.
        result: latestVersion(state, action.assetId) ?? null,
        failure: null,
        packageResult: null,
      };

    case 'setMode':
      return {
        ...state,
        settings: settingsFor(action.modeId),
        failure: null,
      };

    case 'setParam':
      return {
        ...state,
        settings: { ...state.settings, [action.name]: action.value },
        failure: null,
      };

    case 'traceStart':
      return { ...state, tracing: true, traceStep: 0, failure: null };

    case 'traceStep':
      return { ...state, traceStep: action.step };

    case 'traceFailed':
      return { ...state, tracing: false, traceStep: -1, failure: action.message };

    case 'traceSucceeded': {
      const history = state.versions[action.result.assetId] ?? [];
      return {
        ...state,
        tracing: false,
        traceStep: -1,
        result: action.result,
        versions: {
          ...state.versions,
          [action.result.assetId]: [...history, action.result],
        },
        // A new trace invalidates a package built from the previous one.
        packageResult: null,
        notice: `Traced to v${action.result.version}.`,
      };
    }

    case 'restoreVersion': {
      const history = state.versions[action.assetId] ?? [];
      const restored = history.find((item) => item.version === action.version);
      if (!restored) return state;

      return {
        ...state,
        assetId: action.assetId,
        settings: { ...restored.settings },
        result: restored,
        packageResult: null,
        notice: `Restored v${restored.version}.`,
      };
    }

    case 'toggleTarget':
      return {
        ...state,
        targets: state.targets.includes(action.targetId)
          ? state.targets.filter((id) => id !== action.targetId)
          : [...state.targets, action.targetId],
        packageResult: null,
        failure: null,
      };

    case 'selectStandardTargets':
      return {
        ...state,
        targets: [...STANDARD_TARGET_IDS],
        packageResult: null,
      };

    case 'packageStart':
      return { ...state, packaging: true, packageStep: 0, failure: null };

    case 'packageStep':
      return { ...state, packageStep: action.step };

    case 'packageFailed':
      return {
        ...state,
        packaging: false,
        packageStep: -1,
        failure: action.message,
      };

    case 'packageSucceeded':
      return {
        ...state,
        packaging: false,
        packageStep: -1,
        packageResult: action.result,
        notice: `Package written: ${action.result.files.length} files.`,
      };

    case 'queueAll':
      return {
        ...state,
        tab: 'batch',
        batch: assets.map((asset) => ({
          assetId: asset.id,
          status: 'queued' as const,
        })),
      };

    case 'batchStart':
      return { ...state, batchRunning: true };

    case 'batchItem':
      return {
        ...state,
        batch: state.batch.map((item) =>
          item.assetId === action.assetId
            ? { ...item, status: action.status, reason: action.reason }
            : item,
        ),
      };

    case 'batchDone':
      return { ...state, batchRunning: false, notice: 'Batch finished.' };

    case 'dismissNotice':
      return { ...state, notice: null };

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function currentAsset(state: State): DemoAsset | undefined {
  return findAsset(state.assetId);
}

export function currentMode(state: State): DemoMode | undefined {
  return findMode(state.settings.modeId);
}

export function historyFor(state: State, assetId: string): TraceResult[] {
  return state.versions[assetId] ?? [];
}

function latestVersion(state: State, assetId: string): TraceResult | undefined {
  const history = historyFor(state, assetId);
  return history[history.length - 1];
}

/** Whether the chosen mode is designed for the chosen source. */
export function modeSuitsAsset(state: State): boolean {
  const asset = currentAsset(state);
  const mode = currentMode(state);
  if (!asset || !mode) return false;
  return mode.suits.includes(asset.kind);
}

/** The mode that would work for this source, for the error message to name. */
export function recommendedMode(asset: DemoAsset): DemoMode {
  return modes.find((mode) => mode.suits.includes(asset.kind)) ?? modes[modes.length - 1];
}

export function selectedTargets() {
  return iconTargets;
}

export function compressionRatio(result: TraceResult): number {
  return 1 - result.bytes / result.sourceBytes;
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

/**
 * What tracing this source with these settings produces.
 *
 * Pure and total: no randomness, no clock, no I/O. Two visitors who pick the
 * same source and the same mode see the same path count and the same output
 * size, which is exactly the guarantee the real product sells.
 */
export function traceOf(asset: DemoAsset, settings: TraceSettings): TraceResult {
  // Detail scales with the source's own complexity, the palette allowed, and
  // how little smoothing is applied.
  const complexity =
    Math.log2(asset.colours + 2) * (asset.width * asset.height) ** 0.32;
  const smoothingFactor = 1 - settings.smoothing / 160;
  const thresholdFactor = 0.6 + (100 - settings.threshold) / 120;

  const paths = Math.max(
    1,
    Math.round((complexity * smoothingFactor * thresholdFactor) / 6),
  );
  const nodes = Math.round(paths * (5 + (100 - settings.smoothing) / 12));
  const colours = Math.min(asset.colours, settings.palette);

  // Output grows with nodes; the constants are chosen so a flat logo lands in
  // single-figure kilobytes and a precision trace of a photograph does not.
  const outputBytes = Math.round(240 + nodes * 27 + colours * 60);

  return {
    version: 1,
    assetId: asset.id,
    settings: { ...settings },
    paths,
    nodes,
    colours,
    bytes: outputBytes,
    sourceBytes: asset.bytes,
  };
}

export function runTrace(state: State): DemoResult<TraceResult> {
  const asset = currentAsset(state);
  const mode = currentMode(state);

  if (!asset || !mode) {
    return fail('missing', 'Select a source file first.');
  }

  if (!mode.suits.includes(asset.kind)) {
    const better = recommendedMode(asset);
    return fail(
      'unsuitable',
      `${mode.name} mode expects flat artwork. ${asset.name} is ${asset.kind === 'photographic' ? 'photographic' : 'detailed'} — trace it in ${better.name} mode instead.`,
    );
  }

  const traced = traceOf(asset, state.settings);
  const version = historyFor(state, asset.id).length + 1;

  return ok({ ...traced, version });
}

/**
 * Build the icon package from the current trace.
 *
 * Refuses without a trace to build from, and without at least one target —
 * the two states in which the real product would write an empty ZIP.
 */
export function buildPackage(state: State): DemoResult<PackageResult> {
  if (!state.result) {
    return fail('no-trace', 'Trace the source before generating a package.');
  }

  if (state.targets.length === 0) {
    return fail('no-targets', 'Select at least one icon target.');
  }

  const wanted = new Set(state.targets);
  const chosen = iconTargets.filter((target) => wanted.has(target.id));

  const files = chosen.map((target) => ({
    file: target.file,
    size: target.size,
    // The SVG is the traced output itself; raster targets scale with area.
    bytes:
      target.size === 0
        ? target.file.endsWith('.svg')
          ? state.result?.bytes ?? 0
          : 15_086
        : Math.round(180 + target.size * target.size * 0.42),
  }));

  return ok({
    files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  });
}

/** Whether a queued asset can be traced with the current recipe. */
export function batchDecision(
  assetId: string,
  settings: TraceSettings,
): { ok: true } | { ok: false; reason: string } {
  const asset = findAsset(assetId);
  const mode = findMode(settings.modeId);
  if (!asset || !mode) return { ok: false, reason: 'Unknown source' };

  return mode.suits.includes(asset.kind)
    ? { ok: true }
    : { ok: false, reason: `${mode.name} mode does not suit ${asset.kind} artwork` };
}
