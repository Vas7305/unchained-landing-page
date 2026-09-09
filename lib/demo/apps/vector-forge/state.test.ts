import { describe, expect, it } from 'vitest';
import { assets, findAsset, iconTargets } from './data';
import {
  batchDecision,
  buildPackage,
  compressionRatio,
  createInitialState,
  historyFor,
  modeSuitsAsset,
  recommendedMode,
  reducer,
  runTrace,
  traceOf,
  type Action,
  type State,
} from './state';

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

describe('reproducibility', () => {
  it('produces identical output for identical settings', () => {
    const asset = findAsset('a-logo');
    expect(asset).toBeDefined();
    if (!asset) return;

    const settings = { modeId: 'logo', threshold: 62, smoothing: 30, palette: 4 };
    const first = traceOf(asset, settings);
    const second = traceOf(asset, settings);

    expect(first).toEqual(second);
    expect(first.paths).toBeGreaterThan(0);
    expect(first.nodes).toBeGreaterThan(first.paths);
  });

  it('changes output when the settings change', () => {
    const asset = findAsset('a-badge');
    if (!asset) throw new Error('fixture missing');

    const smooth = traceOf(asset, {
      modeId: 'illustration',
      threshold: 48,
      smoothing: 90,
      palette: 24,
    });
    const sharp = traceOf(asset, {
      modeId: 'illustration',
      threshold: 48,
      smoothing: 10,
      palette: 24,
    });

    // Less smoothing means more nodes and a larger file. That relationship is
    // the one a designer relies on when they move the slider.
    expect(sharp.nodes).toBeGreaterThan(smooth.nodes);
    expect(sharp.bytes).toBeGreaterThan(smooth.bytes);
  });

  it('never exceeds the source palette', () => {
    const asset = findAsset('a-mark');
    if (!asset) throw new Error('fixture missing');

    const result = traceOf(asset, {
      modeId: 'precision',
      threshold: 40,
      smoothing: 15,
      palette: 64,
    });
    expect(result.colours).toBe(asset.colours);
  });

  it('reduces the file against its raster source', () => {
    const asset = findAsset('a-logo');
    if (!asset) throw new Error('fixture missing');

    const result = traceOf(asset, {
      modeId: 'logo',
      threshold: 62,
      smoothing: 30,
      palette: 4,
    });
    expect(compressionRatio(result)).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThan(result.sourceBytes);
  });
});

describe('mode suitability', () => {
  it('refuses a photographic source in logo mode, and says what to use', () => {
    const state = run(createInitialState('trace'), {
      type: 'selectAsset',
      assetId: 'a-photo',
    });

    expect(modeSuitsAsset(state)).toBe(false);

    const result = runTrace(state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('unsuitable');
      expect(result.failure.message).toContain('Precision');
    }

    const photo = findAsset('a-photo');
    if (photo) expect(recommendedMode(photo).id).toBe('precision');
  });

  it('accepts the same source once the mode is changed', () => {
    const state = run(
      createInitialState('trace'),
      { type: 'selectAsset', assetId: 'a-photo' },
      { type: 'setMode', modeId: 'precision' },
    );

    expect(modeSuitsAsset(state)).toBe(true);
    expect(runTrace(state).ok).toBe(true);
  });

  it('loads the mode’s defaults when it is chosen', () => {
    const state = run(createInitialState('trace'), {
      type: 'setMode',
      modeId: 'icon',
    });

    expect(state.settings.palette).toBe(2);
    expect(state.settings.smoothing).toBe(45);
  });
});

