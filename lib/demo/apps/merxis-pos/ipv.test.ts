import { describe, expect, it } from 'vitest';
import { parseCount, shiftLabel } from './ipv';
import {
  checkout,
  closeShift,
  createInitialState,
  liveIpv,
  reducer,
  type Action,
  type State,
} from './state';

/**
 * The IPV's arithmetic, against numbers worked out by hand from the
 * fixtures. "turno" is three sales in: a cash one (pan, two refrescos), a
 * transferencia (arroz, frijol, aceite) and a cash one (café, azúcar).
 */

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state);
const start = () => createInitialState('turno');
const ipv = (state: State) => liveIpv(state)!;
const line = (state: State, id: string) => ipv(state).lines.find((l) => l.productId === id)!;

function sell(state: State, productId: string, qty: number): State {
  const s = reducer(state, { type: 'add', productId, qty });
  const result = checkout(s);
  if (!result.ok) throw new Error(result.failure.message);
  return run(s, { type: 'chargeDone', sale: result.value }, { type: 'closeReceipt' });
}

describe('the open shift', () => {
  it('ends every row on the shelf the demo opens with', () => {
    const s = start();
    for (const l of ipv(s).lines) expect(l.final, l.productId).toBe(s.stock[l.productId]);
  });

  it('builds a row from INICIO, ENTRADA and the shift’s sales', () => {
    expect(line(start(), 'refresco')).toMatchObject({
      inicio: 26,
      entrada: 24,
      salida: 2,
      final: 48,
      importe: 48_000,
      utilidad: 12_000,
    });
  });

  it('leaves out a product with no stock and no activity', () => {
    expect(ipv(start()).lines.some((l) => l.productId === 'huevos')).toBe(false);
  });

  it('totals the sheet the way the product does', () => {
    expect(ipv(start()).totals).toEqual({
      salida: 9,
      importe: 470_000,
      utilidad: 110_000,
      transferencias: 234_000,
      extracciones: 0,
      faltante: 0,
      // The importe less the transferencia: the cash the drawer should hold.
      dineroEnCaja: 236_000,
      // The day's wage, prefilled from Gastos.
      pagos: 150_000,
      gananciaNeta: -40_000,
    });
  });
});

describe('the sheet follows the till', () => {
  it('adds a sale to SALIDA and keeps FINAL on the shelf', () => {
    const s = sell(start(), 'jugo', 1);
    expect(line(s, 'jugo')).toMatchObject({ salida: 1, final: s.stock.jugo });
  });

  it('takes a sale cancelled in the shift out of SALIDA', () => {
    const s = run(start(), { type: 'cancelSale', folio: 1 });
    expect(line(s, 'refresco')).toMatchObject({ salida: 0, final: 50 });
  });
});

describe('counting and paying', () => {
  it('values a short count at the sale price', () => {
    const s = run(start(), { type: 'ipvCount', productId: 'refresco', text: '45' });
    expect(line(s, 'refresco')).toMatchObject({ conteo: 45, diferencia: -3 });
    expect(ipv(s).totals.faltante).toBe(72_000);
  });

  it('takes the extracciones from the cash, not from the profit', () => {
    const base = ipv(start()).totals;
    const s = run(
      start(),
      { type: 'deduction', key: 'extracciones', text: '500' },
      { type: 'deduction', key: 'cuentaCasa', text: '100' },
    );
    expect(ipv(s).totals.dineroEnCaja).toBe(base.dineroEnCaja - 50_000);
    expect(ipv(s).totals.gananciaNeta).toBe(base.gananciaNeta - 10_000);
  });

  it('refuses to close with a count or a payment that is not a number', () => {
    expect(closeShift(run(start(), { type: 'ipvCount', productId: 'agua', text: 'diez' })).ok).toBe(false);
    expect(closeShift(run(start(), { type: 'deduction', key: 'limpieza', text: 'x' })).ok).toBe(false);
  });

  it('reads counts like the product', () => {
    expect(parseCount('')).toBeUndefined();
    expect(parseCount('2,5')).toBe(2.5);
    expect(parseCount('-1')).toBeNull();
  });
});

describe('closing and the next shift', () => {
  it('freezes the sheet, then opens the night shift on the shelf as it stands', () => {
    const s = start();
    const result = closeShift(s);
    if (!result.ok) throw new Error(result.failure.message);
    expect(result.value.totals.importe).toBe(470_000);

    const closed = run(s, { type: 'shiftClosed', closed: result.value });
    expect(closed.shift).toBeNull();
    expect(closed.closedShift?.number).toBe(1);

    const night = run(closed, { type: 'openShift' });
    expect(night.shift).toMatchObject({ number: 2, kind: 'noche', afterFolio: 3 });
    expect(ipv(night).totals.importe).toBe(0);
    expect(line(night, 'refresco')).toMatchObject({ inicio: 48, salida: 0, final: 48 });

    // A sale after the night shift opened is the night shift's.
    expect(line(sell(night, 'refresco', 1), 'refresco')).toMatchObject({ salida: 1, final: 47 });
  });

  it('labels shifts like the product', () => {
    expect(shiftLabel(1)).toBe('#0001');
  });
});
