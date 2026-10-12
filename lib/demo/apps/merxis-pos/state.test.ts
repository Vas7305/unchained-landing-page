import { describe, expect, it } from 'vitest';
import { DENOMINATIONS, OPENING_FLOAT, TILE_PASTEL, products, salesFor } from './data';
import {
  bills,
  cartTotal,
  cashPeriod,
  cashStatus,
  cashSuggestions,
  change,
  checkout,
  closeRegister,
  counted,
  createInitialState,
  cup,
  expected,
  findSale,
  pieces,
  reducer,
  tileName,
  today,
  visibleProducts,
  type Action,
  type State,
} from './state';

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state);
const start = (scenario = 'turno') => createInitialState(scenario);

/** Charge the ticket the way the view does: decide, then record. */
function charge(state: State): State {
  const result = checkout(state);
  if (!result.ok) return reducer(state, { type: 'chargeFailed', message: result.failure.message });
  return reducer(state, { type: 'chargeDone', sale: result.value });
}

describe('fixtures', () => {
  it('gives every product a unique code and a palette colour', () => {
    expect(new Set(products.map((p) => p.sku)).size).toBe(products.length);
    for (const p of products) expect(TILE_PASTEL[p.color]).toBeTruthy();
  });

  it('never records a cash sale paid with less than its total', () => {
    for (const sale of salesFor('cierre')) {
      if (sale.received !== null) expect(sale.received).toBeGreaterThanOrEqual(sale.total);
    }
  });

  it('opens each scenario where its story is', () => {
    expect(start('turno')).toMatchObject({ view: 'caja' });
    expect(start('turno').sales).toHaveLength(3);
    expect(start('cierre')).toMatchObject({ view: 'cierre' });
    expect(start('cierre').sales).toHaveLength(7);
  });

  it('falls back to the first scenario for an unknown id', () => {
    expect(start('nope').sales).toHaveLength(3);
  });
});

describe('the ticket', () => {
  it('adds a product and totals it', () => {
    const s = run(start(), { type: 'add', productId: 'refresco', qty: 1 }, { type: 'add', productId: 'refresco', qty: 1 });
    expect(s.cart).toEqual([{ productId: 'refresco', qty: 2 }]);
    expect(cartTotal(s)).toBe(48_000);
  });

  it('never holds more than is on the shelf', () => {
    // Six beers in stock.
    const full = run(start(), { type: 'add', productId: 'cerveza', qty: 6 }, { type: 'add', productId: 'cerveza', qty: 1 });
    expect(full.cart).toEqual([{ productId: 'cerveza', qty: 6 }]);
    expect(full.notice).toEqual({ tone: 'error', text: 'Solo hay 6 pz de Cerveza clara 355 ml' });
  });

  it('refuses a product that is sold out', () => {
    const s = run(start(), { type: 'add', productId: 'huevos', qty: 1 });
    expect(s.cart).toEqual([]);
    expect(s.notice?.text).toBe('Huevos 30 u está agotado');
  });

  it('removes a line when its quantity reaches zero', () => {
    const s = run(start(), { type: 'add', productId: 'jabon', qty: 2 }, { type: 'setQty', productId: 'jabon', qty: 0 });
    expect(s.cart).toEqual([]);
  });

  it('weighs products sold by the kilo and counts them once', () => {
    const s = run(start(), { type: 'weigh', productId: 'queso' });
    expect(s.weighing).toBe('queso');
    const weighed = run(s, { type: 'add', productId: 'queso', qty: 0.25 }, { type: 'add', productId: 'refresco', qty: 2 });
    expect(weighed.weighing).toBeNull();
    expect(cartTotal(weighed)).toBe(65_000 + 48_000);
    expect(pieces(weighed)).toBe(3);
  });
});

describe('scanning', () => {
  it('puts a scanned code on the ticket and clears the box', () => {
    const s = run(start(), { type: 'query', query: '2000000000017' }, { type: 'scan' });
    expect(s.cart).toEqual([{ productId: 'refresco', qty: 1 }]);
    expect(s.query).toBe('');
  });

  it('does not charge a code twice when it is read again', () => {
    const s = run(
      start(),
      { type: 'query', query: '2000000000017' },
      { type: 'scan' },
      { type: 'query', query: '2000000000017' },
      { type: 'scan' },
    );
    expect(s.cart).toEqual([{ productId: 'refresco', qty: 1 }]);
    expect(s.notice?.tone).toBe('info');
  });

  it('sends a scanned kilo product to the scale', () => {
    const s = run(start(), { type: 'query', query: '2000000000109' }, { type: 'scan' });
    expect(s.weighing).toBe('arroz');
    expect(s.cart).toEqual([]);
  });

  it('takes a search with one match, and refuses an ambiguous one', () => {
    expect(run(start(), { type: 'query', query: 'malta' }, { type: 'scan' }).cart).toEqual([
      { productId: 'malta', qty: 1 },
    ]);
    expect(run(start(), { type: 'query', query: '355' }, { type: 'scan' }).notice?.text).toBe(
      'Hay varios productos, toca uno',
    );
  });

  it('lists sellable products first', () => {
    const grid = visibleProducts(run(start(), { type: 'group', group: 'Despensa' }));
    expect(grid.at(-1)?.id).toBe('huevos');
  });
});