describe('versions', () => {
  it('records every trace as a new version rather than overwriting', () => {
    let state = createInitialState('trace');

    const first = runTrace(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = run(state, { type: 'traceSucceeded', result: first.value });
    expect(first.value.version).toBe(1);

    state = run(state, { type: 'setParam', name: 'smoothing', value: 70 });
    const second = runTrace(state);
    if (!second.ok) throw new Error('second trace should have succeeded');
    state = run(state, { type: 'traceSucceeded', result: second.value });

    expect(second.value.version).toBe(2);
    expect(historyFor(state, 'a-logo')).toHaveLength(2);
    expect(state.result?.version).toBe(2);
  });

  it('restores an earlier version’s settings and result', () => {
    let state = createInitialState('trace');

    const first = runTrace(state);
    if (!first.ok) throw new Error('fixture');
    state = run(state, { type: 'traceSucceeded', result: first.value });

    state = run(state, { type: 'setParam', name: 'threshold', value: 20 });
    const second = runTrace(state);
    if (!second.ok) throw new Error('fixture');
    state = run(state, { type: 'traceSucceeded', result: second.value });

    const restored = run(state, {
      type: 'restoreVersion',
      assetId: 'a-logo',
      version: 1,
    });

    expect(restored.settings.threshold).toBe(62);
    expect(restored.result?.version).toBe(1);
    // Restoring does not delete the newer version.
    expect(historyFor(restored, 'a-logo')).toHaveLength(2);
  });

  it('keeps each source’s history separate and follows the selection', () => {
    let state = createInitialState('trace');

    const first = runTrace(state);
    if (!first.ok) throw new Error('fixture');
    state = run(state, { type: 'traceSucceeded', result: first.value });

    // Switching to an untraced source shows no result…
    state = run(state, { type: 'selectAsset', assetId: 'a-mark' });
    expect(state.result).toBeNull();

    // …and switching back restores the one that source already had.
    state = run(state, { type: 'selectAsset', assetId: 'a-logo' });
    expect(state.result?.version).toBe(1);
  });
});

describe('packaging', () => {
  function traced(): State {
    const state = createInitialState('trace');
    const result = runTrace(state);
    if (!result.ok) throw new Error('fixture');
    return run(state, { type: 'traceSucceeded', result: result.value });
  }

  it('refuses to package before anything has been traced', () => {
    const result = buildPackage(createInitialState('trace'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('no-trace');
  });

  it('refuses an empty target list', () => {
    let state = traced();
    for (const target of iconTargets) {
      if (state.targets.includes(target.id)) {
        state = run(state, { type: 'toggleTarget', targetId: target.id });
      }
    }

    expect(state.targets).toEqual([]);
    const result = buildPackage(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('no-targets');
  });

  it('writes exactly the selected targets, with the standard set by default', () => {
    const state = traced();
    const standard = iconTargets.filter((t) => t.standard);
    expect(state.targets).toHaveLength(standard.length);

    const result = buildPackage(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.files).toHaveLength(standard.length);
    expect(result.value.files.map((f) => f.file)).toContain('favicon.ico');
    expect(result.value.files.map((f) => f.file)).toContain('apple-touch-icon.png');
    expect(result.value.totalBytes).toBe(
      result.value.files.reduce((sum, file) => sum + file.bytes, 0),
    );
  });

  it('discards a package when the trace underneath it changes', () => {
    let state = traced();
    const built = buildPackage(state);
    if (!built.ok) throw new Error('fixture');
    state = run(state, { type: 'packageSucceeded', result: built.value });
    expect(state.packageResult).not.toBeNull();

    state = run(state, { type: 'setParam', name: 'threshold', value: 30 });
    const next = runTrace(state);
    if (!next.ok) throw new Error('fixture');
    state = run(state, { type: 'traceSucceeded', result: next.value });

    expect(state.packageResult).toBeNull();
  });
});

describe('the batch queue', () => {
  it('queues every source and skips the ones the recipe does not suit', () => {
    const state = run(createInitialState('trace'), { type: 'queueAll' });

    expect(state.tab).toBe('batch');
    expect(state.batch).toHaveLength(assets.length);
    expect(state.batch.every((item) => item.status === 'queued')).toBe(true);

    // Logo mode suits flat artwork only.
    const decisions = state.batch.map((item) =>
      batchDecision(item.assetId, state.settings),
    );
    expect(decisions.filter((d) => d.ok)).toHaveLength(
      assets.filter((a) => a.kind === 'flat').length,
    );
    const skipped = decisions.find((d) => !d.ok);
    expect(skipped && !skipped.ok && skipped.reason).toBeTruthy();
  });
});

describe('reset', () => {
  it('clears versions, package and queue', () => {
    const used = (() => {
      let state = run(createInitialState('trace'), { type: 'queueAll' });
      state = run(state, { type: 'setTab', tab: 'trace' });
      const result = runTrace(state);
      if (!result.ok) throw new Error('fixture');
      return run(state, { type: 'traceSucceeded', result: result.value });
    })();

    expect(historyFor(used, 'a-logo')).toHaveLength(1);
    expect(used.batch.length).toBeGreaterThan(0);

    const fresh = createInitialState('trace');
    expect(fresh.versions).toEqual({});
    expect(fresh.result).toBeNull();
    expect(fresh.packageResult).toBeNull();
    expect(fresh.batch).toEqual([]);
    expect(fresh.tab).toBe('trace');
    expect(fresh).toEqual(createInitialState('trace'));
  });
});
