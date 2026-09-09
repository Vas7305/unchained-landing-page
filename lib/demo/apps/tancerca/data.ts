/**
 * TanCerca demo fixtures.
 *
 * ─── Everything here is invented, and coherently so ───────────────────────
 * Five neighbourhood businesses, their catalogues, the delivery zones that
 * price them and one previous order. No merchant on the real marketplace is
 * named here, no real customer, no real address and no real telephone number —
 * §7 forbids it, and a portfolio demo carrying a genuine merchant's prices
 * would also be publishing somebody's commercial data on our website.
 *
 * What the fixtures DO have to be is consistent with each other: a cart line
 * has to find its product, a product has to find its merchant, and a merchant
 * has to sit in a zone that has a delivery fee. Those relationships are what
 * make the demo behave like a marketplace instead of like a slideshow, and
 * lib/demo/apps/tancerca/state.test.ts walks them.
 *
 * Money is in centavos throughout, because a subtotal computed in floats is
 * how a real cart ends up 0.01 short.
 */

export interface DemoZone {
  id: string;
  name: string;
  /** Delivery fee in centavos. */
  fee: number;
  /** Typical delivery window, in minutes. */
  minutes: [number, number];
}

export interface DemoMerchant {
  id: string;
  name: string;
  trade: string;
  zoneId: string;
  rating: number;
  reviews: number;
  /** Category tabs inside this merchant's catalogue. */
  categories: readonly string[];
  /** Minimum order in centavos. Below it, checkout refuses. */
  minimum: number;
}

export interface DemoProduct {
  id: string;
  merchantId: string;
  name: string;
  category: string;
  /** Unit price in centavos. */
  price: number;
  unit: string;
  /** Zero means the card renders as unavailable and cannot be added. */
  stock: number;
}

export const zones: readonly DemoZone[] = [
  { id: 'centro', name: 'Centro Habana', fee: 15_000, minutes: [25, 40] },
  { id: 'vedado', name: 'Vedado', fee: 18_000, minutes: [30, 45] },
  { id: 'playa', name: 'Playa', fee: 24_000, minutes: [40, 60] },
];

export const merchants: readonly DemoMerchant[] = [
  {
    id: 'dona-mila',
    name: 'Panadería Doña Mila',
    trade: 'Panadería y repostería',
    zoneId: 'centro',
    rating: 4.8,
    reviews: 312,
    categories: ['Panes', 'Dulces', 'Café'],
    minimum: 40_000,
  },
  {
    id: 'rincon-criollo',
    name: 'El Rincón Criollo',
    trade: 'Comida criolla',
    zoneId: 'centro',
    rating: 4.6,
    reviews: 508,
    categories: ['Platos', 'Guarniciones', 'Bebidas'],
    minimum: 90_000,
  },
  {
    id: 'la-esquina',
    name: 'Mercado La Esquina',
    trade: 'Víveres y limpieza',
    zoneId: 'vedado',
    rating: 4.4,
    reviews: 197,
    categories: ['Despensa', 'Frutas', 'Limpieza'],
    minimum: 60_000,
  },
  {
    id: 'san-lazaro',
    name: 'Farmacia San Lázaro',
    trade: 'Farmacia y cuidado personal',
    zoneId: 'vedado',
    rating: 4.9,
    reviews: 143,
    categories: ['Cuidado personal', 'Botiquín'],
    minimum: 30_000,
  },
  {
    id: 'azucar',
    name: 'Dulcería Azúcar',
    trade: 'Cakes y dulcería fina',
    zoneId: 'playa',
    rating: 4.7,
    reviews: 86,
    categories: ['Cakes', 'Dulces finos'],
    minimum: 50_000,
  },
];

