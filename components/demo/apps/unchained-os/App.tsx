'use client';

import { useEffect, useReducer, type Dispatch } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  LayoutDashboard,
  Layers,
  Scale,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import DemoTabs, { DemoTabPanel } from '@/components/demo/ui/DemoTabs';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { percent } from '@/lib/demo/format';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  STAGE_ORDER,
  findDeal,
  fund,
  investors,
  navSeries,
  portfolio,
  sectors,
  usdM,
  type Stage,
} from '@/lib/demo/apps/unchained-os/data';
import {
  MAX_COMPARE,
  allocatedTotal,
  commitAllocation,
  compareRows,
  committedTotal,
  createInitialState,
  dryPowder,
  portfolioCost,
  portfolioValue,
  reducer,
  remainingAfterAllocation,
  rows,
  sectorExposure,
  tvpi,
  visibleRows,
  type Action,
  type SortKey,
  type State,
} from '@/lib/demo/apps/unchained-os/state';

/**
 * Unchained OS — the fund console.
 *
 * Four views that are one model: the pipeline decides which deals can take
 * capital, the comparison decides which of them should, and the allocation
 * screen spends the fund's remaining money on that decision. The dashboard is
 * the consequence.
 */

const stageTone: Record<Stage, string> = {
  Sourced: 'var(--d-muted)',
  Screening: 'var(--d-muted)',
  Diligence: 'var(--d-accent)',
  IC: 'var(--d-accent)',
  Committed: 'var(--d-positive)',
  Passed: 'var(--d-danger)',
};

function StagePill({ stage }: { stage: Stage }) {
  return (
    <span
      className='inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase border'
      style={{
        color: stageTone[stage],
        borderColor: `color-mix(in oklab, ${stageTone[stage]} 40%, transparent)`,
        background: `color-mix(in oklab, ${stageTone[stage]} 10%, transparent)`,
        borderRadius: 'calc(var(--d-radius) / 2)',
      }}
    >
      {stage}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
      style={{ borderRadius: 'var(--d-radius)' }}
    >
      <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)]'>
        {label}
      </p>
      <p className='text-lg font-bold tabular-nums mt-1'>{value}</p>
      {sub && <p className='text-[11px] text-[var(--d-muted)] mt-0.5'>{sub}</p>}
    </div>
  );
}

/**
 * Net asset value by quarter.
 *
 * Hand-drawn SVG rather than a charting library: it is eight points and one
 * path, and adding a dependency to the initial payload of a portfolio site to
 * draw it would be the wrong trade (§12). Labelled for assistive technology,
 * since a line nobody can read is decoration.
 */
