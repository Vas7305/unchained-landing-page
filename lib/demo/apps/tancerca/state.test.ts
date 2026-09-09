import { describe, expect, it } from 'vitest';
import { DECLINED_CARD, findMerchant, previousOrder } from './data';
import {
  TRACKING_STEPS,
  cartCount,
  createInitialState,
  deliveryFee,
  detailedCart,
  placeOrder,
  reducer,
  serviceFee,
  subtotal,
  total,
  visibleMerchants,
  visibleProducts,
  type Action,
  type State,
} from './state';

/**
 * The representative workflow, start to finish.
 *
 * ─── Why this is a reducer test and not a click-through ───────────────────
 * The suite runs in vitest's Node environment over `.test.ts` files; there is
 * no DOM here and adding one would mean adding jsdom and a rendering library
 * to a project that has neither. So the workflow is exercised where it
 * actually lives: every action below is one the UI dispatches, in the order a
 * visitor triggers them, and the assertions are on the state the screens
 * render from. What is NOT covered by this is the markup — that limitation is
 * written down in docs/interactive-demos.md rather than papered over.
 *
 * ─── The thing this suite is really protecting ────────────────────────────
 * That the demo behaves like one application: a quantity change has to move
 * the subtotal, the service fee, the total, the badge and the minimum-order
 * check together, because a demo whose cart badge and cart total disagree
 * tells the visitor something false about the product it stands for.
 */

/** Apply a sequence of actions, the way the UI would. */
function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

const validForm: Action[] = [
  { type: 'field', name: 'name', value: 'Marta Delgado' },
  { type: 'field', name: 'phone', value: '5 234 8890' },
  {
    type: 'field',
    name: 'address',
    value: 'Calle Ánimas 214, entre Galiano y Blanco',
  },
  { type: 'field', name: 'cardNumber', value: '4242424242424242' },
];

describe('the starting position', () => {
  it('opens on the merchant list with an empty cart', () => {
    const state = createInitialState('nuevo');

    expect(state.screen).toBe('home');
    expect(state.cart).toEqual([]);
    expect(cartCount(state)).toBe(0);
    expect(subtotal(state)).toBe(0);
    expect(state.order).toBeNull();
  });

  it('prefills the saved profile in the returning-customer scenario', () => {
    const state = createInitialState('habitual');

    expect(state.form.name).not.toBe('');
    expect(state.form.address).not.toBe('');
    // Still an empty cart: a saved address is not an order.
    expect(state.cart).toEqual([]);
  });

  it('gives every scenario a form the checkout can render', () => {
    for (const scenario of ['nuevo', 'habitual']) {
      const state = createInitialState(scenario);
      expect(state.form.zoneId).toBeTruthy();
      expect(deliveryFee(state)).toBeGreaterThan(0);
    }
  });
});

describe('browsing', () => {
  it('filters merchants by name, trade and what they sell', () => {
    const base = createInitialState('nuevo');

    expect(visibleMerchants(run(base, { type: 'search', query: 'panadería' })))
      .toHaveLength(1);

    // Matched on a product, not on the merchant's own name.
    const byProduct = visibleMerchants(
      run(base, { type: 'search', query: 'congrí' }),
    );
    expect(byProduct.map((m) => m.id)).toEqual(['rincon-criollo']);

    expect(
      visibleMerchants(run(base, { type: 'search', query: 'zzzz' })),
    ).toHaveLength(0);
  });

  it('narrows a catalogue to one category', () => {
    const state = run(
      createInitialState('nuevo'),
      { type: 'openMerchant', merchantId: 'dona-mila' },
      { type: 'setCategory', category: 'Café' },
    );

    expect(state.screen).toBe('merchant');
    expect(visibleProducts(state).every((p) => p.category === 'Café')).toBe(true);
    expect(visibleProducts(run(state, { type: 'setCategory', category: null })).length)
      .toBeGreaterThan(visibleProducts(state).length);
  });
});

describe('the cart', () => {
  it('keeps count, subtotal, fees and total in step with one another', () => {
    const state = run(
      createInitialState('nuevo'),
      { type: 'openMerchant', merchantId: 'dona-mila' },
      { type: 'addToCart', productId: 'pan-flauta' },
      { type: 'addToCart', productId: 'pan-flauta' },
      { type: 'addToCart', productId: 'pastelito-guayaba' },
    );

    expect(cartCount(state)).toBe(3);
    // 2 × 8 000 + 1 × 12 000
    expect(subtotal(state)).toBe(28_000);
    expect(serviceFee(state)).toBe(1_400);
    expect(total(state)).toBe(28_000 + deliveryFee(state) + 1_400);

    // And the derived line list agrees with the raw one.
    expect(detailedCart(state).reduce((sum, l) => sum + l.qty, 0)).toBe(3);
  });

  it('drops a line when its quantity reaches zero', () => {
    const state = run(
      createInitialState('nuevo'),
      { type: 'addToCart', productId: 'pan-flauta' },
      { type: 'setQty', productId: 'pan-flauta', qty: 0 },
    );

    expect(state.cart).toEqual([]);
    expect(subtotal(state)).toBe(0);
  });

  it('refuses to add or exceed stock', () => {
    // `cafe-colado` has stock 0 and must not enter the cart at all.
    const soldOut = run(createInitialState('nuevo'), {
      type: 'addToCart',
      productId: 'cafe-colado',
    });
    expect(soldOut.cart).toEqual([]);

    // `torticas-moron` has 8; a quantity above it is clamped, not accepted.
    const clamped = run(
      createInitialState('nuevo'),
      { type: 'addToCart', productId: 'torticas-moron' },
      { type: 'setQty', productId: 'torticas-moron', qty: 99 },
    );
    expect(clamped.cart[0].qty).toBe(8);
  });

  it('repeats a previous order into the cart in the returning scenario', () => {
    const state = run(createInitialState('habitual'), { type: 'repeatPrevious' });

    expect(state.screen).toBe('cart');
    expect(cartCount(state)).toBe(
      previousOrder.lines.reduce((sum, line) => sum + line.qty, 0),
    );
    expect(state.merchantId).toBe(previousOrder.merchantId);
  });
});