describe('charging', () => {
  it('refuses cash short of the total', () => {
    const s = run(start(), { type: 'add', productId: 'pizza', qty: 1 }, { type: 'received', text: '1000' });
    expect(change(s)).toBe(-80_000);
    const result = checkout(s);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.message).toBe('Faltan $800');
  });

  it('records the sale, takes it off the shelf and opens the receipt', () => {
    const before = start();
    const s = charge(run(before, { type: 'add', productId: 'refresco', qty: 2 }, { type: 'received', text: '500' }));
    const sale = findSale(s, 4)!;
    expect(sale).toMatchObject({ folio: 4, time: '10:10', received: 50_000, total: 48_000, status: 'pagada' });
    expect(s.stock.refresco).toBe(before.stock.refresco - 2);
    expect(s.cart).toEqual([]);
    expect(s.receipt).toEqual({ folio: 4, fresh: true });
    expect(today(s)).toEqual({ count: 4, total: today(before).total + 48_000 });
  });

  it('refuses an empty ticket', () => {
    expect(checkout(start()).ok).toBe(false);
  });

  it('suggests the exact amount and the next round bills', () => {
    expect(cashSuggestions(78_000)).toEqual([78_000, 80_000, 100_000, 200_000]);
  });
});

describe('cancelling', () => {
  it('returns the products and drops the income', () => {
    const s = start();
    const cancelled = run(s, { type: 'cancelSale', folio: 1 });
    expect(findSale(cancelled, 1)?.status).toBe('anulada');
    expect(cancelled.stock.refresco).toBe(s.stock.refresco + 2);
    expect(today(cancelled).count).toBe(2);
    // Cancelling twice does nothing the second time.
    expect(run(cancelled, { type: 'cancelSale', folio: 1 }).stock).toEqual(cancelled.stock);
  });
});

describe('the cash closing', () => {
  it('expects the float plus the cash sales of the shift', () => {
    const s = start('cierre');
    // Sales 1, 3, 5, 6 and 7 were cash.
    expect(cashPeriod(s)).toEqual({ count: 5, total: 78_000 + 158_000 + 219_000 + 115_000 + 220_000 });
    expect(expected(s)).toBe(OPENING_FLOAT + 790_000);
  });

  it('counts bills and reports the difference', () => {
    // $9,900 expected: 5000 + 4 × 1000 + 500 + 2 × 200.
    const s = run(
      start('cierre'),
      { type: 'count', denomination: 5000, text: '1' },
      { type: 'count', denomination: 1000, text: '4' },
      { type: 'count', denomination: 500, text: '1' },
      { type: 'count', denomination: 200, text: '2' },
    );
    expect(bills(s)).toBe(8);
    expect(counted(s)).toBe(990_000);
    const result = closeRegister(s);
    expect(result.ok && result.value).toMatchObject({ number: 1, expected: 990_000, difference: 0 });
    expect(cashStatus(0)).toBe('exacto');
    expect(cashStatus(-100)).toBe('faltante');
    expect(cashStatus(100)).toBe('sobrante');
  });

  it('keeps only digits in a bill count', () => {
    const s = run(start('cierre'), { type: 'count', denomination: 100, text: '1a2.5' });
    expect(s.counts[100]).toBe('125');
  });

  it('refuses a float that is not an amount', () => {
    const result = closeRegister(run(start('cierre'), { type: 'float', text: 'abc' }));
    expect(result.ok).toBe(false);
  });

  it('starts the next shift from zero cash sales', () => {
    const s = start('cierre');
    const result = closeRegister(s);
    if (!result.ok) throw new Error('closing refused');
    const closed = run(s, { type: 'closeDone', closing: result.value }, { type: 'newShift' });
    expect(cashPeriod(closed)).toEqual({ count: 0, total: 0 });
    expect(closed.closings).toBe(1);
  });

  it('offers the product’s CUP bills', () => {
    expect(DENOMINATIONS[0]).toBe(5);
    expect(DENOMINATIONS.at(-1)).toBe(20000);
  });
});

describe('formatting', () => {
  it('writes pesos the way the product shows them', () => {
    expect(cup(7_845_000)).toBe('$78,450');
    expect(cup(130_050)).toBe('$1,300.50');
  });

  it('abbreviates tile names like the product', () => {
    expect(tileName('Refresco de cola 355 ml')).toBe('Ref de col 355 ml');
  });
});
