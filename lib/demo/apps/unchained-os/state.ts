import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  STAGE_ORDER,
  deals,
  findDeal,
  fund,
  portfolio,
  scoreOf,
  type DemoDeal,
  type Stage,
} from './data';

/**
 * Unchained OS — pipeline, comparison and capital allocation.
 *
 * ─── Why allocation is the workflow this demo ends on ─────────────────────
 * A pipeline CRM is a list, and a list is not worth three screens of anybody's
 * time. What makes this an operating system rather than a spreadsheet is that
 * the pipeline and the fund are the same model: moving a deal to Committed and
 * writing it a cheque draws down capital that is then not available to the
 * next deal. So the demo walks a visitor to the point where the constraint
 * bites — dry powder running out mid-allocation — because that is the moment
 * the product is for (§6).
 *
 * Everything here is derived from two pieces of state: which stage each deal
 * is in, and how much has been provisionally allocated to it. Score, dry
 * powder, exposure and every total on the dashboard fall out of those.
 */

export type Tab = 'dashboard' | 'pipeline' | 'compare' | 'allocation';

export type SortKey = 'score' | 'ask' | 'growth' | 'name';

export interface Commitment {
  dealId: string;
  amount: number;
}

export interface State {
  scenarioId: string;
  tab: Tab;
  /** Deal id → stage. Seeded from the fixtures, then moved by the visitor. */
  stages: Record<string, Stage>;
  search: string;
  stageFilter: Stage | '';
  sectorFilter: string;
  sortKey: SortKey;
  /** Deal ids picked for side-by-side comparison. At most three. */
  compare: string[];
  /** The deal whose detail panel is open. */
  openDealId: string | null;
  /** Deal id → provisional cheque, in cents. */
  allocations: Record<string, number>;
  /** Cheques actually committed, which draw down the fund. */
  commitments: Commitment[];
  submitting: boolean;
  failure: string | null;
  notice: string | null;
}

export const MAX_COMPARE = 3;

export function createInitialState(scenarioId: string): State {
  const stages: Record<string, Stage> = {};
  for (const deal of deals) stages[deal.id] = deal.stage;

  const allocationStart = scenarioId === 'allocation';

  return {
    scenarioId,
    tab: allocationStart ? 'allocation' : 'pipeline',
    stages,
    search: '',
    stageFilter: '',
    sectorFilter: '',
    sortKey: 'score',
    // The allocation scenario opens with the two IC-stage deals already on the
    // table, which is the position a committee actually starts from.
    compare: allocationStart ? ['d-02', 'd-07'] : [],
    openDealId: null,
    allocations: allocationStart
      ? { 'd-02': 6_500_000_00, 'd-07': 7_200_000_00 }
      : {},
    commitments: [],
    submitting: false,
    failure: null,
    notice: null,
  };
}

export type Action =
  | { type: 'setTab'; tab: Tab }
  | { type: 'search'; value: string }
  | { type: 'filterStage'; stage: Stage | '' }
  | { type: 'filterSector'; sector: string }
  | { type: 'sort'; key: SortKey }
  | { type: 'clearFilters' }
  | { type: 'openDeal'; dealId: string | null }
  | { type: 'toggleCompare'; dealId: string }
  | { type: 'clearCompare' }
  | { type: 'advanceStage'; dealId: string }
  | { type: 'passDeal'; dealId: string }
  | { type: 'allocate'; dealId: string; amount: number }
  | { type: 'submit' }
  | { type: 'submitFailed'; message: string }
  | { type: 'submitSucceeded'; commitments: Commitment[] }
  | { type: 'dismissNotice' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab, failure: null };

    case 'search':
      return { ...state, search: action.value };

    case 'filterStage':
      return { ...state, stageFilter: action.stage };

    case 'filterSector':
      return { ...state, sectorFilter: action.sector };

    case 'sort':
      return { ...state, sortKey: action.key };

    case 'clearFilters':
      return { ...state, search: '', stageFilter: '', sectorFilter: '' };

    case 'openDeal':
      return { ...state, openDealId: action.dealId };

    case 'toggleCompare': {
      if (state.compare.includes(action.dealId)) {
        return {
          ...state,
          compare: state.compare.filter((id) => id !== action.dealId),
        };
      }
      if (state.compare.length >= MAX_COMPARE) {
        return {
          ...state,
          notice: `Comparison holds ${MAX_COMPARE} deals. Remove one first.`,
        };
      }
      return { ...state, compare: [...state.compare, action.dealId] };
    }

    case 'clearCompare':
      return { ...state, compare: [] };

    case 'advanceStage': {
      const current = state.stages[action.dealId];
      const index = STAGE_ORDER.indexOf(current);
      // A passed deal has left the process; it does not step forward again.
      if (index < 0 || index >= STAGE_ORDER.length - 1) return state;

      const next = STAGE_ORDER[index + 1];
      return {
        ...state,
        stages: { ...state.stages, [action.dealId]: next },
        notice: `${findDeal(action.dealId)?.name} moved to ${next}.`,
      };
    }

    case 'passDeal': {
      const allocations = { ...state.allocations };
      delete allocations[action.dealId];

      return {
        ...state,
        stages: { ...state.stages, [action.dealId]: 'Passed' },
        // A passed deal cannot hold an allocation.
        allocations,
        compare: state.compare.filter((id) => id !== action.dealId),
        notice: `${findDeal(action.dealId)?.name} passed.`,
      };
    }

    case 'allocate': {
      const allocations = { ...state.allocations };
      if (action.amount <= 0) delete allocations[action.dealId];
      else allocations[action.dealId] = action.amount;
      return { ...state, allocations, failure: null };
    }

    case 'submit':
      return { ...state, submitting: true, failure: null };

    case 'submitFailed':
      return { ...state, submitting: false, failure: action.message };

    case 'submitSucceeded': {
      const stages = { ...state.stages };
      for (const commitment of action.commitments) {
        stages[commitment.dealId] = 'Committed';
      }

      return {
        ...state,
        submitting: false,
        stages,
        commitments: [...state.commitments, ...action.commitments],
        allocations: {},
        tab: 'dashboard',
        failure: null,
        notice: `${action.commitments.length} commitment${action.commitments.length === 1 ? '' : 's'} recorded.`,
      };
    }

    case 'dismissNotice':
      return { ...state, notice: null };

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export interface DealRow extends DemoDeal {
  currentStage: Stage;
  score: number;
  allocated: number;
  inCompare: boolean;
}

