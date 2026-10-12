/**
 * Merxis POS demo fixtures.
 *
 * ─── Where these come from ────────────────────────────────────────────────
 * The product ships its own sample store (Ajustes → Datos → "Restaurar tienda
 * de ejemplo", src/lib/seed.ts in the Merxis repository): a corner shop with a
 * catalogue grouped by aisle, sold by the piece, by the pack and by the kilo,
 * with a minimum-stock level per product. This is that catalogue's shape —
 * the same units, groups and stock rules — set in a fictional Cuban mini-market
 * and priced in Cuban pesos.
 *
 * ─── Why pesos cubanos, when the sample store is Mexican ──────────────────
 * The cash closing. In Merxis the closing is a count of bills, and the bill
 * count exists for one currency: CUP (src/lib/cash-count.ts). A demo priced in
 * MXN would have to show the closing tab as "not available", which is what
 * the product does and is not worth demonstrating. The denominations below
 * are the product's own CUP list.
 *
 * ─── What is invented ─────────────────────────────────────────────────────
 * The store, the cashier, the prices and the day's sales. No real business's
 * data appears here. Barcodes use the GS1 "20" prefix, reserved for in-store
 * codes, so none of them can belong to a real product.
 *
 * Money in centavos throughout: products sold by the kilo produce fractional
 * amounts, and summing floats is how a till ends up a centavo out.
 */

export type Unit = 'pz' | 'paq' | 'kg';

/** Product tile colours, from the product's own palette (src/lib/product-colors.ts). */
export const TILE_PASTEL = {
  naranja: '#fed7aa',
  ambar: '#fde68a',
  lima: '#d9f99d',
  verde: '#bbf7d0',
  turquesa: '#99f6e4',
  cielo: '#bae6fd',
  azul: '#bfdbfe',
  indigo: '#c7d2fe',
  violeta: '#ddd6fe',
  rosa: '#fbcfe8',
  carmin: '#fecdd3',
} as const;

export type TileColor = keyof typeof TILE_PASTEL;

export interface DemoProduct {
  id: string;
  name: string;
  /** Barcode. Typed into the search box and confirmed with Enter, as a scanner does. */
  sku: string;
  group: string;
  unit: Unit;
  /** Price per unit, in centavos. */
  price: number;
  /** Cost per unit, in centavos. The IPV's COSTO column and its UTILIDAD. */
  cost: number;
  /** Stock at the start of the demo, in the product's unit. */
  stock: number;
  /** At or below this, the tile flags low stock. */
  minStock: number;
  color: TileColor;
}

export const store = {
  name: 'Mercadito La Esquina',
  caja: 'Caja 1',
  seller: 'Yanet',
} as const;

const p = (
  id: string,
  name: string,
  sku: string,
  group: string,
  unit: Unit,
  pesos: number,
  costPesos: number,
  stock: number,
  minStock: number,
  color: TileColor,
): DemoProduct => ({
  id,
  name,
  sku,
  group,
  unit,
  price: pesos * 100,
  cost: costPesos * 100,
  stock,
  minStock,
  color,
});

export const products: readonly DemoProduct[] = [
  p('refresco', 'Refresco de cola 355 ml', '2000000000017', 'Bebidas', 'pz', 240, 180, 48, 24, 'carmin'),
  p('agua', 'Agua natural 1.5 L', '2000000000024', 'Bebidas', 'pz', 220, 150, 30, 12, 'cielo'),
  p('cerveza', 'Cerveza clara 355 ml', '2000000000031', 'Bebidas', 'pz', 280, 210, 6, 24, 'ambar'),
  p('jugo', 'Jugo de mango 1 L', '2000000000048', 'Bebidas', 'pz', 450, 330, 14, 6, 'naranja'),
  p('malta', 'Malta 355 ml', '2000000000055', 'Bebidas', 'pz', 260, 190, 20, 8, 'violeta'),
  p('pan', 'Pan de bocadito 6 u', '2000000000062', 'Elaborados', 'paq', 300, 200, 9, 6, 'ambar'),
  p('croquetas', 'Croquetas de pollo 10 u', '2000000000079', 'Elaborados', 'paq', 650, 450, 3, 5, 'naranja'),
  p('pizza', 'Pizza familiar', '2000000000086', 'Elaborados', 'pz', 1800, 1100, 4, 2, 'rosa'),
  p('guayaba', 'Dulce de guayaba 500 g', '2000000000093', 'Elaborados', 'pz', 600, 420, 12, 4, 'carmin'),
  p('arroz', 'Arroz', '2000000000109', 'Granos', 'kg', 420, 330, 25, 10, 'lima'),
  p('frijol', 'Frijol negro', '2000000000116', 'Granos', 'kg', 550, 430, 12.5, 5, 'indigo'),
  p('azucar', 'Azúcar', '2000000000123', 'Granos', 'kg', 380, 290, 18, 6, 'azul'),
  p('aceite', 'Aceite vegetal 1 L', '2000000000130', 'Despensa', 'pz', 950, 760, 11, 6, 'ambar'),
  p('queso', 'Queso gouda', '2000000000147', 'Despensa', 'kg', 2600, 2000, 2.4, 1, 'naranja'),
  p('huevos', 'Huevos 30 u', '2000000000154', 'Despensa', 'paq', 3100, 2600, 0, 2, 'lima'),
  p('cafe', 'Café molido 250 g', '2000000000161', 'Despensa', 'pz', 1200, 900, 7, 4, 'turquesa'),
  p('jabon', 'Jabón de baño', '2000000000178', 'Aseo', 'pz', 250, 170, 15, 6, 'verde'),
  p('detergente', 'Detergente en polvo 1 kg', '2000000000185', 'Aseo', 'pz', 900, 700, 4, 6, 'cielo'),
  p('papel', 'Papel higiénico 4 rollos', '2000000000192', 'Aseo', 'paq', 520, 380, 12, 6, 'indigo'),
  p('desodorante', 'Desodorante roll-on', '2000000000208', 'Aseo', 'pz', 650, 470, 10, 4, 'violeta'),
];

