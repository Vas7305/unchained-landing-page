import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  DECLINED_CARD,
  SERVICE_RATE,
  findMerchant,
  findProduct,
  findZone,
  merchants,
  previousOrder,
  products,
  savedCustomer,
  type DemoMerchant,
  type DemoProduct,
} from './data';

/**
 * The TanCerca demo, as a state machine.
 *
 * ─── Why the logic is here and not in the components ──────────────────────
 * Two reasons, and the second is the one that made it non-negotiable.
 *
 * The first is that a marketplace is exactly the kind of demo that goes wrong
 * quietly: a cart badge computed in one component and a subtotal computed in
 * another will agree right up until a quantity reaches zero. Everything the
 * visitor can see about the cart is derived here, from one array of lines, so
 * catalogue, badge, subtotal, delivery, service fee and total cannot disagree
 * (§7).
 *
 * The second is testability. This repository's vitest runs in a Node
 * environment over `.test.ts` files and has no DOM, so a test that clicked
 * through the checkout would have required adding jsdom and a rendering
 * library to a project whose dependency list is deliberately short. Keeping
 * the workflow in a reducer means the representative journey — browse, add,
 * change quantity, check out, be declined, retry, succeed, track, reset — is
 * exercised end to end by dispatching the same actions the buttons dispatch.
 * See state.test.ts.
 *
 * ─── Nothing in this module is async ──────────────────────────────────────
 * `placeOrder` decides; the component wraps the decision in
 * lib/demo/service.ts's `simulate` to give it a pending state and a delay.
 * That split is what keeps the demo's one asynchronous edge in one file.
 */

export type Screen = 'home' | 'merchant' | 'cart' | 'checkout' | 'tracking';

export type PaymentMethod = 'card' | 'cash';

export interface CartLine {
  productId: string;
  qty: number;
}

export interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  zoneId: string;
  notes: string;
  payment: PaymentMethod;
  cardNumber: string;
}

export interface PlacedOrder {
  reference: string;
  merchantId: string;
  lines: CartLine[];
  subtotal: number;
  delivery: number;
  service: number;
  total: number;
  payment: PaymentMethod;
  address: string;
  eta: [number, number];
}

/** The four states an order passes through after it is placed. */
export const TRACKING_STEPS = [
  'Pedido confirmado',
  'El negocio está preparando tu pedido',
  'Mensajero en camino',
  'Entregado',
] as const;

export interface State {
  scenarioId: string;
  screen: Screen;
  /** Search over merchants on the home screen. */
  query: string;
  merchantId: string | null;
  /** Active category tab inside a merchant, or null for all of them. */
  category: string | null;
  cart: CartLine[];
  form: CheckoutForm;
  /** Field name → message. Populated by `validate`, cleared as fields change. */
  errors: Partial<Record<keyof CheckoutForm, string>>;
  submitting: boolean;
  /** A refusal from `placeOrder` that is not a field error. */
  failure: string | null;
  order: PlacedOrder | null;
  trackingStep: number;
  /** Transient confirmation text, announced in a live region. */
  notice: string | null;
}

const emptyForm: CheckoutForm = {
  name: '',
  phone: '',
  address: '',
  zoneId: 'centro',
  notes: '',
  payment: 'card',
  cardNumber: '',
};

/**
 * The demo's starting position, per scenario.
 *
 * Deterministic and total: everything the reducer can change is set here, so
 * remounting the component (which is how the shell implements reset) restores
 * the demo exactly, with no residue from the previous run.
 */
export function createInitialState(scenarioId: string): State {
  const returning = scenarioId === 'habitual';

  return {
    scenarioId,
    screen: 'home',
    query: '',
    merchantId: null,
    category: null,
    cart: [],
    form: returning
      ? {
          ...emptyForm,
          name: savedCustomer.name,
          phone: savedCustomer.phone,
          address: savedCustomer.address,
          zoneId: savedCustomer.zoneId,
          notes: savedCustomer.notes,
        }
      : emptyForm,
    errors: {},
    submitting: false,
    failure: null,
    order: null,
    trackingStep: 0,
    notice: null,
  };
}

