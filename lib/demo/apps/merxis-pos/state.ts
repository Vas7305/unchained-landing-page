import { fail, ok, type DemoResult } from '@/lib/demo/service';
import { money } from '@/lib/demo/format';
import {
  CASH_STEPS,
  DAY_WAGE,
  DELIVERIES,
  DENOMINATIONS,
  FIRST_SHIFT,
  OPENING_FLOAT,
  findProduct,
  products,
  salesFor,
  store,
  viewFor,
  type DemoProduct,
  type Method,
  type Sale,
  type Unit,
} from './data';
import {
  buildIpv,
  ipvTotals,
  parseCount,
  type ClosedShift,
  type Deductions,
  type IpvLine,
  type IpvTotals,
  type Shift,
} from './ipv';

/**
 * Merxis POS — the till, the day's sales and the cash closing.
 *
 * ─── The rules that make this a point of sale ─────────────────────────────
 * Every one of them is the product's own (src/routes/vender.tsx and
 * src/components/pos-cart.tsx in the Merxis repository):
 *
 *   · a ticket never holds more than is on the shelf — the tile, the stepper
 *     and the charge all check, because stock can change between them;
 *   · a product sold by the kilo is weighed, not tapped;
 *   · a scanned code goes on the ticket once — scanning it again is a
 *     mistake to report, not a second item to charge;
 *   · cash short of the total is refused before the sale is recorded;
 *   · cancelling a sale puts its products back on the shelf;
 *   · the closing compares the counted bills with what the drawer should hold:
 *     the opening float plus the cash sales since the last closing;
 *   · the IPV is built from the books, not typed: the shift's sales are its
 *     SALIDA, and closing it freezes the sheet with the stock as counted.
 */

export type View = 'caja' | 'ventas' | 'cierre' | 'ipv';

/** "Pagos del turno", as typed. */
export type DeductionKey = keyof Deductions;

export interface CartLine {
  productId: string;
  qty: number;
}

export interface Notice {
  tone: 'error' | 'info';
  text: string;
}

export interface Closing {
  number: number;
  float: number;
  cashSales: number;
  cashCount: number;
  expected: number;
  counted: number;
  difference: number;
  bills: number;
}

export interface State {
  scenarioId: string;
  view: View;
  /** Product id → units on the shelf. Sales take from it; cancellations return to it. */
  stock: Record<string, number>;
  cart: CartLine[];
  query: string;
  group: string | null;
  method: Method;
  /** What the cashier typed under "Recibido", in pesos. */
  received: string;
  sales: Sale[];
  /** The product sold by the kilo being weighed, or null. */
  weighing: string | null;
  receipt: { folio: number; fresh: boolean } | null;
  confirmCancel: number | null;
  charging: boolean;
  notice: Notice | null;
  /** Closing inputs, as typed. */
  float: string;
  counts: Record<number, string>;
  closing: Closing | null;
  closingPending: boolean;
  /** Sales up to this folio belong to an earlier closing. */
  closedThrough: number;
  closings: number;
  /** The open shift, or null between closing one and opening the next. */
  shift: Shift | null;
  /** The last shift closed, shown frozen until the next one opens. */
  closedShift: ClosedShift | null;
  /** IPV counts per product, as typed. */
  ipvCounts: Record<string, string>;
  deductions: Record<DeductionKey, string>;
  reviewingShift: boolean;
  shiftPending: boolean;
}

/**
 * The morning shift as the day began: its INICIO is today's stock with the
 * day's sales put back and the delivery taken out, so its FINAL is the shelf
 * the demo opens with.
 */
function firstShift(sales: readonly Sale[]): Shift {
  const sold = new Map<string, number>();
  for (const sale of sales) {
    if (sale.status !== 'pagada') continue;
    for (const item of sale.items) {
      sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.qty);
    }
  }
  const inicio: Record<string, number> = {};
  for (const product of products) {
    inicio[product.id] = round3(
      product.stock + (sold.get(product.id) ?? 0) - (DELIVERIES[product.id] ?? 0),
    );
  }
  return { ...FIRST_SHIFT, afterFolio: 0, inicio, entradas: { ...DELIVERIES } };
}