function NavChart() {
  const max = Math.max(...navSeries);
  const min = Math.min(...navSeries) * 0.9;
  const points = navSeries.map((value, index) => {
    const x = (index / (navSeries.length - 1)) * 100;
    const y = 100 - ((value - min) / (max - min)) * 100;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,100 ${line} 100,100`;

  return (
    <figure
      className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
      style={{ borderRadius: 'var(--d-radius)' }}
    >
      <figcaption className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2'>
        Net asset value · last 8 quarters
      </figcaption>
      <svg
        viewBox='0 0 100 100'
        preserveAspectRatio='none'
        className='w-full h-24'
        role='img'
        aria-label={`Net asset value rose from ${usdM(navSeries[0])} to ${usdM(navSeries[navSeries.length - 1])} over eight quarters.`}
      >
        <polygon points={area} fill='var(--d-accent)' fillOpacity='0.14' />
        <polyline
          points={line}
          fill='none'
          stroke='var(--d-accent)'
          strokeWidth='1.5'
          vectorEffect='non-scaling-stroke'
        />
      </svg>
      <p className='text-[11px] text-[var(--d-muted)] mt-2 tabular-nums'>
        {usdM(navSeries[0])} → {usdM(navSeries[navSeries.length - 1])}
      </p>
    </figure>
  );
}


/**
 * One component per view.
 *
 * The console has four, and holding them in one function meant scrolling past
 * the pipeline table to reach the allocation screen. Each reads its own slice
 * through the same selectors the whole demo uses, so no view can see another's
 * locals. This product's source is not on this machine, so the split is
 * permanent rather than a stopgap for a later vendoring.
 */
interface PanelProps {
  state: State;
  dispatch: Dispatch<Action>;
}

function DashboardPanel({ state }: PanelProps) {
  return (
  <DemoTabPanel id='dashboard' active={state.tab}>
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
      <Kpi
        label='Committed capital'
        value={usdM(fund.size)}
        sub={`${investors.length} investors`}
      />
      <Kpi
        label='Deployed'
        value={usdM(fund.deployed + committedTotal(state))}
        sub={percent(
          (fund.deployed + committedTotal(state)) / fund.size,
          'en-US',
          0,
        )}
      />
      <Kpi label='Portfolio value' value={usdM(portfolioValue())} />
      <Kpi
        label='TVPI'
        value={`${tvpi().toFixed(2)}×`}
        sub={`on ${usdM(portfolioCost())} invested`}
      />
    </div>

    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3'>
      <NavChart />

      <div
        className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
        style={{ borderRadius: 'var(--d-radius)' }}
      >
        <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2'>
          Positions
        </p>
        <table className='w-full text-xs'>
          <thead className='text-[var(--d-muted)]'>
            <tr className='text-left'>
              <th className='font-medium pb-1'>Company</th>
              <th className='font-medium pb-1 text-right'>Invested</th>
              <th className='font-medium pb-1 text-right'>Value</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((position) => (
              <tr key={position.name} className='border-t border-[var(--d-border)]'>
                <td className='py-1.5'>{position.name}</td>
                <td className='py-1.5 text-right tabular-nums'>
                  {usdM(position.invested)}
                </td>
                <td
                  className='py-1.5 text-right tabular-nums font-medium'
                  style={{
                    color:
                      position.value >= position.invested
                        ? 'var(--d-positive)'
                        : 'var(--d-danger)',
                  }}
                >
                  {usdM(position.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {state.commitments.length > 0 && (
      <div
        className='mt-3 p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
        style={{ borderRadius: 'var(--d-radius)' }}
      >
        <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2'>
          Committed this session
        </p>
        <ul className='flex flex-col gap-1 text-xs'>
          {state.commitments.map((commitment) => (
            <li
              key={commitment.dealId}
              className='flex justify-between border-b border-[var(--d-border)] pb-1'
            >
              <span>{findDeal(commitment.dealId)?.name}</span>
              <span className='tabular-nums font-medium'>
                {usdM(commitment.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div
      className='mt-3 p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
      style={{ borderRadius: 'var(--d-radius)' }}
    >
      <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2'>
        Investors
      </p>
      <ul className='flex flex-col gap-1.5'>
        {investors.map((investor) => (
          <li key={investor.name} className='text-xs'>
            <div className='flex justify-between mb-1'>
              <span>{investor.name}</span>
              <span className='tabular-nums text-[var(--d-muted)]'>
                {usdM(investor.called)} / {usdM(investor.committed)} called
              </span>
            </div>
            <div
              className='h-1.5 bg-[var(--d-surface-2)] overflow-hidden'
              style={{ borderRadius: '9999px' }}
            >
              <div
                className='h-full bg-[var(--d-accent)]'
                style={{
                  width: `${(investor.called / investor.committed) * 100}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  </DemoTabPanel>
  );
}

function PipelinePanel({ state, dispatch }: PanelProps) {
  const list = visibleRows(state);

  return (
  <DemoTabPanel id='pipeline' active={state.tab}>
    <div className='flex flex-wrap items-end gap-2 mb-3'>
      <div className='relative flex-1 min-w-[12rem]'>
        <Search
          size={13}
          aria-hidden='true'
          className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--d-muted)]'
        />
        <input
          type='search'
          value={state.search}
          onChange={(event) =>
            dispatch({ type: 'search', value: event.target.value })
          }
          placeholder='Search deals'
          aria-label='Search deals'
          style={{ borderRadius: 'var(--d-radius)' }}
          className='w-full pl-8 pr-2 min-h-9 text-xs bg-[var(--d-surface)] border border-[var(--d-border)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
        />
      </div>

      <select
        value={state.stageFilter}
        onChange={(event) =>
          dispatch({
            type: 'filterStage',
            stage: event.target.value as Stage | '',
          })
        }
        aria-label='Filter by stage'
        style={{ borderRadius: 'var(--d-radius)' }}
        className='min-h-9 px-2 text-xs bg-[var(--d-surface)] border border-[var(--d-border)]'
      >
        <option value=''>All stages</option>
        {[...STAGE_ORDER, 'Passed' as Stage].map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>

      <select
        value={state.sectorFilter}
        onChange={(event) =>
          dispatch({ type: 'filterSector', sector: event.target.value })
        }
        aria-label='Filter by sector'
        style={{ borderRadius: 'var(--d-radius)' }}
        className='min-h-9 px-2 text-xs bg-[var(--d-surface)] border border-[var(--d-border)]'
      >
        <option value=''>All sectors</option>
        {sectors.map((sector) => (
          <option key={sector} value={sector}>
            {sector}
          </option>
        ))}
      </select>

      <select
        value={state.sortKey}
        onChange={(event) =>
          dispatch({ type: 'sort', key: event.target.value as SortKey })
        }
        aria-label='Sort by'
        style={{ borderRadius: 'var(--d-radius)' }}
        className='min-h-9 px-2 text-xs bg-[var(--d-surface)] border border-[var(--d-border)]'
      >
        <option value='score'>Sort: score</option>
        <option value='ask'>Sort: ask</option>
        <option value='growth'>Sort: growth</option>
        <option value='name'>Sort: name</option>
      </select>
    </div>

    <p className='text-[11px] text-[var(--d-muted)] mb-2' role='status' aria-live='polite'>
      {list.length} of {rows(state).length} deals
    </p>

    <div className='overflow-x-auto'>
      <table className='w-full text-xs min-w-[36rem]'>
        <thead className='text-[var(--d-muted)]'>
          <tr className='text-left'>
            <th className='font-medium pb-2'>Company</th>
            <th className='font-medium pb-2'>Stage</th>
            <th className='font-medium pb-2 text-right'>Ask</th>
            <th className='font-medium pb-2 text-right'>Growth</th>
            <th className='font-medium pb-2 text-right'>Score</th>
            <th className='font-medium pb-2 text-right'>Compare</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr
              key={row.id}
              className='border-t border-[var(--d-border)] hover:bg-[var(--d-surface)]'
            >
              <td className='py-2'>
                <button
                  type='button'
                  onClick={() => dispatch({ type: 'openDeal', dealId: row.id })}
                  className='text-left font-medium hover:text-[var(--d-accent)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                >
                  {row.name}
                  <span className='block text-[10px] text-[var(--d-muted)] font-normal'>
                    {row.sector} · {row.geography}
                  </span>
                </button>
              </td>
              <td className='py-2'>
                <StagePill stage={row.currentStage} />
              </td>
              <td className='py-2 text-right tabular-nums'>{usdM(row.ask)}</td>
              <td className='py-2 text-right tabular-nums'>
                {percent(row.growth, 'en-US', 0)}
              </td>
              <td className='py-2 text-right tabular-nums font-bold'>
                {row.score}
              </td>
              <td className='py-2 text-right'>
                <button
                  type='button'
                  onClick={() =>
                    dispatch({ type: 'toggleCompare', dealId: row.id })
                  }
                  aria-pressed={row.inCompare}
                  aria-label={`${row.inCompare ? 'Remove' : 'Add'} ${row.name} ${row.inCompare ? 'from' : 'to'} comparison`}
                  style={{ borderRadius: 'calc(var(--d-radius) / 2)' }}
                  className={
                    'w-6 h-6 grid place-items-center border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                    (row.inCompare
                      ? 'bg-[var(--d-accent)] border-[var(--d-accent)] text-[var(--d-accent-fg)]'
                      : 'border-[var(--d-border)] text-[var(--d-muted)]')
                  }
                >
                  {row.inCompare ? (
                    <Check size={12} aria-hidden='true' />
                  ) : (
                    <span aria-hidden='true' className='text-sm leading-none'>
                      +
                    </span>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {list.length === 0 && (
      <div className='py-8 text-center'>
        <p className='text-xs text-[var(--d-muted)]'>
          No deals match those filters.
        </p>
        <DemoButton
          size='sm'
          variant='ghost'
          className='mt-2'
          onClick={() => dispatch({ type: 'clearFilters' })}
        >
          Clear filters
        </DemoButton>
      </div>
    )}
  </DemoTabPanel>
  );
}

function ComparePanel({ state, dispatch }: PanelProps) {
  const comparison = compareRows(state);

  return (
  <DemoTabPanel id='compare' active={state.tab}>
    {comparison.length === 0 ? (
      <div className='py-10 text-center'>
        <p className='text-sm font-medium'>Nothing to compare yet</p>
        <p className='text-xs text-[var(--d-muted)] mt-1'>
          Add up to {MAX_COMPARE} deals from the pipeline.
        </p>
        <DemoButton
          size='sm'
          variant='secondary'
          className='mt-3'
          onClick={() => dispatch({ type: 'setTab', tab: 'pipeline' })}
        >
          Open pipeline
        </DemoButton>
      </div>
    ) : (
      <>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-xs text-[var(--d-muted)]'>
            {comparison.length} of {MAX_COMPARE} slots used
          </p>
          <DemoButton
            size='sm'
            variant='ghost'
            onClick={() => dispatch({ type: 'clearCompare' })}
          >
            Clear
          </DemoButton>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-xs min-w-[30rem]'>
            <thead>
              <tr>
                <th className='text-left font-medium text-[var(--d-muted)] pb-2 w-32'>
                  Metric
                </th>
                {comparison.map((row) => (
                  <th key={row.id} className='text-right pb-2'>
                    <span className='block font-bold'>{row.name}</span>
                    <button
                      type='button'
                      onClick={() =>
                        dispatch({ type: 'toggleCompare', dealId: row.id })
                      }
                      aria-label={`Remove ${row.name} from comparison`}
                      className='text-[10px] font-normal text-[var(--d-muted)] hover:text-[var(--d-danger)] inline-flex items-center gap-0.5 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                    >
                      <X size={9} aria-hidden='true' /> remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Stage', (r: (typeof comparison)[number]) => r.currentStage],
                  ['Sector', (r: (typeof comparison)[number]) => r.sector],
                  ['Ask', (r: (typeof comparison)[number]) => usdM(r.ask)],
                  ['Revenue', (r: (typeof comparison)[number]) => usdM(r.revenue)],
                  [
                    'Growth',
                    (r: (typeof comparison)[number]) =>
                      percent(r.growth, 'en-US', 0),
                  ],
                  [
                    'EBITDA margin',
                    (r: (typeof comparison)[number]) =>
                      percent(r.margin, 'en-US', 0),
                  ],
                  [
                    'EV / revenue',
                    (r: (typeof comparison)[number]) => `${r.multiple.toFixed(1)}×`,
                  ],
                  [
                    'Score',
                    (r: (typeof comparison)[number]) => String(r.score),
                  ],
                ] as const
              ).map(([label, read]) => (
                <tr key={label} className='border-t border-[var(--d-border)]'>
                  <th
                    scope='row'
                    className='text-left font-medium text-[var(--d-muted)] py-2'
                  >
                    {label}
                  </th>
                  {comparison.map((row) => (
                    <td
                      key={row.id}
                      className='py-2 text-right tabular-nums font-medium'
                    >
                      {read(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='flex flex-wrap gap-2 mt-4'>
          {comparison.map((row) => (
            <div
              key={row.id}
              className='flex-1 min-w-[12rem] p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
              style={{ borderRadius: 'var(--d-radius)' }}
            >
              <p className='text-xs font-bold'>{row.name}</p>
              <p className='text-[11px] text-[var(--d-muted)] leading-relaxed mt-1'>
                {row.thesis}
              </p>
              <div className='flex gap-2 mt-2'>
                <DemoButton
                  size='sm'
                  variant='secondary'
                  disabled={
                    row.currentStage === 'Passed' ||
                    row.currentStage === 'Committed'
                  }
                  onClick={() =>
                    dispatch({ type: 'advanceStage', dealId: row.id })
                  }
                  icon={<ArrowUpRight size={12} aria-hidden='true' />}
                >
                  Advance
                </DemoButton>
                <DemoButton
                  size='sm'
                  variant='ghost'
                  disabled={row.currentStage === 'Passed'}
                  onClick={() => dispatch({ type: 'passDeal', dealId: row.id })}
                >
                  Pass
                </DemoButton>
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </DemoTabPanel>
  );
}

function AllocationPanel({ state, dispatch, onCommit }: PanelProps & { onCommit: () => void }) {
  return (
  <DemoTabPanel id='allocation' active={state.tab}>
    <div className='grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4'>
      <Kpi label='Dry powder' value={usdM(dryPowder(state))} />
      <Kpi label='Allocated' value={usdM(allocatedTotal(state))} />
      <Kpi
        label='Remaining after'
        value={usdM(remainingAfterAllocation(state))}
        sub={
          remainingAfterAllocation(state) < 0
            ? 'Over-allocated'
            : 'Within capacity'
        }
      />
    </div>

    <p className='text-xs text-[var(--d-muted)] mb-2'>
      Deals at investment committee. Minimum cheque {usdM(fund.minimumCheque)}.
    </p>

    <ul className='flex flex-col gap-2'>
      {/* One pass: select and render together. */}
      {rows(state).flatMap((row) =>
        row.currentStage === 'IC' || row.allocated > 0 ? (
        <li
          key={row.id}
          className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
          style={{ borderRadius: 'var(--d-radius)' }}
        >
          <div className='flex items-center justify-between gap-3 mb-2'>
            <div className='min-w-0'>
              <p className='text-xs font-bold'>{row.name}</p>
              <p className='text-[10px] text-[var(--d-muted)]'>
                Asking {usdM(row.ask)} · score {row.score}
              </p>
            </div>
            <StagePill stage={row.currentStage} />
          </div>

          <label className='block'>
            <span className='flex justify-between text-[11px] mb-1'>
              <span className='text-[var(--d-muted)]'>Cheque</span>
              <span className='font-bold tabular-nums'>
                {usdM(row.allocated)}
              </span>
            </span>
            <input
              type='range'
              min={0}
              max={row.ask}
              step={100_000_00}
              value={row.allocated}
              onChange={(event) =>
                dispatch({
                  type: 'allocate',
                  dealId: row.id,
                  amount: Number(event.target.value),
                })
              }
              aria-label={`Cheque for ${row.name}`}
              aria-valuetext={usdM(row.allocated)}
              className='w-full accent-[var(--d-accent)]'
            />
          </label>
        </li>
        ) : (
          []
        ),
      )}
    </ul>

    {sectorExposure(state).length > 0 && (
      <div
        className='mt-3 p-3 bg-[var(--d-surface)] border border-[var(--d-border)]'
        style={{ borderRadius: 'var(--d-radius)' }}
      >
        <p className='text-[10px] uppercase tracking-widest text-[var(--d-muted)] mb-2'>
          Sector exposure, including this allocation
        </p>
        <ul className='flex flex-col gap-1 text-xs'>
          {sectorExposure(state).map((entry) => (
            <li key={entry.sector} className='flex justify-between'>
              <span>{entry.sector}</span>
              <span className='tabular-nums'>{usdM(entry.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <DemoStatus tone='error' className='mt-3'>
      {state.failure}
    </DemoStatus>

    <DemoButton
      className='mt-3'
      size='lg'
      pending={state.submitting}
      onClick={() => void onCommit()}
      icon={<ChevronRight size={14} aria-hidden='true' />}
    >
      {state.submitting
        ? 'Recording…'
        : `Commit ${usdM(allocatedTotal(state))}`}
    </DemoButton>
  </DemoTabPanel>
  );
}

export default function UnchainedOsDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);

  // Only what the shell itself draws: the tab badge and the detail drawer.
  const comparison = compareRows(state);
  const open = state.openDealId ? findDeal(state.openDealId) : undefined;
  const openRow = rows(state).find((row) => row.id === state.openDealId);

  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => dispatch({ type: 'dismissNotice' }), 3000);
    return () => clearTimeout(timer);
  }, [state.notice]);

  async function commit() {
    dispatch({ type: 'submit' });

    const result = await simulate(
      () => commitAllocation(state),
      DEMO_LATENCY.normal,
    );

    if (result.ok) {
      dispatch({ type: 'submitSucceeded', commitments: result.value });
      track('demo_completed', {
        project: 'unchained-os',
        workflow: 'allocation',
      });
    } else {
      dispatch({ type: 'submitFailed', message: result.failure.message });
    }
  }

  return (
    <div className='h-full flex flex-col text-[13px]'>
      {/* ── Console header ──────────────────────────────────────────────── */}
      <header className='shrink-0 px-4 pt-3 border-b border-[var(--d-border)]'>
        <div className='flex items-center justify-between gap-4 pb-2.5'>
          <div className='flex items-baseline gap-2 min-w-0'>
            <p className='text-sm font-bold tracking-tight'>{fund.name}</p>
            <p className='text-[11px] text-[var(--d-muted)] truncate'>
              Vintage {fund.vintage} · {usdM(fund.size)} committed
            </p>
          </div>
          <p className='text-[11px] text-[var(--d-muted)] tabular-nums shrink-0'>
            Dry powder{' '}
            <span className='font-bold text-[var(--d-fg)]'>
              {usdM(dryPowder(state))}
            </span>
          </p>
        </div>

        <DemoTabs
          label='Console'
          active={state.tab}
          onChange={(tab) => dispatch({ type: 'setTab', tab: tab as State['tab'] })}
          tabs={[
            {
              id: 'dashboard',
              label: 'Dashboard',
              icon: <LayoutDashboard size={13} aria-hidden='true' />,
            },
            {
              id: 'pipeline',
              label: 'Pipeline',
              icon: <Layers size={13} aria-hidden='true' />,
            },
            {
              id: 'compare',
              label: 'Compare',
              icon: <Scale size={13} aria-hidden='true' />,
              badge: comparison.length || undefined,
            },
            {
              id: 'allocation',
              label: 'Allocation',
              icon: <Wallet size={13} aria-hidden='true' />,
            },
          ]}
        />
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto p-4'>
        {/* ── Dashboard ─────────────────────────────────────────────────── */}
        <DashboardPanel state={state} dispatch={dispatch} />

        {/* ── Pipeline ──────────────────────────────────────────────────── */}
        <PipelinePanel state={state} dispatch={dispatch} />

        {/* ── Compare ───────────────────────────────────────────────────── */}
        <ComparePanel state={state} dispatch={dispatch} />

        {/* ── Allocation ────────────────────────────────────────────────── */}
        <AllocationPanel state={state} dispatch={dispatch} onCommit={commit} />
      </div>

      {/* ── Deal detail ─────────────────────────────────────────────────── */}
      {open && openRow && (
        <div className='absolute inset-0 z-20 flex justify-end'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => dispatch({ type: 'openDeal', dealId: null })}
            aria-hidden='true'
          />
          <aside
            className='relative w-full sm:w-[24rem] h-full bg-[var(--d-surface)] border-l border-[var(--d-border)] overflow-y-auto p-4'
            aria-label={`${open.name} detail`}
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-sm font-bold'>{open.name}</h2>
                <p className='text-[11px] text-[var(--d-muted)]'>
                  {open.sector} · {open.geography} · {open.age} years trading
                </p>
              </div>
              <button
                type='button'
                onClick={() => dispatch({ type: 'openDeal', dealId: null })}
                aria-label='Close detail'
                className='p-1.5 text-[var(--d-muted)] hover:text-[var(--d-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                <X size={15} aria-hidden='true' />
              </button>
            </div>

            <div className='mt-3'>
              <StagePill stage={openRow.currentStage} />
            </div>

            <p className='text-xs leading-relaxed mt-3'>{open.thesis}</p>

            <dl className='grid grid-cols-2 gap-2 mt-4 text-xs'>
              {(
                [
                  ['Ask', usdM(open.ask)],
                  ['Revenue (TTM)', usdM(open.revenue)],
                  ['Growth', percent(open.growth, 'en-US', 0)],
                  ['EBITDA margin', percent(open.margin, 'en-US', 0)],
                  ['EV / revenue', `${open.multiple.toFixed(1)}×`],
                  ['Score', String(openRow.score)],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className='p-2 bg-[var(--d-surface-2)]'
                  style={{ borderRadius: 'calc(var(--d-radius) / 2)' }}
                >
                  <dt className='text-[10px] uppercase tracking-wide text-[var(--d-muted)]'>
                    {label}
                  </dt>
                  <dd className='font-bold tabular-nums mt-0.5'>{value}</dd>
                </div>
              ))}
            </dl>

            <div className='flex flex-wrap gap-2 mt-4'>
              <DemoButton
                size='sm'
                disabled={
                  openRow.currentStage === 'Passed' ||
                  openRow.currentStage === 'Committed'
                }
                onClick={() => dispatch({ type: 'advanceStage', dealId: open.id })}
                icon={<ArrowUpRight size={12} aria-hidden='true' />}
              >
                Advance stage
              </DemoButton>
              <DemoButton
                size='sm'
                variant='secondary'
                onClick={() => dispatch({ type: 'toggleCompare', dealId: open.id })}
              >
                {openRow.inCompare ? 'In comparison' : 'Add to compare'}
              </DemoButton>
              <DemoButton
                size='sm'
                variant='ghost'
                disabled={openRow.currentStage === 'Passed'}
                onClick={() => dispatch({ type: 'passDeal', dealId: open.id })}
              >
                Pass
              </DemoButton>
            </div>
          </aside>
        </div>
      )}

      {/* ── Notices ─────────────────────────────────────────────────────── */}
      {state.notice && (
        <div className='absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%]'>
          <DemoStatus tone='success'>{state.notice}</DemoStatus>
        </div>
      )}
    </div>
  );
}