export type Action =
  | { type: 'search'; query: string }
  | { type: 'openMerchant'; merchantId: string }
  | { type: 'setCategory'; category: string | null }
  | { type: 'goto'; screen: Screen }
  | { type: 'addToCart'; productId: string }
  | { type: 'setQty'; productId: string; qty: number }
  | { type: 'clearCart' }
  | { type: 'repeatPrevious' }
  | { type: 'field'; name: keyof CheckoutForm; value: string }
  | { type: 'submit' }
  | { type: 'submitFailed'; message: string; field?: keyof CheckoutForm }
  | { type: 'submitSucceeded'; order: PlacedOrder }
  | { type: 'advanceTracking' }
  | { type: 'dismissNotice' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'search':
      return { ...state, query: action.query };

    case 'openMerchant':
      return {
        ...state,
        screen: 'merchant',
        merchantId: action.merchantId,
        category: null,
      };

    case 'setCategory':
      return { ...state, category: action.category };

    case 'goto':
      return { ...state, screen: action.screen, failure: null };

    case 'addToCart': {
      const product = findProduct(action.productId);
      if (!product || product.stock === 0) return state;

      const existing = state.cart.find((l) => l.productId === action.productId);
      // Stock is a real constraint, not a label: a quantity cannot be raised
      // past it here or by the stepper below.
      if (existing && existing.qty >= product.stock) {
        return { ...state, notice: `No queda más ${product.name.toLowerCase()}.` };
      }

      const cart = existing
        ? state.cart.map((l) =>
            l.productId === action.productId ? { ...l, qty: l.qty + 1 } : l,
          )
        : [...state.cart, { productId: action.productId, qty: 1 }];

      return { ...state, cart, notice: `${product.name} añadido al carrito.` };
    }

    case 'setQty': {
      const product = findProduct(action.productId);
      if (!product) return state;

      const qty = Math.max(0, Math.min(action.qty, product.stock));
      const cart =
        qty === 0
          ? state.cart.filter((l) => l.productId !== action.productId)
          : state.cart.map((l) =>
              l.productId === action.productId ? { ...l, qty } : l,
            );

      return { ...state, cart, notice: null };
    }

    case 'clearCart':
      return { ...state, cart: [], notice: 'Carrito vaciado.' };

    case 'repeatPrevious': {
      // Only offered in the returning-customer scenario, and it replaces the
      // cart rather than merging: "repeat that order" means that order.
      const lines = previousOrder.lines.flatMap((line) => {
        const product = findProduct(line.productId);
        return product && product.stock >= line.qty
          ? [{ productId: line.productId, qty: line.qty }]
          : [];
      });

      return {
        ...state,
        cart: lines,
        merchantId: previousOrder.merchantId,
        screen: 'cart',
        notice: 'Hemos repetido tu pedido anterior.',
      };
    }

    case 'field': {
      const errors = { ...state.errors };
      delete errors[action.name];
      return {
        ...state,
        form: { ...state.form, [action.name]: action.value },
        errors,
        // Editing after a refusal clears it: the message described the values
        // that were submitted, and those have just changed.
        failure: null,
      };
    }

    case 'submit':
      return { ...state, submitting: true, failure: null, errors: {} };

    case 'submitFailed':
      return {
        ...state,
        submitting: false,
        failure: action.field ? null : action.message,
        errors: action.field ? { [action.field]: action.message } : {},
      };

    case 'submitSucceeded':
      return {
        ...state,
        submitting: false,
        failure: null,
        errors: {},
        order: action.order,
        cart: [],
        screen: 'tracking',
        trackingStep: 0,
        notice: null,
      };

    case 'advanceTracking':
      return {
        ...state,
        trackingStep: Math.min(state.trackingStep + 1, TRACKING_STEPS.length - 1),
      };

    case 'dismissNotice':
      return { ...state, notice: null };

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────────
 * Everything the views read about the cart is computed from `state.cart`, so
 * the badge, the list and the totals are the same number by construction.   */

export interface DetailedLine {
  product: DemoProduct;
  qty: number;
  lineTotal: number;
}

export function detailedCart(state: State): DetailedLine[] {
  return state.cart.flatMap((line) => {
    const product = findProduct(line.productId);
    if (!product) return [];
    return [{ product, qty: line.qty, lineTotal: product.price * line.qty }];
  });
}

export function cartCount(state: State): number {
  return state.cart.reduce((sum, line) => sum + line.qty, 0);
}

export function subtotal(state: State): number {
  return detailedCart(state).reduce((sum, line) => sum + line.lineTotal, 0);
}

/**
 * The merchant the cart belongs to.
 *
 * A cart holds one merchant's goods — the real product delivers from one shop
 * per order — so this is derived from the first line rather than stored, and
 * cannot drift from what is actually in the cart.
 */
export function cartMerchant(state: State): DemoMerchant | undefined {
  const first = detailedCart(state)[0];
  return first ? findMerchant(first.product.merchantId) : undefined;
}

export function deliveryFee(state: State): number {
  return findZone(state.form.zoneId)?.fee ?? 0;
}

export function serviceFee(state: State): number {
  return Math.round(subtotal(state) * SERVICE_RATE);
}

export function total(state: State): number {
  return subtotal(state) + deliveryFee(state) + serviceFee(state);
}

export function visibleMerchants(state: State): DemoMerchant[] {
  const query = state.query.trim().toLowerCase();
  if (!query) return [...merchants];
  return merchants.filter(
    (merchant) =>
      merchant.name.toLowerCase().includes(query) ||
      merchant.trade.toLowerCase().includes(query) ||
      products.some(
        (product) =>
          product.merchantId === merchant.id &&
          product.name.toLowerCase().includes(query),
      ),
  );
}

export function visibleProducts(state: State): DemoProduct[] {
  if (!state.merchantId) return [];
  return products.filter(
    (product) =>
      product.merchantId === state.merchantId &&
      (state.category === null || product.category === state.category),
  );
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

/** Digits only, so a number typed with spaces or dashes validates the same. */
function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Field-level validation, run before anything is "sent".
 *
 * Returned as a map rather than thrown, so every bad field is reported at once
 * — a form that reveals its problems one at a time is a form people abandon,
 * and demonstrating that would be demonstrating the wrong thing.
 */
export function validate(
  form: CheckoutForm,
): Partial<Record<keyof CheckoutForm, string>> {
  const errors: Partial<Record<keyof CheckoutForm, string>> = {};

  if (form.name.trim().length < 3) {
    errors.name = 'Escribe el nombre de quien recibe.';
  }

  if (digits(form.phone).length !== 8) {
    errors.phone = 'El teléfono debe tener 8 dígitos.';
  }

  if (form.address.trim().length < 10) {
    errors.address = 'Añade calle, número y entre qué calles está.';
  }

  if (form.payment === 'card' && digits(form.cardNumber).length !== 16) {
    errors.cardNumber = 'La tarjeta debe tener 16 dígitos.';
  }

  return errors;
}

/**
 * Place the order, or refuse it.
 *
 * Three refusals, all of them conditions on state the visitor can see and
 * reach again (§20):
 *   · the form has a bad field;
 *   · the subtotal is below the merchant's stated minimum;
 *   · the card is the reserved decline number.
 *
 * Pure. The delay and the pending state are the caller's job.
 */
export function placeOrder(state: State): DemoResult<PlacedOrder> {
  const lines = detailedCart(state);
  if (lines.length === 0) {
    return fail('empty', 'Tu carrito está vacío.');
  }

  const errors = validate(state.form);
  const firstBad = (Object.keys(errors) as (keyof CheckoutForm)[])[0];
  if (firstBad) {
    return fail('invalid', errors[firstBad] as string, firstBad);
  }

  const merchant = cartMerchant(state);
  const goods = subtotal(state);
  if (merchant && goods < merchant.minimum) {
    return fail(
      'minimum',
      `${merchant.name} entrega a partir de ${Math.round(merchant.minimum / 100)} CUP. Te faltan ${Math.round((merchant.minimum - goods) / 100)} CUP.`,
    );
  }

  if (
    state.form.payment === 'card' &&
    digits(state.form.cardNumber) === DECLINED_CARD
  ) {
    return fail(
      'declined',
      'El banco rechazó la tarjeta. Prueba con otra o paga en efectivo.',
      'cardNumber',
    );
  }

  const zone = findZone(state.form.zoneId);
  const delivery = zone?.fee ?? 0;
  const service = Math.round(goods * SERVICE_RATE);

  return ok({
    // Derived from the cart rather than random, so the same order produces the
    // same reference every time the demo is run.
    reference: orderReference(state),
    merchantId: merchant?.id ?? '',
    lines: state.cart.map((line) => ({ ...line })),
    subtotal: goods,
    delivery,
    service,
    total: goods + delivery + service,
    payment: state.form.payment,
    address: state.form.address.trim(),
    eta: zone?.minutes ?? [30, 45],
  });
}

/** A stable, human-looking order number derived from the order itself. */
function orderReference(state: State): string {
  const seed = state.cart.reduce(
    (acc, line) => acc + line.productId.length * 31 + line.qty * 7,
    subtotal(state) / 100,
  );
  return `TC-${(4000 + (Math.round(seed) % 5000)).toString().padStart(4, '0')}`;
}