function freshDeductions(): Record<DeductionKey, string> {
  return { sueldo: String(DAY_WAGE / 100), cuentaCasa: '', limpieza: '', extracciones: '' };
}

export function createInitialState(scenarioId: string): State {
  const sales = salesFor(scenarioId);
  return {
    scenarioId,
    view: viewFor(scenarioId),
    // Copied, not referenced: a sale reduces this, and a reset must hand back
    // the untouched fixture.
    stock: Object.fromEntries(products.map((x) => [x.id, x.stock])),
    cart: [],
    query: '',
    group: null,
    method: 'efectivo',
    received: '',
    sales,
    weighing: null,
    receipt: null,
    confirmCancel: null,
    charging: false,
    notice: null,
    float: String(OPENING_FLOAT / 100),
    counts: {},
    closing: null,
    closingPending: false,
    closedThrough: 0,
    closings: 0,
    shift: firstShift(sales),
    closedShift: null,
    ipvCounts: {},
    deductions: freshDeductions(),
    reviewingShift: false,
    shiftPending: false,
  };
}

export type Action =
  | { type: 'view'; view: View }
  | { type: 'query'; query: string }
  | { type: 'group'; group: string | null }
  | { type: 'add'; productId: string; qty: number }
  | { type: 'setQty'; productId: string; qty: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | { type: 'method'; method: Method }
  | { type: 'received'; text: string }
  | { type: 'weigh'; productId: string | null }
  | { type: 'scan' }
  | { type: 'chargeStart' }
  | { type: 'chargeFailed'; message: string }
  | { type: 'chargeDone'; sale: Sale }
  | { type: 'openReceipt'; folio: number }
  | { type: 'closeReceipt' }
  | { type: 'askCancel'; folio: number | null }
  | { type: 'cancelSale'; folio: number }
  | { type: 'float'; text: string }
  | { type: 'count'; denomination: number; text: string }
  | { type: 'closeStart' }
  | { type: 'closeFailed'; message: string }
  | { type: 'closeDone'; closing: Closing }
  | { type: 'newShift' }
  | { type: 'ipvCount'; productId: string; text: string }
  | { type: 'deduction'; key: DeductionKey; text: string }
  | { type: 'reviewShift'; open: boolean }
  | { type: 'shiftStart' }
  | { type: 'shiftFailed'; message: string }
  | { type: 'shiftClosed'; closed: ClosedShift }
  | { type: 'openShift' }
  | { type: 'dismiss' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'view':
      return { ...state, view: action.view, notice: null };

    case 'query':
      return { ...state, query: action.query };

    case 'group':
      return { ...state, group: action.group };

    case 'add': {
      const product = findProduct(action.productId);
      if (!product) return state;
      const held = qtyInCart(state, product.id);
      const refusal = overStock(state, product, held + action.qty);
      if (refusal) return { ...state, notice: { tone: 'error', text: refusal } };

      const cart = held
        ? state.cart.map((l) =>
            l.productId === product.id ? { ...l, qty: round3(l.qty + action.qty) } : l,
          )
        : [...state.cart, { productId: product.id, qty: action.qty }];
      return { ...state, cart, weighing: null, notice: null };
    }

    case 'setQty': {
      const product = findProduct(action.productId);
      if (!product) return state;
      if (action.qty <= 0) return reducer(state, { type: 'remove', productId: product.id });
      const refusal = overStock(state, product, action.qty);
      if (refusal) return { ...state, notice: { tone: 'error', text: refusal } };
      return {
        ...state,
        cart: state.cart.map((l) =>
          l.productId === product.id ? { ...l, qty: round3(action.qty) } : l,
        ),
        notice: null,
      };
    }

    case 'remove':
      return {
        ...state,
        cart: state.cart.filter((l) => l.productId !== action.productId),
        notice: null,
      };

    case 'clear':
      return { ...state, cart: [], received: '', method: 'efectivo', notice: null };

    case 'method':
      return { ...state, method: action.method, notice: null };

    case 'received':
      return { ...state, received: action.text, notice: null };

    case 'weigh': {
      if (action.productId === null) return { ...state, weighing: null };
      const product = findProduct(action.productId);
      if (!product) return state;
      if ((state.stock[product.id] ?? 0) <= 0) {
        return { ...state, notice: { tone: 'error', text: `${product.name} está agotado` } };
      }
      return { ...state, weighing: product.id, notice: null };
    }

    case 'scan':
      return scan(state);

    case 'chargeStart':
      return { ...state, charging: true, notice: null };

    case 'chargeFailed':
      return { ...state, charging: false, notice: { tone: 'error', text: action.message } };

    case 'chargeDone': {
      const stock = { ...state.stock };
      for (const item of action.sale.items) {
        stock[item.productId] = round3((stock[item.productId] ?? 0) - item.qty);
      }
      return {
        ...state,
        stock,
        sales: [...state.sales, action.sale],
        cart: [],
        received: '',
        method: 'efectivo',
        charging: false,
        receipt: { folio: action.sale.folio, fresh: true },
      };
    }

    case 'openReceipt':
      return { ...state, receipt: { folio: action.folio, fresh: false } };

    case 'closeReceipt':
      return { ...state, receipt: null, confirmCancel: null };

    case 'askCancel':
      return { ...state, confirmCancel: action.folio };

    case 'cancelSale': {
      const target = state.sales.find((s) => s.folio === action.folio);
      if (!target || target.status !== 'pagada') return { ...state, confirmCancel: null };
      // The products go back on the shelf and the income leaves the day.
      const stock = { ...state.stock };
      for (const item of target.items) {
        stock[item.productId] = round3((stock[item.productId] ?? 0) + item.qty);
      }
      return {
        ...state,
        stock,
        sales: state.sales.map((s) =>
          s.folio === action.folio ? { ...s, status: 'anulada' } : s,
        ),
        confirmCancel: null,
        notice: { tone: 'info', text: `Venta ${folioLabel(action.folio)} anulada` },
      };
    }

    case 'float':
      return { ...state, float: action.text, notice: null };

    case 'count':
      // Bills are whole: anything but digits is dropped as it is typed.
      return {
        ...state,
        counts: { ...state.counts, [action.denomination]: action.text.replace(/\D/g, '').slice(0, 5) },
      };

    case 'closeStart':
      return { ...state, closingPending: true, notice: null };

    case 'closeFailed':
      return { ...state, closingPending: false, notice: { tone: 'error', text: action.message } };

    case 'closeDone':
      return {
        ...state,
        closingPending: false,
        closing: action.closing,
        closings: action.closing.number,
        closedThrough: lastFolio(state),
        counts: {},
      };

    case 'newShift':
      // The next shift starts with the float the last one closed with.
      return { ...state, closing: null, counts: {} };

    case 'ipvCount':
      return {
        ...state,
        ipvCounts: { ...state.ipvCounts, [action.productId]: action.text.slice(0, 8) },
      };

    case 'deduction':
      return {
        ...state,
        deductions: { ...state.deductions, [action.key]: action.text.slice(0, 10) },
        notice: null,
      };

    case 'reviewShift':
      return { ...state, reviewingShift: action.open, notice: null };

    case 'shiftStart':
      return { ...state, shiftPending: true, notice: null };

    case 'shiftFailed':
      return {
        ...state,
        shiftPending: false,
        reviewingShift: false,
        notice: { tone: 'error', text: action.message },
      };

    case 'shiftClosed':
      return {
        ...state,
        shiftPending: false,
        reviewingShift: false,
        shift: null,
        closedShift: action.closed,
        ipvCounts: {},
        deductions: freshDeductions(),
      };

    case 'openShift': {
      // The next shift starts from the shelf as it stands: one shift's FINAL
      // is the next one's INICIO.
      const last = state.closedShift;
      return {
        ...state,
        shift: {
          number: (last?.number ?? 0) + 1,
          kind: last?.kind === 'dia' ? 'noche' : 'dia',
          openedAt: nextTime(state),
          worker: store.seller,
          afterFolio: lastFolio(state),
          inicio: { ...state.stock },
          entradas: {},
        },
        closedShift: null,
      };
    }

    case 'dismiss':
      return { ...state, notice: null };

    default:
      return state;
  }
}