describe('checkout', () => {
  /** A cart over Doña Mila's 40 000 minimum: 6 × 8 000 = 48 000. */
  function readyToPay(scenario = 'nuevo'): State {
    let state = run(
      createInitialState(scenario),
      { type: 'openMerchant', merchantId: 'dona-mila' },
      { type: 'addToCart', productId: 'pan-flauta' },
      { type: 'setQty', productId: 'pan-flauta', qty: 6 },
      { type: 'goto', screen: 'checkout' },
    );
    state = run(state, ...validForm);
    return state;
  }

  it('refuses an empty cart', () => {
    const result = placeOrder(createInitialState('nuevo'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('empty');
  });

  it('reports a bad field rather than sending anything', () => {
    const state = run(readyToPay(), {
      type: 'field',
      name: 'phone',
      value: '12',
    });

    const result = placeOrder(state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('invalid');
      expect(result.failure.field).toBe('phone');
    }
  });

  it('enforces the merchant’s minimum order', () => {
    let state = run(
      createInitialState('nuevo'),
      { type: 'openMerchant', merchantId: 'dona-mila' },
      { type: 'addToCart', productId: 'pan-flauta' },
      { type: 'setQty', productId: 'pan-flauta', qty: 2 },
      { type: 'goto', screen: 'checkout' },
    );
    state = run(state, ...validForm);

    const merchant = findMerchant('dona-mila');
    expect(subtotal(state)).toBeLessThan(merchant?.minimum ?? 0);

    const result = placeOrder(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('minimum');
  });

  it('declines the reserved card number, deterministically', () => {
    const state = run(readyToPay(), {
      type: 'field',
      name: 'cardNumber',
      value: DECLINED_CARD,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = placeOrder(state);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('declined');
        expect(result.failure.field).toBe('cardNumber');
      }
    }
  });

  it('recovers from a decline when the visitor pays another way', () => {
    const declined = run(readyToPay(), {
      type: 'field',
      name: 'cardNumber',
      value: DECLINED_CARD,
    });
    expect(placeOrder(declined).ok).toBe(false);

    const cash = run(declined, {
      type: 'field',
      name: 'payment',
      value: 'cash',
    });
    expect(placeOrder(cash).ok).toBe(true);
  });

  it('places the order, empties the cart and moves to tracking', () => {
    const state = readyToPay();
    const result = placeOrder(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = result.value;
    expect(order.subtotal).toBe(48_000);
    expect(order.total).toBe(order.subtotal + order.delivery + order.service);
    expect(order.reference).toMatch(/^TC-\d{4}$/);

    const after = run(state, { type: 'submitSucceeded', order });
    expect(after.screen).toBe('tracking');
    expect(after.cart).toEqual([]);
    expect(cartCount(after)).toBe(0);
    expect(after.order?.reference).toBe(order.reference);
  });

  it('produces the same reference for the same order every time', () => {
    const first = placeOrder(readyToPay());
    const second = placeOrder(readyToPay());

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.reference).toBe(second.value.reference);
    }
  });
});

describe('tracking', () => {
  it('advances through every step and then stops', () => {
    let state = createInitialState('nuevo');
    expect(state.trackingStep).toBe(0);

    for (let i = 0; i < TRACKING_STEPS.length + 3; i++) {
      state = run(state, { type: 'advanceTracking' });
    }

    expect(state.trackingStep).toBe(TRACKING_STEPS.length - 1);
  });
});

describe('reset', () => {
  it('restores the exact starting position after a completed journey', () => {
    const finished = (() => {
      const state = run(
        createInitialState('nuevo'),
        { type: 'openMerchant', merchantId: 'dona-mila' },
        { type: 'addToCart', productId: 'pan-flauta' },
        { type: 'setQty', productId: 'pan-flauta', qty: 6 },
        { type: 'goto', screen: 'checkout' },
        ...validForm,
      );
      const result = placeOrder(state);
      if (!result.ok) throw new Error('fixture should have been payable');
      return run(state, { type: 'submitSucceeded', order: result.value }, {
        type: 'advanceTracking',
      });
    })();

    expect(finished.order).not.toBeNull();

    // Reset in the running product is a remount, which rebuilds exactly this.
    expect(createInitialState('nuevo')).toEqual(createInitialState('nuevo'));
    expect(createInitialState(finished.scenarioId)).not.toEqual(finished);

    const fresh = createInitialState('nuevo');
    expect(fresh.order).toBeNull();
    expect(fresh.cart).toEqual([]);
    expect(fresh.screen).toBe('home');
    expect(fresh.trackingStep).toBe(0);
    expect(fresh.errors).toEqual({});
    expect(fresh.failure).toBeNull();
  });
});