export const products: readonly DemoProduct[] = [
  // Panadería Doña Mila
  { id: 'pan-flauta', merchantId: 'dona-mila', name: 'Pan flauta', category: 'Panes', price: 8_000, unit: 'unidad', stock: 40 },
  { id: 'pan-suave', merchantId: 'dona-mila', name: 'Pan suave de molde', category: 'Panes', price: 22_000, unit: '500 g', stock: 12 },
  { id: 'pastelito-guayaba', merchantId: 'dona-mila', name: 'Pastelito de guayaba', category: 'Dulces', price: 12_000, unit: 'unidad', stock: 25 },
  { id: 'torticas-moron', merchantId: 'dona-mila', name: 'Torticas de Morón', category: 'Dulces', price: 18_000, unit: 'caja de 6', stock: 8 },
  { id: 'cafe-molido', merchantId: 'dona-mila', name: 'Café molido de la casa', category: 'Café', price: 45_000, unit: '250 g', stock: 6 },
  { id: 'cafe-colado', merchantId: 'dona-mila', name: 'Café colado', category: 'Café', price: 5_000, unit: 'taza', stock: 0 },

  // El Rincón Criollo
  { id: 'ropa-vieja', merchantId: 'rincon-criollo', name: 'Ropa vieja', category: 'Platos', price: 95_000, unit: 'ración', stock: 15 },
  { id: 'cerdo-asado', merchantId: 'rincon-criollo', name: 'Cerdo asado', category: 'Platos', price: 110_000, unit: 'ración', stock: 10 },
  { id: 'pollo-plancha', merchantId: 'rincon-criollo', name: 'Pollo a la plancha', category: 'Platos', price: 88_000, unit: 'ración', stock: 18 },
  { id: 'congri', merchantId: 'rincon-criollo', name: 'Congrí', category: 'Guarniciones', price: 30_000, unit: 'ración', stock: 30 },
  { id: 'tostones', merchantId: 'rincon-criollo', name: 'Tostones', category: 'Guarniciones', price: 25_000, unit: 'ración', stock: 22 },
  { id: 'refresco-natural', merchantId: 'rincon-criollo', name: 'Refresco natural', category: 'Bebidas', price: 15_000, unit: 'vaso', stock: 40 },

  // Mercado La Esquina
  { id: 'arroz', merchantId: 'la-esquina', name: 'Arroz', category: 'Despensa', price: 42_000, unit: '1 kg', stock: 50 },
  { id: 'frijol-negro', merchantId: 'la-esquina', name: 'Frijol negro', category: 'Despensa', price: 55_000, unit: '1 kg', stock: 34 },
  { id: 'aceite', merchantId: 'la-esquina', name: 'Aceite vegetal', category: 'Despensa', price: 78_000, unit: '1 L', stock: 9 },
  { id: 'platano', merchantId: 'la-esquina', name: 'Plátano burro', category: 'Frutas', price: 20_000, unit: 'libra', stock: 60 },
  { id: 'mango', merchantId: 'la-esquina', name: 'Mango', category: 'Frutas', price: 24_000, unit: 'libra', stock: 0 },
  { id: 'detergente', merchantId: 'la-esquina', name: 'Detergente líquido', category: 'Limpieza', price: 62_000, unit: '1 L', stock: 14 },

  // Farmacia San Lázaro
  { id: 'jabon', merchantId: 'san-lazaro', name: 'Jabón de tocador', category: 'Cuidado personal', price: 18_000, unit: 'unidad', stock: 45 },
  { id: 'pasta-dental', merchantId: 'san-lazaro', name: 'Pasta dental', category: 'Cuidado personal', price: 35_000, unit: '90 g', stock: 20 },
  { id: 'alcohol', merchantId: 'san-lazaro', name: 'Alcohol 70º', category: 'Botiquín', price: 28_000, unit: '250 ml', stock: 16 },
  { id: 'vendas', merchantId: 'san-lazaro', name: 'Vendas de gasa', category: 'Botiquín', price: 22_000, unit: 'paquete', stock: 11 },

  // Dulcería Azúcar
  { id: 'cake-chocolate', merchantId: 'azucar', name: 'Cake de chocolate', category: 'Cakes', price: 240_000, unit: '8 porciones', stock: 4 },
  { id: 'cake-vainilla', merchantId: 'azucar', name: 'Cake de vainilla y merengue', category: 'Cakes', price: 215_000, unit: '8 porciones', stock: 3 },
  { id: 'bocaditos', merchantId: 'azucar', name: 'Bocaditos surtidos', category: 'Dulces finos', price: 95_000, unit: 'bandeja de 20', stock: 7 },
  { id: 'flan', merchantId: 'azucar', name: 'Flan de leche', category: 'Dulces finos', price: 40_000, unit: 'unidad', stock: 10 },
];

/** The service fee the marketplace charges, as a fraction of the subtotal. */
export const SERVICE_RATE = 0.05;

/**
 * The saved profile the `habitual` scenario starts from.
 *
 * An invented customer at an invented address on a real street name, which is
 * how an address has to look to be believable without being anybody's.
 */
export const savedCustomer = {
  name: 'Yanet Robaina',
  phone: '5 234 8890',
  address: 'Calle Neptuno 458, entre Lealtad y Escobar',
  zoneId: 'centro',
  notes: 'Tocar el timbre del segundo piso.',
} as const;

/** What the returning customer ordered last time, offered as a one-tap repeat. */
export const previousOrder = {
  merchantId: 'dona-mila',
  reference: 'TC-4471',
  lines: [
    { productId: 'pan-flauta', qty: 4 },
    { productId: 'cafe-molido', qty: 1 },
    { productId: 'pastelito-guayaba', qty: 2 },
  ],
} as const;

/**
 * The card number that is always declined.
 *
 * The industry's standard test decline number, so it is unmistakably not
 * anybody's card, and it gives the demo a failure path a visitor can reach on
 * purpose and reach again (§20). Every other 16-digit number is accepted.
 */
export const DECLINED_CARD = '4000000000000002';

export function findMerchant(id: string): DemoMerchant | undefined {
  return merchants.find((m) => m.id === id);
}

export function findProduct(id: string): DemoProduct | undefined {
  return products.find((p) => p.id === id);
}

export function findZone(id: string): DemoZone | undefined {
  return zones.find((z) => z.id === id);
}

export function productsOf(merchantId: string): DemoProduct[] {
  return products.filter((p) => p.merchantId === merchantId);
}

/**
 * Peso cubano, written the way the product writes it.
 *
 * The formatter is built once, at module scope. Constructing an
 * `Intl.NumberFormat` is expensive relative to using one, and this is called
 * for every catalogue row, every cart line and every total — several dozen
 * times per render of the cart screen.
 */
const pesos = new Intl.NumberFormat('es-ES');

export function cup(centavos: number): string {
  return `${pesos.format(Math.round(centavos / 100))} CUP`;
}