/* ── Scanning ──────────────────────────────────────────────────────────── */

/**
 * Enter in the search box: what a barcode scanner does after typing a code.
 * An exact code wins; otherwise a search with exactly one match is that match.
 */
function scan(state: State): State {
  const code = state.query.trim();
  if (!code) return state;

  const byCode = products.find((x) => x.sku === code);
  const shown = visibleProducts(state);
  const target = byCode ?? (shown.length === 1 ? shown[0] : undefined);

  if (!target) {
    return {
      ...state,
      notice: {
        tone: 'error',
        text: shown.length === 0 ? 'No se encontró el producto' : 'Hay varios productos, toca uno',
      },
    };
  }

  const cleared = { ...state, query: '' };
  const held = qtyInCart(state, target.id);

  // A code goes on the ticket once: a second read is a slip, not a second sale.
  if (byCode && held) {
    return {
      ...cleared,
      notice: {
        tone: 'info',
        text: `${target.name} ya está en el ticket (${formatQty(held, target.unit)}). Cambia la cantidad en el ticket.`,
      },
    };
  }

  if (isBulk(target.unit)) return reducer(cleared, { type: 'weigh', productId: target.id });
  return reducer(cleared, { type: 'add', productId: target.id, qty: 1 });
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export interface ShelfProduct extends DemoProduct {
  /** Stock as it stands now, after the session's sales and cancellations. */
  left: number;
}

export function shelf(state: State): ShelfProduct[] {
  return products.map((x) => ({ ...x, left: state.stock[x.id] ?? 0 }));
}

export function groups(): string[] {
  return [...new Set(products.map((x) => x.group))].sort((a, b) => a.localeCompare(b, 'es'));
}

export function matches(product: DemoProduct, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    product.name.toLowerCase().includes(q) ||
    product.group.toLowerCase().includes(q) ||
    product.sku.includes(q)
  );
}

