import { describe, expect, it } from 'vitest';
import { deals, findDeal, fund, scoreOf } from './data';
import {
  MAX_COMPARE,
  allocatedTotal,
  commitAllocation,
  compareRows,
  committedTotal,
  createInitialState,
  dryPowder,
  remainingAfterAllocation,
  rows,
  sectorExposure,
  visibleRows,
  reducer,
  type Action,
  type State,
} from './state';

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

describe('scoring', () => {
  it('is derived from the deal’s own numbers, not stored', () => {
    for (const deal of deals) {
      const score = scoreOf(deal);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      // Same input, same score, on every call.
      expect(scoreOf(deal)).toBe(score);
    }
  });

  it('prefers growth, margin, price and durability in that shape', () => {
    // The loss-making, expensively priced, three-year-old company scores
    // below the profitable, cheap, seventeen-year-old one.
    const verba = findDeal('d-05');
    const casa = findDeal('d-06');
    expect(verba && casa).toBeTruthy();
    if (verba && casa) {
      expect(scoreOf(verba)).toBeLessThan(scoreOf(casa));
    }
  });
});

describe('the pipeline', () => {
  it('filters by search, stage and sector together', () => {
    const base = createInitialState('pipeline');
    expect(visibleRows(base)).toHaveLength(deals.length);

    const software = run(base, {
      type: 'filterSector',
      sector: 'B2B Software',
    });
    expect(visibleRows(software).every((r) => r.sector === 'B2B Software')).toBe(
      true,
    );

    const andStage = run(software, { type: 'filterStage', stage: 'Sourced' });
    expect(visibleRows(andStage).map((r) => r.id)).toEqual(['d-05']);

    const searched = run(base, { type: 'search', value: 'spain' });
    expect(visibleRows(searched).every((r) => r.geography === 'Spain')).toBe(true);
  });

  it('sorts by each key', () => {
    const base = createInitialState('pipeline');

    const byName = visibleRows(run(base, { type: 'sort', key: 'name' }));
    expect(byName.map((r) => r.name)).toEqual(
      [...byName.map((r) => r.name)].sort((a, b) => a.localeCompare(b)),
    );

    const byAsk = visibleRows(run(base, { type: 'sort', key: 'ask' }));
    for (let i = 1; i < byAsk.length; i++) {
      expect(byAsk[i - 1].ask).toBeGreaterThanOrEqual(byAsk[i].ask);
    }

    // Score is the default.
    const byScore = visibleRows(base);
    for (let i = 1; i < byScore.length; i++) {
      expect(byScore[i - 1].score).toBeGreaterThanOrEqual(byScore[i].score);
    }
  });

  it('moves a deal one stage at a time and stops at Committed', () => {
    let state = createInitialState('pipeline');
    // d-05 starts at Sourced.
    expect(state.stages['d-05']).toBe('Sourced');

    state = run(state, { type: 'advanceStage', dealId: 'd-05' });
    expect(state.stages['d-05']).toBe('Screening');

    for (let i = 0; i < 10; i++) {
      state = run(state, { type: 'advanceStage', dealId: 'd-05' });
    }
    expect(state.stages['d-05']).toBe('Committed');
  });

  it('never re-enters a passed deal into the process', () => {
    const passed = run(createInitialState('pipeline'), {
      type: 'passDeal',
      dealId: 'd-03',
    });
    expect(passed.stages['d-03']).toBe('Passed');

    const nudged = run(passed, { type: 'advanceStage', dealId: 'd-03' });
    expect(nudged.stages['d-03']).toBe('Passed');
  });
});

describe('comparison', () => {
  it('holds at most three deals and toggles membership', () => {
    let state = createInitialState('pipeline');

    for (const id of ['d-01', 'd-02', 'd-03']) {
      state = run(state, { type: 'toggleCompare', dealId: id });
    }
    expect(compareRows(state)).toHaveLength(MAX_COMPARE);

    // A fourth is refused with an explanation rather than silently dropped.
    const overflowed = run(state, { type: 'toggleCompare', dealId: 'd-04' });
    expect(compareRows(overflowed)).toHaveLength(MAX_COMPARE);
    expect(overflowed.notice).toBeTruthy();

    const removed = run(state, { type: 'toggleCompare', dealId: 'd-02' });
    expect(removed.compare).toEqual(['d-01', 'd-03']);
  });

  it('drops a passed deal out of the comparison and its allocation', () => {
    const state = run(
      createInitialState('allocation'),
      { type: 'passDeal', dealId: 'd-02' },
    );

    expect(state.compare).not.toContain('d-02');
    expect(state.allocations['d-02']).toBeUndefined();
  });
});