export type Method = 'efectivo' | 'tarjeta' | 'transferencia';

export const METHOD_LABEL: Record<Method, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export interface SaleItem {
  productId: string;
  name: string;
  unit: Unit;
  qty: number;
  /** Unit price at the moment of sale, in centavos. */
  price: number;
}

export interface Sale {
  folio: number;
  /** "HH:MM". Fixed, never read from a clock, so the demo shows the same day forever. */
  time: string;
  method: Method;
  /** Cash handed over, in centavos; null for card and transfer. */
  received: number | null;
  items: SaleItem[];
  total: number;
  seller: string;
  status: 'pagada' | 'anulada';
}

function sale(
  folio: number,
  time: string,
  method: Method,
  received: number | null,
  lines: [id: string, qty: number][],
): Sale {
  const items = lines.map(([productId, qty]) => {
    const product = products.find((x) => x.id === productId)!;
    return { productId, name: product.name, unit: product.unit, qty, price: product.price };
  });
  const total = items.reduce((sum, i) => sum + Math.round(i.qty * i.price), 0);
  return {
    folio,
    time,
    method,
    received: received === null ? null : received * 100,
    items,
    total,
    seller: store.seller,
    status: 'pagada',
  };
}

/** Today's sales before the visitor arrives, in the order they were rung up. */
const daySales: readonly Sale[] = [
  sale(1, '08:42', 'efectivo', 1000, [['pan', 1], ['refresco', 2]]),
  sale(2, '09:15', 'transferencia', null, [['arroz', 2], ['frijol', 1], ['aceite', 1]]),
  sale(3, '10:03', 'efectivo', 2000, [['cafe', 1], ['azucar', 1]]),
  sale(4, '11:27', 'transferencia', null, [['pizza', 1], ['malta', 4]]),
  sale(5, '12:10', 'efectivo', 5000, [['croquetas', 2], ['jugo', 1], ['agua', 2]]),
  sale(6, '13:48', 'efectivo', 2000, [['jabon', 2], ['desodorante', 1]]),
  sale(7, '15:05', 'efectivo', 3000, [['queso', 0.5], ['guayaba', 1], ['pan', 1]]),
];

/**
 * Two moments in the same day.
 *
 * `turno` is mid-morning with three sales rung up and an empty ticket. `cierre`
 * is the end of the afternoon: seven sales, and the demo opens on the cash
 * closing, which is the workflow that only makes sense once a day has happened.
 */
export const scenarios: Record<string, { sales: number; view: 'caja' | 'cierre' }> = {
  turno: { sales: 3, view: 'caja' },
  cierre: { sales: 7, view: 'cierre' },
};

export function salesFor(scenarioId: string): Sale[] {
  const scenario = scenarios[scenarioId] ?? scenarios.turno;
  return daySales.slice(0, scenario.sales).map((s) => ({ ...s, items: [...s.items] }));
}

export function viewFor(scenarioId: string): 'caja' | 'cierre' {
  return (scenarios[scenarioId] ?? scenarios.turno).view;
}

/**
 * The morning delivery, received during the first shift: what the IPV shows
 * under ENTRADA. Units per product.
 */
export const DELIVERIES: Readonly<Record<string, number>> = {
  refresco: 24,
  pan: 6,
  agua: 12,
};

/** The first shift of the day, as the IPV opens it. */
export const FIRST_SHIFT = {
  number: 1,
  kind: 'dia',
  openedAt: '08:00',
  worker: store.seller,
} as const;

/**
 * The cashier's day wage, which the product brings into "Pagos del turno"
 * from Gastos → Sueldos. In centavos.
 */
export const DAY_WAGE = 1500 * 100;

/** The change the drawer held when the shift opened, in centavos. */
export const OPENING_FLOAT = 2000 * 100;

/** The CUP bills the product counts at closing, smallest first, in pesos. */
export const DENOMINATIONS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000] as const;

/** The bills a customer is likely to hand over, for the "Recibido" shortcuts. */
export const CASH_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

export function findProduct(id: string): DemoProduct | undefined {
  return products.find((x) => x.id === id);
}