/** The grid: filtered by search and group, sellable first, then by name. */
export function visibleProducts(state: State): ShelfProduct[] {
  return shelf(state)
    .filter((x) => (!state.group || x.group === state.group) && matches(x, state.query))
    .sort((a, b) => {
      const sa = a.left > 0 ? 0 : 1;
      const sb = b.left > 0 ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name, 'es');
    });
}

export type StockLevel = 'agotado' | 'bajo' | 'ok';

export function stockLevel(left: number, minStock: number): StockLevel {
  if (left <= 0) return 'agotado';
  if (left <= minStock) return 'bajo';
  return 'ok';
}

export function qtyInCart(state: State, productId: string): number {
  return state.cart.find((l) => l.productId === productId)?.qty ?? 0;
}

export interface CartRow {
  product: ShelfProduct;
  qty: number;
  subtotal: number;
}

export function cartRows(state: State): CartRow[] {
  const byId = new Map(shelf(state).map((x) => [x.id, x]));
  return state.cart.flatMap((l) => {
    const product = byId.get(l.productId);
    return product ? [{ product, qty: l.qty, subtotal: Math.round(l.qty * product.price) }] : [];
  });
}

export function cartTotal(state: State): number {
  return cartRows(state).reduce((sum, r) => sum + r.subtotal, 0);
}

/** Articles on the ticket: a weighed product counts once, whatever it weighs. */
export function pieces(state: State): number {
  return cartRows(state).reduce((sum, r) => sum + (isBulk(r.product.unit) ? 1 : r.qty), 0);
}

export function today(state: State): { count: number; total: number } {
  const paid = state.sales.filter((s) => s.status === 'pagada');
  return { count: paid.length, total: paid.reduce((sum, s) => sum + s.total, 0) };
}

