import { products, type Sale, type Unit } from './data';

/**
 * IPV por turno — the shop's per-shift sheet of stock and sales, product by
 * product, as Merxis builds it (src/lib/ipv.ts in the Merxis repository).
 *
 * ─── The sheet ────────────────────────────────────────────────────────────
 * One row per product with stock or activity in the shift:
 *
 *   INICIO   stock when the shift opened
 *   ENTRADA  received during the shift
 *   SALIDA   sold during the shift — a sale cancelled in the shift counts not
 *   FINAL    INICIO + ENTRADA − SALIDA: what should be on the shelf
 *   CONTEO   what the worker counted at close, and DIF. = CONTEO − FINAL
 *   IMPORTE  SALIDA × PRECIO        UTILIDAD  SALIDA × (PRECIO − COSTO)
 *
 * The footer is the product's: DINERO EN CAJA is the importe less what came
 * by transferencia and the cash taken out (extracciones); GANANCIA NETA is the
 * utilidad less every payment of the shift — the extracciones only move cash,
 * so they are not one.
 *
 * Money in centavos, quantities rounded to the gram, as the product rounds.
 */

export type ShiftKind = 'dia' | 'noche';

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  dia: 'Día',
  noche: 'Noche',
};

export interface Shift {
  number: number;
  kind: ShiftKind;
  /** "HH:MM", from the fixtures or the demo's own clock — never a real one. */
  openedAt: string;
  worker: string;
  /** Sales with a folio above this belong to the shift. */
  afterFolio: number;
  /** Stock per product when the shift opened. */
  inicio: Record<string, number>;
  /** Received during the shift, per product. */
  entradas: Record<string, number>;
}

export interface IpvLine {
  productId: string;
  name: string;
  unit: Unit;
  inicio: number;
  costo: number;
  precio: number;
  entrada: number;
  salida: number;
  final: number;
  utilidad: number;
  importe: number;
  conteo?: number;
  diferencia?: number;
}

/** What the shift paid, in centavos. */
export interface Deductions {
  sueldo: number;
  cuentaCasa: number;
  limpieza: number;
  /** Cash taken out of the drawer: not an expense, so not a payment. */
  extracciones: number;
}

export interface IpvTotals {
  /** Units sold. */
  salida: number;
  importe: number;
  utilidad: number;
  transferencias: number;
  extracciones: number;
  /** Value at sale price of stock counted short (positive) or over (negative). */
  faltante: number;
  dineroEnCaja: number;
  pagos: number;
  gananciaNeta: number;
}

export interface ClosedShift extends Shift {
  closedAt: string;
  lines: IpvLine[];
  totals: IpvTotals;
  deductions: Deductions;
}

const qty = (n: number) => Math.round(n * 1000) / 1000 + 0;

/** Sales that belong to the shift and still stand. */
function shiftSales(shift: Shift, sales: readonly Sale[]): Sale[] {
  return sales.filter((s) => s.folio > shift.afterFolio && s.status === 'pagada');
}

/**
 * A count as typed: undefined when blank (not counted), null when it is not a
 * number of 0 or more — the product refuses to close a shift with one of those.
 */
export function parseCount(raw: string | undefined): number | undefined | null {
  const text = (raw ?? '').trim();
  if (text === '') return undefined;
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  return Number(text.replace(',', '.'));
}

export function buildIpv(
  shift: Shift,
  sales: readonly Sale[],
  counts: Readonly<Record<string, string>> = {},
): IpvLine[] {
  const sold = new Map<string, number>();
  for (const sale of shiftSales(shift, sales)) {
    for (const item of sale.items) {
      sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.qty);
    }
  }

  const lines: IpvLine[] = [];
  for (const product of products) {
    const inicio = qty(shift.inicio[product.id] ?? 0);
    const entrada = qty(shift.entradas[product.id] ?? 0);
    const salida = qty(sold.get(product.id) ?? 0);
    const counted = parseCount(counts[product.id]);
    // The product's rule: a row only for stock or activity in the shift.
    if (inicio === 0 && entrada === 0 && salida === 0 && typeof counted !== 'number') continue;

    const final = qty(inicio + entrada - salida);
    lines.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      inicio,
      costo: product.cost,
      precio: product.price,
      entrada,
      salida,
      final,
      utilidad: Math.round(salida * (product.price - product.cost)),
      importe: Math.round(salida * product.price),
      ...(typeof counted === 'number'
        ? { conteo: qty(counted), diferencia: qty(counted - final) }
        : {}),
    });
  }
  return lines;
}

export function ipvTotals(
  shift: Shift,
  sales: readonly Sale[],
  lines: readonly IpvLine[],
  deductions: Deductions,
): IpvTotals {
  let salida = 0;
  let importe = 0;
  let utilidad = 0;
  let faltante = 0;
  for (const line of lines) {
    salida += line.salida;
    importe += line.importe;
    utilidad += line.utilidad;
    if (line.diferencia !== undefined) faltante += Math.round(-line.diferencia * line.precio);
  }

  const transferencias = shiftSales(shift, sales)
    .filter((s) => s.method === 'transferencia')
    .reduce((sum, s) => sum + s.total, 0);
  const pagos = deductions.sueldo + deductions.cuentaCasa + deductions.limpieza;

  return {
    salida: qty(salida),
    importe,
    utilidad,
    transferencias,
    extracciones: deductions.extracciones,
    faltante: faltante + 0,
    dineroEnCaja: importe - transferencias - deductions.extracciones,
    pagos,
    gananciaNeta: utilidad - pagos,
  };
}

/** "#0001", the product's shift label without a cloud series. */
export function shiftLabel(number: number): string {
  return `#${String(number).padStart(4, '0')}`;
}