describe('capital', () => {
  it('opens the allocation scenario within capacity', () => {
    const state = createInitialState('allocation');

    expect(state.tab).toBe('allocation');
    expect(allocatedTotal(state)).toBe(13_700_000_00);
    expect(dryPowder(state)).toBe(fund.size - fund.deployed);
    expect(remainingAfterAllocation(state)).toBeGreaterThan(0);
  });

  it('refuses an allocation with nothing in it', () => {
    const result = commitAllocation(createInitialState('pipeline'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('empty');
  });

  it('refuses a cheque below the fund minimum', () => {
    const state = run(createInitialState('allocation'), {
      type: 'allocate',
      dealId: 'd-02',
      amount: 100_000_00,
    });

    const result = commitAllocation(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('minimum');
  });

  it('refuses a deal that has not reached investment committee', () => {
    // d-01 is at Diligence.
    const state = run(createInitialState('pipeline'), {
      type: 'allocate',
      dealId: 'd-01',
      amount: 2_000_000_00,
    });

    const result = commitAllocation(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('stage');
  });

  it('refuses an allocation larger than the dry powder', () => {
    // 17.5M available; ask for more across the two IC deals.
    const state = run(
      createInitialState('allocation'),
      { type: 'allocate', dealId: 'd-02', amount: 6_500_000_00 },
      { type: 'allocate', dealId: 'd-07', amount: 7_200_000_00 },
      { type: 'allocate', dealId: 'd-02', amount: 11_000_000_00 },
    );

    expect(remainingAfterAllocation(state)).toBeLessThan(0);

    const result = commitAllocation(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('capital');
  });

  it('commits, moves the deals and draws down the fund', () => {
    const state = createInitialState('allocation');
    const before = dryPowder(state);

    const result = commitAllocation(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = run(state, {
      type: 'submitSucceeded',
      commitments: result.value,
    });

    expect(after.stages['d-02']).toBe('Committed');
    expect(after.stages['d-07']).toBe('Committed');
    expect(committedTotal(after)).toBe(13_700_000_00);
    expect(dryPowder(after)).toBe(before - 13_700_000_00);
    // The working allocation is cleared, so nothing can be committed twice.
    expect(allocatedTotal(after)).toBe(0);
    expect(after.tab).toBe('dashboard');
  });

  it('reports sector exposure across commitments and live allocations', () => {
    const state = createInitialState('allocation');
    const exposure = sectorExposure(state);

    const healthcare = exposure.find((e) => e.sector === 'Healthcare Services');
    const industrial = exposure.find((e) => e.sector === 'Industrial');

    expect(healthcare?.amount).toBe(6_500_000_00);
    expect(industrial?.amount).toBe(7_200_000_00);
    // Sorted largest first.
    expect(exposure[0].amount).toBeGreaterThanOrEqual(exposure[1].amount);
  });
});

describe('reset', () => {
  it('restores stages, allocations and the undrawn fund', () => {
    const used = (() => {
      const s = createInitialState('allocation');
      const result = commitAllocation(s);
      if (!result.ok) throw new Error('fixture should have been committable');
      return run(
        s,
        { type: 'submitSucceeded', commitments: result.value },
        { type: 'passDeal', dealId: 'd-03' },
      );
    })();

    expect(used.commitments).toHaveLength(2);
    expect(used.stages['d-03']).toBe('Passed');

    const fresh = createInitialState('allocation');
    expect(fresh.commitments).toEqual([]);
    expect(committedTotal(fresh)).toBe(0);
    expect(fresh.stages['d-03']).toBe('Screening');
    expect(fresh.stages['d-02']).toBe('IC');
    expect(fresh).toEqual(createInitialState('allocation'));

    // And the other scenario has its own starting position.
    const pipeline = createInitialState('pipeline');
    expect(pipeline.tab).toBe('pipeline');
    expect(pipeline.allocations).toEqual({});
    expect(rows(pipeline)).toHaveLength(deals.length);
  });
});
