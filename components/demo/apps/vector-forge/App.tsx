'use client';

import { useEffect, useReducer } from 'react';
import {
  Check,
  FileImage,
  History,
  Layers,
  Package,
  Play,
  Sparkles,
} from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import DemoTabs, { DemoTabPanel } from '@/components/demo/ui/DemoTabs';
import { DemoArtwork } from '@/components/demo/ui/DemoArtwork';
import { simulateEach, simulateSteps } from '@/lib/demo/service';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  EXPORT_STEPS,
  TRACE_STEPS,
  assets,
  bytes,
  findAsset,
  iconTargets,
  modes,
} from '@/lib/demo/apps/vector-forge/data';
import {
  batchDecision,
  buildPackage,
  compressionRatio,
  createInitialState,
  currentAsset,
  currentMode,
  historyFor,
  modeSuitsAsset,
  reducer,
  runTrace,
  type State,
} from '@/lib/demo/apps/vector-forge/state';

/**
 * VectorForge — the workstation.
 *
 * Three panes: the project's sources on the left, the recipe and its result in
 * the middle, the version history under it. The product's argument is that the
 * same recipe always produces the same file, so the demo shows the recipe and
 * the numbers it produces side by side, and keeps every previous version
 * rather than overwriting one.
 */

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className='block'>
      <span className='flex justify-between text-[11px] mb-1'>
        <span className='text-[var(--d-muted)]'>{label}</span>
        <span className='font-bold tabular-nums'>
          {value}
          {suffix}
        </span>
      </span>
      <input
        type='range'
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className='w-full accent-[var(--d-accent)]'
      />
    </label>
  );
}