export function rows(state: State): DealRow[] {
  const comparing = new Set(state.compare);

  return deals.map((deal) => ({
    ...deal,
    currentStage: state.stages[deal.id] ?? deal.stage,
    score: scoreOf(deal),
    allocated: state.allocations[deal.id] ?? 0,
    inCompare: comparing.has(deal.id),
  }));
}

export function visibleRows(state: State): DealRow[] {
  const query = state.search.trim().toLowerCase();

  const filtered = rows(state).filter((row) => {
    if (state.stageFilter && row.currentStage !== state.stageFilter) return false;
    if (state.sectorFilter && row.sector !== state.sectorFilter) return false;
    if (
      query &&
      !row.name.toLowerCase().includes(query) &&
      !row.sector.toLowerCase().includes(query) &&
      !row.geography.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (state.sortKey) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'ask':
        return b.ask - a.ask;
      case 'growth':
        return b.growth - a.growth;
      default:
        return b.score - a.score;
    }
  });

  return sorted;
}

export function compareRows(state: State): DealRow[] {
  const all = rows(state);
  // Preserves the order they were added in, which is the order they appear.
  return state.compare.flatMap((id) => {
    const row = all.find((candidate) => candidate.id === id);
    return row ? [row] : [];
  });
}

export function allocatedTotal(state: State): number {
  return Object.values(state.allocations).reduce((sum, amount) => sum + amount, 0);
}

export function committedTotal(state: State): number {
  return state.commitments.reduce((sum, item) => sum + item.amount, 0);
}

/** Capital not yet deployed or committed in this session. */
export function dryPowder(state: State): number {
  return fund.size - fund.deployed - committedTotal(state);
}

/** What would be left if the current allocation were committed. */
export function remainingAfterAllocation(state: State): number {
  return dryPowder(state) - allocatedTotal(state);
}

export function portfolioValue(): number {
  return portfolio.reduce((sum, position) => sum + position.value, 0);
}

export function portfolioCost(): number {
  return portfolio.reduce((sum, position) => sum + position.invested, 0);
}

/** Total value to paid-in, the multiple every fund dashboard leads with. */
export function tvpi(): number {
  return portfolioValue() / portfolioCost();
}

/** Exposure by sector across committed positions and live allocations. */
export function sectorExposure(state: State): { sector: string; amount: number }[] {
  const totals = new Map<string, number>();

  for (const commitment of state.commitments) {
    const deal = findDeal(commitment.dealId);
    if (!deal) continue;
    totals.set(deal.sector, (totals.get(deal.sector) ?? 0) + commitment.amount);
  }

  for (const [dealId, amount] of Object.entries(state.allocations)) {
    const deal = findDeal(dealId);
    if (!deal) continue;
    totals.set(deal.sector, (totals.get(deal.sector) ?? 0) + amount);
  }

  return [...totals.entries()]
    .map(([sector, amount]) => ({ sector, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

/**
 * Commit the current allocation, or refuse it.
 *
 * The refusals are the product: a cheque below the fund's minimum, a deal that
 * is not at investment committee yet, and — the one worth reaching — an
 * allocation larger than the capital left to deploy.
 */
export function commitAllocation(state: State): DemoResult<Commitment[]> {
  const entries = Object.entries(state.allocations).filter(
    ([, amount]) => amount > 0,
  );

  if (entries.length === 0) {
    return fail('empty', 'Allocate capital to at least one deal first.');
  }

  for (const [dealId, amount] of entries) {
    const deal = findDeal(dealId);
    if (!deal) continue;

    if (amount < fund.minimumCheque) {
      return fail(
        'minimum',
        `${deal.name}: below the fund's ${(fund.minimumCheque / 100 / 1_000_000).toFixed(1)}M minimum cheque.`,
      );
    }

    const stage = state.stages[dealId];
    if (stage !== 'IC' && stage !== 'Committed') {
      return fail(
        'stage',
        `${deal.name} is at ${stage}. Deals commit from investment committee.`,
      );
    }
  }

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const available = dryPowder(state);

  if (total > available) {
    return fail(
      'capital',
      `Allocation exceeds dry powder by ${((total - available) / 100 / 1_000_000).toFixed(2)}M. Reduce a cheque or pass a deal.`,
    );
  }

  return ok(entries.map(([dealId, amount]) => ({ dealId, amount })));
}