/** Exact amount, then the next round bills a customer is likely to hand over. */
export function cashSuggestions(total: number): number[] {
  const rounded = new Set<number>();
  for (const pesos of CASH_STEPS) {
    const step = pesos * 100;
    const value = Math.ceil(total / step) * step;
    if (value > total) rounded.add(value);
  }
  return [total, ...[...rounded].sort((a, b) => a - b).slice(0, 3)];
}

/** Pesos as typed → centavos, or null when nothing (or nothing valid) was typed. */
export function parsePesos(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(/[^0-9,.]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Change to hand back — negative when the cash falls short. Null without cash typed. */
export function change(state: State): number | null {
  if (state.method !== 'efectivo') return null;
  const received = parsePesos(state.received);
  return received === null ? null : received - cartTotal(state);
}

/** Cash sales since the last closing — what the drawer gained this shift. */
export function cashPeriod(state: State): { count: number; total: number } {
  const cash = state.sales.filter(
    (s) => s.status === 'pagada' && s.method === 'efectivo' && s.folio > state.closedThrough,
  );
  return { count: cash.length, total: cash.reduce((sum, s) => sum + s.total, 0) };
}

export function expected(state: State): number | null {
  const float = parsePesos(state.float.trim() === '' ? '0' : state.float);
  return float === null ? null : float + cashPeriod(state).total;
}

export interface CountLine {
  denomination: number;
  quantity: number;
  subtotal: number;
}

export function countLines(state: State): CountLine[] {
  return DENOMINATIONS.map((denomination) => {
    const quantity = Number(state.counts[denomination] || 0);
    return { denomination, quantity, subtotal: denomination * 100 * quantity };
  });
}

export function counted(state: State): number {
  return countLines(state).reduce((sum, l) => sum + l.subtotal, 0);
}

export function bills(state: State): number {
  return countLines(state).reduce((sum, l) => sum + l.quantity, 0);
}

export type CashStatus = 'exacto' | 'faltante' | 'sobrante';

export function cashStatus(difference: number): CashStatus {
  return difference === 0 ? 'exacto' : difference < 0 ? 'faltante' : 'sobrante';
}

export function findSale(state: State, folio: number): Sale | undefined {
  return state.sales.find((s) => s.folio === folio);
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

/** "Cobrar": the sale the till would record, or why it refuses to. */
export function checkout(state: State): DemoResult<Sale> {
  const rows = cartRows(state);
  if (rows.length === 0) return fail('empty', 'El ticket está vacío.');

  // Checked again at the moment of charging, not only when the tile was tapped.
  for (const { qty, product } of rows) {
    const { left, name, unit } = product;
    if (qty > left + 1e-9) {
      return fail(
        'stock',
        left <= 0
          ? `${name} está agotado`
          : `Solo hay ${formatQty(left, unit)} de ${name}`,
      );
    }
  }

  const total = rows.reduce((sum, r) => sum + r.subtotal, 0);
  let received: number | null = null;

  if (state.method === 'efectivo' && state.received.trim() !== '') {
    received = parsePesos(state.received);
    if (received === null) return fail('received', 'Escribe un monto válido.');
    if (received < total) return fail('short', `Faltan ${cup(total - received)}`);
  }

  return ok({
    folio: lastFolio(state) + 1,
    time: nextTime(state),
    method: state.method,
    received,
    items: rows.map((r) => ({
      productId: r.product.id,
      name: r.product.name,
      unit: r.product.unit,
      qty: r.qty,
      price: r.product.price,
    })),
    total,
    seller: store.seller,
    status: 'pagada',
  });
}

/** "Cerrar caja": the closing the product would save, or why it refuses to. */
export function closeRegister(state: State): DemoResult<Closing> {
  const float = parsePesos(state.float.trim() === '' ? '0' : state.float);
  if (float === null) return fail('float', 'Escribe un fondo inicial de 0 o más.', 'float');

  const cash = cashPeriod(state);
  const total = counted(state);
  const owed = float + cash.total;

  return ok({
    number: state.closings + 1,
    float,
    cashSales: cash.total,
    cashCount: cash.count,
    expected: owed,
    counted: total,
    difference: total - owed,
    bills: bills(state),
  });
}

/* ── IPV ───────────────────────────────────────────────────────────────── */

/** The shift's payments in centavos, and the fields typed as something else. */
export function deductionsOf(state: State): { values: Deductions; bad: DeductionKey[] } {
  const values: Deductions = { sueldo: 0, cuentaCasa: 0, limpieza: 0, extracciones: 0 };
  const bad: DeductionKey[] = [];
  for (const key of Object.keys(values) as DeductionKey[]) {
    const raw = state.deductions[key].trim();
    if (raw === '') continue;
    const n = parsePesos(raw);
    if (n === null) bad.push(key);
    else values[key] = n;
  }
  return { values, bad };
}

/** The open shift's sheet as it stands now, or null with no shift open. */
export function liveIpv(state: State): { lines: IpvLine[]; totals: IpvTotals } | null {
  if (!state.shift) return null;
  const lines = buildIpv(state.shift, state.sales, state.ipvCounts);
  return {
    lines,
    totals: ipvTotals(state.shift, state.sales, lines, deductionsOf(state).values),
  };
}

/** Counts typed as something other than a number of 0 or more. */
export function badCounts(state: State): number {
  return Object.values(state.ipvCounts).filter((raw) => parseCount(raw) === null).length;
}

/** "Cerrar turno": the sheet frozen as it is now, or why it cannot close. */
export function closeShift(state: State): DemoResult<ClosedShift> {
  const shift = state.shift;
  if (!shift) return fail('closed', 'No hay un turno abierto.');
  if (badCounts(state) > 0) {
    return fail('count', 'Revisa los conteos marcados: solo números de 0 o más.');
  }
  const { values, bad } = deductionsOf(state);
  if (bad.length > 0) {
    return fail('deduction', 'Revisa los pagos del turno: solo montos de 0 o más.');
  }

  const lines = buildIpv(shift, state.sales, state.ipvCounts);
  return ok({
    ...shift,
    closedAt: nextTime(state),
    lines,
    totals: ipvTotals(shift, state.sales, lines, values),
    deductions: values,
  });
}

/* ── Formatting ────────────────────────────────────────────────────────── */

export function isBulk(unit: Unit): boolean {
  return unit === 'kg';
}

/**
 * Pesos cubanos as the product shows them: "$78,450", decimals only when
 * there are centavos. Pinned to en-US output rather than es-CU so the string
 * is identical in every browser — the product's es-CU format renders the same
 * characters, but ICU builds disagree about it (see lib/demo/format.ts).
 */
export function cup(cents: number): string {
  return money(cents, 'USD', 'en-US', { decimals: cents % 100 === 0 ? 0 : 2 });
}

export function formatQty(qty: number, unit: Unit): string {
  const n = new Intl.NumberFormat('es', {
    maximumFractionDigits: isBulk(unit) ? 3 : 2,
  }).format(qty);
  return `${n} ${unit}`;
}

/** "#0004" — the product's folio, without a cloud series. */
export function folioLabel(folio: number): string {
  return `#${String(folio).padStart(4, '0')}`;
}

/**
 * "Refresco de cola 355 ml" → "Ref de col 355 ml": the first three letters of
 * each word, so the name fits the tile at a large size. The product's own rule.
 */
export function tileName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => (/\d/.test(word) ? word : Array.from(word).slice(0, 3).join('')))
    .join(' ');
}

function lastFolio(state: State): number {
  return state.sales.reduce((max, s) => Math.max(max, s.folio), 0);
}

/** The next sale is rung up seven minutes after the last: no clock is read. */
function nextTime(state: State): string {
  const last = state.sales.at(-1)?.time ?? '08:23';
  const [h, m] = last.split(':').map(Number);
  const minutes = Math.min(h * 60 + m + 7, 23 * 60 + 59);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function overStock(state: State, product: DemoProduct, qty: number): string | null {
  const left = state.stock[product.id] ?? 0;
  if (qty <= left + 1e-9) return null;
  return left <= 0
    ? `${product.name} está agotado`
    : `Solo hay ${formatQty(left, product.unit)} de ${product.name}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