export default function VectorForgeDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  const asset = currentAsset(state);
  const mode = currentMode(state);
  const history = historyFor(state, state.assetId);
  const selectedTargetIds = new Set(state.targets);

  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => dispatch({ type: 'dismissNotice' }), 2600);
    return () => clearTimeout(timer);
  }, [state.notice]);

  async function trace() {
    // Decided before the progress runs, so the refusal is immediate rather
    // than arriving after a fake six-second pipeline.
    const decision = runTrace(state);

    if (!decision.ok) {
      dispatch({ type: 'traceFailed', message: decision.failure.message });
      return;
    }

    dispatch({ type: 'traceStart' });
    await simulateSteps(TRACE_STEPS, (_, index) =>
      dispatch({ type: 'traceStep', step: index }),
    );
    dispatch({ type: 'traceSucceeded', result: decision.value });
    track('demo_completed', { project: 'vector-forge', workflow: 'trace' });
  }

  async function makePackage() {
    const decision = buildPackage(state);

    if (!decision.ok) {
      dispatch({ type: 'packageFailed', message: decision.failure.message });
      return;
    }

    dispatch({ type: 'packageStart' });
    await simulateSteps(EXPORT_STEPS, (_, index) =>
      dispatch({ type: 'packageStep', step: index }),
    );
    dispatch({ type: 'packageSucceeded', result: decision.value });
  }

  async function runBatch() {
    dispatch({ type: 'batchStart' });

    // Sequential on purpose; the pacing belongs to the simulation layer, so
    // the view only says what "start" and "finish" mean for one item.
    await simulateEach(state.batch, (item) => {
      dispatch({ type: 'batchItem', assetId: item.assetId, status: 'running' });
      const decision = batchDecision(item.assetId, state.settings);

      return () =>
        dispatch({
          type: 'batchItem',
          assetId: item.assetId,
          status: decision.ok ? 'done' : 'skipped',
          reason: decision.ok ? undefined : decision.reason,
        });
    });

    dispatch({ type: 'batchDone' });
  }

  return (
    <div className='h-full flex text-[13px]'>
      {/* ── Sources ─────────────────────────────────────────────────────── */}
      <aside
        className='w-44 shrink-0 border-r border-[var(--d-border)] overflow-y-auto hidden sm:block'
        aria-label='Project sources'
      >
        <p className='px-3 pt-3 pb-2 text-[10px] uppercase tracking-widest text-[var(--d-muted)]'>
          Sources
        </p>
        <ul>
          {assets.map((item) => {
            const on = item.id === state.assetId;
            const traced = historyFor(state, item.id).length;

            return (
              <li key={item.id}>
                <button
                  type='button'
                  onClick={() =>
                    dispatch({ type: 'selectAsset', assetId: item.id })
                  }
                  aria-current={on ? 'true' : undefined}
                  className={
                    'w-full text-left px-3 py-2 flex items-center gap-2 border-l-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--d-ring)] ' +
                    (on
                      ? 'border-[var(--d-accent)] bg-[var(--d-surface)]'
                      : 'border-transparent hover:bg-[var(--d-surface)]')
                  }
                >
                  <FileImage
                    size={13}
                    aria-hidden='true'
                    className='shrink-0 text-[var(--d-muted)]'
                  />
                  <span className='min-w-0'>
                    <span className='block text-[11px] truncate'>{item.name}</span>
                    <span className='block text-[10px] text-[var(--d-muted)]'>
                      {item.width}×{item.height}
                      {traced > 0 && ` · v${traced}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className='p-3'>
          <DemoButton
            size='sm'
            variant='secondary'
            block
            icon={<Layers size={12} aria-hidden='true' />}
            onClick={() => dispatch({ type: 'queueAll' })}
          >
            Queue all
          </DemoButton>
        </div>
      </aside>

      {/* ── Workspace ───────────────────────────────────────────────────── */}
      <div className='flex-1 min-w-0 flex flex-col'>
        <div className='shrink-0 px-4 pt-3 border-b border-[var(--d-border)]'>
          <DemoTabs
            label='Workspace'
            active={state.tab}
            onChange={(tab) =>
              dispatch({ type: 'setTab', tab: tab as State['tab'] })
            }
            tabs={[
              { id: 'trace', label: 'Trace', icon: <Sparkles size={13} aria-hidden='true' /> },
              { id: 'package', label: 'Package', icon: <Package size={13} aria-hidden='true' /> },
              {
                id: 'batch',
                label: 'Batch',
                icon: <Layers size={13} aria-hidden='true' />,
                badge: state.batch.length || undefined,
              },
            ]}
          />
        </div>

        <div className='flex-1 min-h-0 overflow-y-auto p-4'>
          {/* ── Trace ───────────────────────────────────────────────────── */}
          <DemoTabPanel id='trace' active={state.tab}>
            {asset && (
              <div className='grid grid-cols-1 lg:grid-cols-[1fr_15rem] gap-4'>
                <div>
                  {/* Before / after */}
                  <div className='grid grid-cols-2 gap-3'>
                    <figure>
                      <figcaption className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-1.5'>
                        Source · {bytes(asset.bytes)}
                      </figcaption>
                      <div
                        className='aspect-square overflow-hidden border border-[var(--d-border)]'
                        style={{ borderRadius: 'var(--d-radius)' }}
                      >
                        <DemoArtwork seed={asset.id} />
                      </div>
                    </figure>

                    <figure>
                      <figcaption className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-1.5'>
                        {state.result
                          ? `Vector · ${bytes(state.result.bytes)}`
                          : 'Vector · not traced'}
                      </figcaption>
                      <div
                        className='aspect-square overflow-hidden border border-[var(--d-border)] relative bg-[var(--d-surface)]'
                        style={{ borderRadius: 'var(--d-radius)' }}
                      >
                        {state.result ? (
                          <>
                            <DemoArtwork seed={`${asset.id}-vector`} />
                            {/* A hint of the wireframe the tracer produced. */}
                            <svg
                              className='absolute inset-0 w-full h-full'
                              viewBox='0 0 100 100'
                              aria-hidden='true'
                            >
                              <g
                                fill='none'
                                stroke='var(--d-accent)'
                                strokeOpacity='0.65'
                                strokeWidth='0.6'
                              >
                                <path d='M18 78 Q 32 22, 50 46 T 84 26' />
                                <path d='M12 58 Q 44 66, 88 52' />
                                <circle cx='50' cy='50' r='30' />
                              </g>
                            </svg>
                          </>
                        ) : (
                          <div className='absolute inset-0 grid place-items-center text-[11px] text-[var(--d-muted)] px-3 text-center'>
                            Run a trace to see the vector output
                          </div>
                        )}
                      </div>
                    </figure>
                  </div>

                  {/* Progress */}
                  {state.tracing && (
                    <ol className='mt-3 flex flex-col gap-1'>
                      {TRACE_STEPS.map((step, index) => (
                        <li
                          key={step}
                          className={
                            'text-[11px] flex items-center gap-2 ' +
                            (index <= state.traceStep
                              ? 'text-[var(--d-fg)]'
                              : 'text-[var(--d-muted)] opacity-50')
                          }
                        >
                          {index < state.traceStep ? (
                            <Check
                              size={11}
                              aria-hidden='true'
                              style={{ color: 'var(--d-positive)' }}
                            />
                          ) : (
                            <span
                              aria-hidden='true'
                              className='w-[11px] text-center'
                            >
                              ·
                            </span>
                          )}
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}

                  {/* Result */}
                  {state.result && !state.tracing && (
                    <dl className='grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3'>
                      {(
                        [
                          ['Paths', String(state.result.paths)],
                          ['Nodes', String(state.result.nodes)],
                          ['Colours', String(state.result.colours)],
                          [
                            'Reduction',
                            `${Math.round(compressionRatio(state.result) * 100)}%`,
                          ],
                        ] as const
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className='p-2 bg-[var(--d-surface)] border border-[var(--d-border)]'
                          style={{ borderRadius: 'calc(var(--d-radius) / 1.5)' }}
                        >
                          <dt className='text-[10px] uppercase tracking-wide text-[var(--d-muted)]'>
                            {label}
                          </dt>
                          <dd className='font-bold tabular-nums'>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <DemoStatus tone='error' className='mt-3'>
                    {state.failure}
                  </DemoStatus>

                  {/* Version history */}
                  {history.length > 0 && (
                    <div className='mt-4'>
                      <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2 flex items-center gap-1.5'>
                        <History size={11} aria-hidden='true' />
                        Versions of {asset.name}
                      </p>
                      <ul className='flex flex-col gap-1'>
                        {[...history].reverse().map((version) => (
                          <li
                            key={version.version}
                            className='flex items-center justify-between gap-3 text-[11px] py-1.5 border-b border-[var(--d-border)]'
                          >
                            <span className='min-w-0'>
                              <span className='font-bold'>v{version.version}</span>{' '}
                              <span className='text-[var(--d-muted)]'>
                                {version.settings.modeId} · t{version.settings.threshold} ·
                                s{version.settings.smoothing} · {version.paths} paths ·{' '}
                                {bytes(version.bytes)}
                              </span>
                            </span>
                            <DemoButton
                              size='sm'
                              variant='ghost'
                              onClick={() =>
                                dispatch({
                                  type: 'restoreVersion',
                                  assetId: asset.id,
                                  version: version.version,
                                })
                              }
                            >
                              Restore
                            </DemoButton>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Recipe */}
                <div className='flex flex-col gap-3'>
                  <div>
                    <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-1.5'>
                      Mode
                    </p>
                    <div className='grid grid-cols-2 gap-1.5'>
                      {modes.map((item) => (
                        <button
                          key={item.id}
                          type='button'
                          onClick={() =>
                            dispatch({ type: 'setMode', modeId: item.id })
                          }
                          aria-pressed={state.settings.modeId === item.id}
                          style={{ borderRadius: 'var(--d-radius)' }}
                          className={
                            'px-2 min-h-9 text-[11px] font-medium border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                            (state.settings.modeId === item.id
                              ? 'border-[var(--d-accent)] bg-[var(--d-accent)]/15 text-[var(--d-fg)]'
                              : 'border-[var(--d-border)] text-[var(--d-muted)]')
                          }
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                    {mode && (
                      <p className='text-[11px] text-[var(--d-muted)] mt-2 leading-relaxed'>
                        {mode.detail}
                      </p>
                    )}
                  </div>

                  <Slider
                    label='Threshold'
                    value={state.settings.threshold}
                    min={10}
                    max={90}
                    onChange={(value) =>
                      dispatch({ type: 'setParam', name: 'threshold', value })
                    }
                  />
                  <Slider
                    label='Smoothing'
                    value={state.settings.smoothing}
                    min={0}
                    max={100}
                    onChange={(value) =>
                      dispatch({ type: 'setParam', name: 'smoothing', value })
                    }
                  />
                  <Slider
                    label='Palette'
                    value={state.settings.palette}
                    min={2}
                    max={64}
                    suffix=' colours'
                    onChange={(value) =>
                      dispatch({ type: 'setParam', name: 'palette', value })
                    }
                  />

                  {!modeSuitsAsset(state) && (
                    <DemoStatus tone='info'>
                      This mode is not designed for {asset.kind} artwork.
                    </DemoStatus>
                  )}

                  <DemoButton
                    block
                    pending={state.tracing}
                    onClick={() => void trace()}
                    icon={<Play size={13} aria-hidden='true' />}
                  >
                    {state.tracing ? 'Tracing…' : 'Trace'}
                  </DemoButton>
                </div>
              </div>
            )}
          </DemoTabPanel>

          {/* ── Package ─────────────────────────────────────────────────── */}
          <DemoTabPanel id='package' active={state.tab}>
            <div className='max-w-2xl'>
              <p className='text-xs text-[var(--d-muted)] mb-3'>
                Icon and favicon targets generated from the traced vector.
              </p>

              <ul className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
                {iconTargets.map((target) => {
                  const on = selectedTargetIds.has(target.id);
                  return (
                    <li key={target.id}>
                      <label
                        className='flex items-center gap-2.5 px-3 min-h-10 border cursor-pointer text-[11px] transition-colors duration-150'
                        style={{
                          borderRadius: 'var(--d-radius)',
                          borderColor: on ? 'var(--d-accent)' : 'var(--d-border)',
                        }}
                      >
                        <input
                          type='checkbox'
                          checked={on}
                          onChange={() =>
                            dispatch({ type: 'toggleTarget', targetId: target.id })
                          }
                          className='w-3.5 h-3.5 accent-[var(--d-accent)]'
                        />
                        <span className='flex-1 min-w-0'>
                          <span className='block'>{target.label}</span>
                          <span className='block text-[10px] text-[var(--d-muted)] truncate'>
                            {target.file}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className='flex flex-wrap gap-2 mt-3'>
                <DemoButton
                  size='sm'
                  variant='ghost'
                  onClick={() => dispatch({ type: 'selectStandardTargets' })}
                >
                  Standard set
                </DemoButton>
                <DemoButton
                  pending={state.packaging}
                  onClick={() => void makePackage()}
                  icon={<Package size={13} aria-hidden='true' />}
                >
                  {state.packaging
                    ? EXPORT_STEPS[Math.max(0, state.packageStep)]
                    : `Generate ${state.targets.length} files`}
                </DemoButton>
              </div>

              <DemoStatus tone='error' className='mt-3'>
                {state.failure}
              </DemoStatus>

              {state.packageResult && (
                <div
                  className='mt-4 p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
                  style={{ borderRadius: 'var(--d-radius)' }}
                >
                  <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2'>
                    icons.zip · {bytes(state.packageResult.totalBytes)}
                  </p>
                  <ul className='text-[11px] font-mono flex flex-col gap-0.5'>
                    {state.packageResult.files.map((file) => (
                      <li
                        key={file.file}
                        className='flex justify-between gap-4 text-[var(--d-muted)]'
                      >
                        <span className='truncate text-[var(--d-fg)]'>
                          {file.file}
                        </span>
                        <span className='tabular-nums shrink-0'>
                          {bytes(file.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className='text-[10px] text-[var(--d-muted)] mt-2'>
                    Written with a manifest. In the demo nothing leaves the page.
                  </p>
                </div>
              )}
            </div>
          </DemoTabPanel>

          {/* ── Batch ───────────────────────────────────────────────────── */}
          <DemoTabPanel id='batch' active={state.tab}>
            {state.batch.length === 0 ? (
              <div className='py-10 text-center'>
                <p className='text-sm font-medium'>The queue is empty</p>
                <p className='text-xs text-[var(--d-muted)] mt-1'>
                  Queue every source to apply the current recipe to all of them.
                </p>
                <DemoButton
                  size='sm'
                  variant='secondary'
                  className='mt-3'
                  onClick={() => dispatch({ type: 'queueAll' })}
                >
                  Queue all sources
                </DemoButton>
              </div>
            ) : (
              <div className='max-w-xl'>
                <p className='text-xs text-[var(--d-muted)] mb-3'>
                  Applying <span className='font-bold'>{mode?.name}</span> to{' '}
                  {state.batch.length} sources. Unsuitable sources are skipped
                  rather than mangled.
                </p>

                <ul className='flex flex-col gap-1'>
                  {state.batch.map((item) => {
                    const source = findAsset(item.assetId);
                    return (
                      <li
                        key={item.assetId}
                        className='flex items-center gap-3 py-2 border-b border-[var(--d-border)] text-[11px]'
                      >
                        <span className='flex-1 min-w-0 truncate'>
                          {source?.name}
                        </span>
                        <span
                          className='shrink-0 font-medium'
                          style={{
                            color:
                              item.status === 'done'
                                ? 'var(--d-positive)'
                                : item.status === 'skipped'
                                  ? 'var(--d-danger)'
                                  : 'var(--d-muted)',
                          }}
                        >
                          {item.status}
                        </span>
                        {item.reason && (
                          <span className='shrink-0 text-[10px] text-[var(--d-muted)] hidden sm:block'>
                            {item.reason}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <DemoButton
                  className='mt-3'
                  pending={state.batchRunning}
                  onClick={() => void runBatch()}
                  icon={<Play size={13} aria-hidden='true' />}
                >
                  {state.batchRunning ? 'Running…' : 'Run queue'}
                </DemoButton>
              </div>
            )}
          </DemoTabPanel>
        </div>

        {/* Status line, the way a desktop tool has one. */}
        <div className='shrink-0 px-4 py-2 border-t border-[var(--d-border)] text-[10px] text-[var(--d-muted)] flex items-center justify-between gap-4'>
          <span className='truncate'>
            {asset?.name} · {asset?.width}×{asset?.height} · {asset && bytes(asset.bytes)}
          </span>
          <span role='status' aria-live='polite' className='shrink-0'>
            {state.notice ?? 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
}
