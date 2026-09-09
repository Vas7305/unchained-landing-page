'use client';

import { useEffect, useReducer } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import { DemoInput, DemoSelect, DemoTextarea } from '@/components/demo/ui/DemoField';
import DemoTabs from '@/components/demo/ui/DemoTabs';
import { DemoArtwork } from '@/components/demo/ui/DemoArtwork';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  cup,
  findMerchant,
  findZone,
  previousOrder,
  zones,
} from '@/lib/demo/apps/tancerca/data';
import {
  TRACKING_STEPS,
  cartCount,
  cartMerchant,
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
  type CheckoutForm,
  type State,
} from '@/lib/demo/apps/tancerca/state';

/**
 * TanCerca — the consumer side of the marketplace.
 *
 * ─── What this demonstrates, and what it leaves out ───────────────────────
 * The product is three systems: merchant tooling, the consumer app, and the
 * operational layer between them. A visitor has a few minutes, so this is the
 * consumer journey end to end — find a shop, fill a basket, pay, watch the
 * order move — because that is the part whose value is legible without
 * explanation, and because it is the part that exercises the domain model the
 * other two are built on. Merchant dashboards and delivery dispatch are named
 * on the project page rather than rebuilt here (§28).
 *
 * ─── Where the logic is ───────────────────────────────────────────────────
 * Not here. Every total, every constraint and every refusal comes from
 * lib/demo/apps/tancerca/state.ts, and this file dispatches actions and draws
 * the result. The one thing it owns is the asynchrony: `simulate()` wraps the
 * pure `placeOrder` decision so that paying has a pending state and a delay
 * like it would in the product.
 */

/**
 * The marketplace's own header.
 *
 * Wordmark, the pill search field the site leads with, and the two account
 * actions — the arrangement tancercadeti.com actually uses, in the green it
 * actually uses. The back control appears only inside a flow, where the site
 * has one.
 */
function Header({
  state,
  onBack,
  onCart,
  title,
}: {
  state: State;
  onBack?: () => void;
  onCart: () => void;
  title: string;
}) {
  const count = cartCount(state);

  return (
    <header className='shrink-0 border-b border-[var(--d-border)] bg-[var(--d-surface)]'>
      <div className='max-w-5xl mx-auto flex items-center gap-3 px-4 py-2.5'>
        {onBack ? (
          <button
            type='button'
            onClick={onBack}
            aria-label='Volver'
            className='p-2 -ml-2 text-[var(--d-muted)] hover:text-[var(--d-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
          >
            <ArrowLeft size={18} aria-hidden='true' />
          </button>
        ) : null}

        {/* The marketplace's own mark, inlined from its logo-mark.svg. */}
        <span className='flex items-center gap-1.5 shrink-0'>
          <svg width='22' height='22' viewBox='0 0 40 40' fill='none' aria-hidden='true'>
            <circle cx='14' cy='20' r='10' fill='#059669' />
            <circle cx='26' cy='20' r='10' fill='#E85D04' opacity='0.85' />
            <circle cx='20' cy='20' r='5.5' fill='white' />
          </svg>
          <span className='text-lg font-bold tracking-tight'>
            <span style={{ color: 'var(--d-accent)' }}>Tan</span>
            <span className='text-[var(--d-fg)]'>Cerca</span>
          </span>
        </span>

        <h1 className='flex-1 min-w-0 text-sm font-semibold truncate text-[var(--d-muted)]'>
          {title}
        </h1>

        <span className='hidden md:inline text-xs text-[var(--d-muted)] shrink-0'>
          Iniciar sesión
        </span>

        <button
          type='button'
          onClick={onCart}
          className='relative p-2 text-[var(--d-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] shrink-0'
          aria-label={`Carrito, ${count} ${count === 1 ? 'artículo' : 'artículos'}`}
        >
          <ShoppingBag size={19} aria-hidden='true' />
          {count > 0 && (
            <span
              aria-hidden='true'
              className='absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 grid place-items-center text-[10px] font-bold rounded-full bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
            >
              {count}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

function Money({ value, bold }: { value: number; bold?: boolean }) {
  return (
    <span className={bold ? 'font-bold tabular-nums' : 'tabular-nums'}>
      {cup(value)}
    </span>
  );
}

/* ── Screens ────────────────────────────────────────────────────────────── */

function HomeScreen({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const list = visibleMerchants(state);
  const repeatable = state.scenarioId === 'habitual';
  const lastMerchant = findMerchant(previousOrder.merchantId);

  return (
    <div className='flex flex-col'>
      {/* The tropical sky band the marketplace opens on, with the pill search
          sitting in it — sampled sky #88ceeb into sun glow #fef9c4. */}
      <div
        className='px-4 pt-6 pb-7 text-center'
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, #fef9c4 0%, #bde2f1 38%, #88ceeb 100%)',
        }}
      >
        <h2 className='text-xl md:text-2xl font-extrabold tracking-tight text-[#0b1f1a]'>
          Tu tienda online,{' '}
          <span style={{ color: 'var(--d-accent)' }}>lista en minutos</span>
        </h2>
        <p className='mt-1.5 text-xs text-[#0b1f1a]/70'>
          Compra en los negocios de tu barrio y recibe el pedido en casa.
        </p>

        <div className='relative max-w-md mx-auto mt-4'>
          <Search
            size={15}
            aria-hidden='true'
            className='absolute left-4 top-1/2 -translate-y-1/2 text-[var(--d-muted)]'
          />
          <input
            type='search'
            value={state.query}
            onChange={(event) =>
              dispatch({ type: 'search', query: event.target.value })
            }
            placeholder='Buscar tiendas o productos…'
            aria-label='Buscar tiendas o productos'
            style={{ borderRadius: '9999px' }}
            className='w-full pl-10 pr-4 min-h-11 text-sm bg-white/90 border border-white/70 shadow-sm placeholder:text-[var(--d-muted)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
          />
        </div>
      </div>

      <div className='p-4 flex flex-col gap-3'>
        <div className='flex items-center gap-2 text-xs text-[var(--d-muted)]'>
          <MapPin size={13} aria-hidden='true' className='text-[var(--d-accent)]' />
          <span>Entregando en {findZone(state.form.zoneId)?.name}</span>
        </div>

      {repeatable && lastMerchant && state.cart.length === 0 && (
        <div
          style={{ borderRadius: 'var(--d-radius)' }}
          className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)] flex items-center gap-3'
        >
          <div className='flex-1 min-w-0'>
            <p className='text-xs text-[var(--d-muted)]'>Tu último pedido</p>
            <p className='text-sm font-semibold truncate'>{lastMerchant.name}</p>
          </div>
          <DemoButton
            size='sm'
            onClick={() => dispatch({ type: 'repeatPrevious' })}
          >
            Repetir
          </DemoButton>
        </div>
      )}

      <h2 className='text-xs font-bold uppercase tracking-wider text-[var(--d-muted)] mt-1'>
        {state.query ? `${list.length} resultados` : 'Cerca de ti'}
      </h2>

      {list.length === 0 && (
        <p className='text-sm text-[var(--d-muted)] py-8 text-center'>
          No encontramos nada con “{state.query}”.
        </p>
      )}

      <ul className='grid grid-cols-1 md:grid-cols-2 gap-2.5'>
        {list.map((merchant) => (
          <li key={merchant.id}>
            <button
              type='button'
              onClick={() =>
                dispatch({ type: 'openMerchant', merchantId: merchant.id })
              }
              style={{ borderRadius: 'var(--d-radius)' }}
              className='w-full text-left flex items-center gap-3 p-2.5 bg-[var(--d-surface)] border border-[var(--d-border)] hover:border-[var(--d-accent)] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
            >
              <span
                className='w-14 h-14 shrink-0 overflow-hidden'
                style={{ borderRadius: 'calc(var(--d-radius) - 4px)' }}
              >
                <DemoArtwork seed={merchant.id} />
              </span>
              <span className='flex-1 min-w-0'>
                <span className='block text-sm font-semibold truncate'>
                  {merchant.name}
                </span>
                <span className='block text-xs text-[var(--d-muted)] truncate'>
                  {merchant.trade}
                </span>
                <span className='flex items-center gap-2 mt-1 text-[11px] text-[var(--d-muted)]'>
                  <span className='inline-flex items-center gap-0.5 text-[var(--d-fg)]'>
                    <Star
                      size={11}
                      aria-hidden='true'
                      className='fill-current text-[var(--d-accent)]'
                    />
                    {merchant.rating}
                  </span>
                  <span>({merchant.reviews})</span>
                  <span aria-hidden='true'>·</span>
                  <span>{findZone(merchant.zoneId)?.minutes.join('–')} min</span>
                </span>
              </span>
              <ChevronRight
                size={16}
                aria-hidden='true'
                className='text-[var(--d-muted)] shrink-0'
              />
            </button>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}

function MerchantScreen({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const merchant = state.merchantId ? findMerchant(state.merchantId) : undefined;
  if (!merchant) return null;

  const list = visibleProducts(state);
  const tabs = [
    { id: '__all', label: 'Todo' },
    ...merchant.categories.map((category) => ({ id: category, label: category })),
  ];

  return (
    <div className='flex flex-col'>
      <div className='relative h-28 shrink-0'>
        <DemoArtwork seed={`${merchant.id}-hero`} />
        <div className='absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent'>
          <p className='text-sm font-bold text-white'>{merchant.name}</p>
          <p className='text-[11px] text-white/80'>
            Pedido mínimo {cup(merchant.minimum)} · Entrega{' '}
            {findZone(merchant.zoneId)?.minutes.join('–')} min
          </p>
        </div>
      </div>

      <div className='px-3 pt-3'>
        <DemoTabs
          variant='pill'
          label='Categorías'
          tabs={tabs}
          active={state.category ?? '__all'}
          onChange={(id) =>
            dispatch({ type: 'setCategory', category: id === '__all' ? null : id })
          }
        />
      </div>

      <ul className='p-3 flex flex-col gap-2'>
        {list.map((product) => {
          const line = state.cart.find((l) => l.productId === product.id);
          const soldOut = product.stock === 0;

          return (
            <li
              key={product.id}
              style={{ borderRadius: 'var(--d-radius)' }}
              className='flex items-center gap-3 p-2.5 bg-[var(--d-surface)] border border-[var(--d-border)]'
            >
              <span
                className='w-12 h-12 shrink-0 overflow-hidden'
                style={{ borderRadius: 'calc(var(--d-radius) - 4px)' }}
              >
                <DemoArtwork seed={product.id} />
              </span>

              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium truncate'>{product.name}</p>
                <p className='text-[11px] text-[var(--d-muted)]'>
                  {product.unit}
                  {soldOut && ' · agotado'}
                </p>
                <p className='text-sm font-bold mt-0.5'>
                  <Money value={product.price} />
                </p>
              </div>

              {line ? (
                <div className='flex items-center gap-1 shrink-0'>
                  <button
                    type='button'
                    onClick={() =>
                      dispatch({
                        type: 'setQty',
                        productId: product.id,
                        qty: line.qty - 1,
                      })
                    }
                    aria-label={`Quitar uno de ${product.name}`}
                    style={{ borderRadius: 'var(--d-radius)' }}
                    className='w-9 h-9 grid place-items-center border border-[var(--d-border)] text-[var(--d-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                  >
                    <Minus size={14} aria-hidden='true' />
                  </button>
                  <span
                    className='w-7 text-center text-sm font-bold tabular-nums'
                    aria-label={`${line.qty} en el carrito`}
                  >
                    {line.qty}
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      dispatch({ type: 'addToCart', productId: product.id })
                    }
                    aria-label={`Añadir otro ${product.name}`}
                    style={{ borderRadius: 'var(--d-radius)' }}
                    className='w-9 h-9 grid place-items-center bg-[var(--d-accent)] text-[var(--d-accent-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                  >
                    <Plus size={14} aria-hidden='true' />
                  </button>
                </div>
              ) : (
                <DemoButton
                  size='sm'
                  variant={soldOut ? 'secondary' : 'primary'}
                  disabled={soldOut}
                  onClick={() =>
                    dispatch({ type: 'addToCart', productId: product.id })
                  }
                  aria-label={`Añadir ${product.name} al carrito`}
                >
                  {soldOut ? 'Agotado' : 'Añadir'}
                </DemoButton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CartScreen({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const lines = detailedCart(state);
  const merchant = cartMerchant(state);
  const goods = subtotal(state);
  const short = merchant ? merchant.minimum - goods : 0;

  if (lines.length === 0) {
    return (
      <div className='p-8 flex flex-col items-center justify-center gap-3 text-center h-full'>
        <ShoppingBag size={28} className='text-[var(--d-muted)]' aria-hidden='true' />
        <p className='text-sm text-[var(--d-muted)]'>Tu carrito está vacío.</p>
        <DemoButton
          variant='secondary'
          onClick={() => dispatch({ type: 'goto', screen: 'home' })}
        >
          Ver negocios
        </DemoButton>
      </div>
    );
  }

  return (
    <div className='p-3 flex flex-col gap-3'>
      {merchant && (
        <p className='text-xs text-[var(--d-muted)]'>
          Pedido de <span className='font-semibold text-[var(--d-fg)]'>{merchant.name}</span>
        </p>
      )}

      <ul className='flex flex-col gap-2'>
        {lines.map(({ product, qty, lineTotal }) => (
          <li
            key={product.id}
            style={{ borderRadius: 'var(--d-radius)' }}
            className='flex items-center gap-3 p-2.5 bg-[var(--d-surface)] border border-[var(--d-border)]'
          >
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium truncate'>{product.name}</p>
              <p className='text-[11px] text-[var(--d-muted)]'>
                {cup(product.price)} · {product.unit}
              </p>
            </div>

            <div className='flex items-center gap-1'>
              <button
                type='button'
                onClick={() =>
                  dispatch({ type: 'setQty', productId: product.id, qty: qty - 1 })
                }
                aria-label={`Quitar uno de ${product.name}`}
                style={{ borderRadius: 'var(--d-radius)' }}
                className='w-9 h-9 grid place-items-center border border-[var(--d-border)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                <Minus size={14} aria-hidden='true' />
              </button>
              <span className='w-6 text-center text-sm font-bold tabular-nums'>
                {qty}
              </span>
              <button
                type='button'
                onClick={() =>
                  dispatch({ type: 'setQty', productId: product.id, qty: qty + 1 })
                }
                aria-label={`Añadir otro ${product.name}`}
                style={{ borderRadius: 'var(--d-radius)' }}
                className='w-9 h-9 grid place-items-center border border-[var(--d-border)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                <Plus size={14} aria-hidden='true' />
              </button>
            </div>

            <span className='w-20 text-right text-sm font-bold tabular-nums'>
              {cup(lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <dl
        style={{ borderRadius: 'var(--d-radius)' }}
        className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)] text-sm flex flex-col gap-1.5'
      >
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>Subtotal</dt>
          <dd><Money value={goods} /></dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>Entrega</dt>
          <dd><Money value={deliveryFee(state)} /></dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>Servicio (5%)</dt>
          <dd><Money value={serviceFee(state)} /></dd>
        </div>
        <div className='flex justify-between pt-1.5 mt-1 border-t border-[var(--d-border)] text-base'>
          <dt className='font-bold'>Total</dt>
          <dd><Money value={total(state)} bold /></dd>
        </div>
      </dl>

      {short > 0 && (
        <DemoStatus tone='info'>
          Te faltan {cup(short)} para alcanzar el pedido mínimo de{' '}
          {merchant?.name}.
        </DemoStatus>
      )}

      <DemoButton
        block
        size='lg'
        disabled={short > 0}
        onClick={() => dispatch({ type: 'goto', screen: 'checkout' })}
      >
        Continuar · {cup(total(state))}
      </DemoButton>

      <DemoButton
        block
        variant='ghost'
        size='sm'
        onClick={() => dispatch({ type: 'clearCart' })}
      >
        Vaciar carrito
      </DemoButton>
    </div>
  );
}

function CheckoutScreen({
  state,
  dispatch,
  onSubmit,
}: {
  state: State;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  onSubmit: () => void;
}) {
  function field(name: keyof CheckoutForm) {
    return {
      value: state.form[name],
      error: state.errors[name],
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => dispatch({ type: 'field', name, value: event.target.value }),
    };
  }

  return (
    <form
      className='p-3 flex flex-col gap-3'
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className='text-sm font-bold'>Datos de entrega</h2>

      <DemoInput label='Quién recibe' autoComplete='off' {...field('name')} />
      <DemoInput
        label='Teléfono'
        inputMode='tel'
        placeholder='5 234 8890'
        autoComplete='off'
        {...field('phone')}
      />
      <DemoTextarea label='Dirección' rows={2} {...field('address')} />
      <DemoSelect label='Zona' {...field('zoneId')}>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name} · {cup(zone.fee)}
          </option>
        ))}
      </DemoSelect>
      <DemoTextarea
        label='Indicaciones para el mensajero'
        rows={2}
        {...field('notes')}
      />

      <h2 className='text-sm font-bold mt-2'>Pago</h2>

      <fieldset className='flex gap-2'>
        <legend className='sr-only'>Método de pago</legend>
        {(
          [
            { id: 'card', label: 'Tarjeta' },
            { id: 'cash', label: 'Efectivo' },
          ] as const
        ).map((option) => (
          <label
            key={option.id}
            style={{ borderRadius: 'var(--d-radius)' }}
            className={
              'flex-1 flex items-center justify-center gap-2 min-h-11 text-sm font-medium cursor-pointer border transition-colors duration-150 ' +
              (state.form.payment === option.id
                ? 'border-[var(--d-accent)] bg-[var(--d-accent)]/10 text-[var(--d-fg)]'
                : 'border-[var(--d-border)] text-[var(--d-muted)]')
            }
          >
            <input
              type='radio'
              name='payment'
              value={option.id}
              checked={state.form.payment === option.id}
              onChange={() =>
                dispatch({ type: 'field', name: 'payment', value: option.id })
              }
              className='sr-only'
            />
            {state.form.payment === option.id && (
              <Check size={14} aria-hidden='true' />
            )}
            {option.label}
          </label>
        ))}
      </fieldset>

      {state.form.payment === 'card' && (
        <DemoInput
          label='Número de tarjeta'
          inputMode='numeric'
          placeholder='4242 4242 4242 4242'
          autoComplete='off'
          hint='Datos simulados. Usa 4000 0000 0000 0002 para ver un rechazo.'
          {...field('cardNumber')}
        />
      )}

      <DemoStatus tone='error'>{state.failure}</DemoStatus>

      <dl
        style={{ borderRadius: 'var(--d-radius)' }}
        className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)] text-sm flex justify-between'
      >
        <dt className='font-bold'>Total</dt>
        <dd><Money value={total(state)} bold /></dd>
      </dl>

      <DemoButton type='submit' block size='lg' pending={state.submitting}>
        {state.submitting ? 'Procesando…' : `Pagar ${cup(total(state))}`}
      </DemoButton>
    </form>
  );
}

function TrackingScreen({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const order = state.order;

  // The order moves on its own, the way it does in the product. Cleared on
  // unmount, so a reset mid-delivery does not leave a timer running against a
  // component that no longer exists.
  useEffect(() => {
    if (!order) return;
    if (state.trackingStep >= TRACKING_STEPS.length - 1) return;

    const timer = setTimeout(() => dispatch({ type: 'advanceTracking' }), 2600);
    return () => clearTimeout(timer);
  }, [order, state.trackingStep, dispatch]);

  if (!order) return null;

  const merchant = findMerchant(order.merchantId);

  return (
    <div className='p-4 flex flex-col gap-4'>
      <div className='flex flex-col items-center text-center gap-1.5 pt-2'>
        <span
          className='w-12 h-12 grid place-items-center rounded-full'
          style={{
            background: 'color-mix(in oklab, var(--d-positive) 18%, transparent)',
            color: 'var(--d-positive)',
          }}
        >
          <Check size={22} aria-hidden='true' />
        </span>
        <h2 className='text-base font-bold'>Pedido {order.reference}</h2>
        <p className='text-xs text-[var(--d-muted)]'>
          {merchant?.name} · llega en {order.eta.join('–')} min
        </p>
      </div>

      <ol className='flex flex-col gap-0'>
        {TRACKING_STEPS.map((step, index) => {
          const done = index <= state.trackingStep;
          const current = index === state.trackingStep;

          return (
            <li key={step} className='flex gap-3'>
              <div className='flex flex-col items-center'>
                <span
                  aria-hidden='true'
                  className='w-6 h-6 grid place-items-center rounded-full border-2 shrink-0 transition-colors duration-300'
                  style={{
                    borderColor: done ? 'var(--d-positive)' : 'var(--d-border)',
                    background: done ? 'var(--d-positive)' : 'transparent',
                    color: 'var(--d-surface)',
                  }}
                >
                  {done && <Check size={12} />}
                </span>
                {index < TRACKING_STEPS.length - 1 && (
                  <span
                    aria-hidden='true'
                    className='w-0.5 flex-1 min-h-6 transition-colors duration-300'
                    style={{
                      background: index < state.trackingStep
                        ? 'var(--d-positive)'
                        : 'var(--d-border)',
                    }}
                  />
                )}
              </div>
              <p
                className={
                  'pb-5 text-sm ' +
                  (current
                    ? 'font-semibold text-[var(--d-fg)]'
                    : done
                      ? 'text-[var(--d-muted)]'
                      : 'text-[var(--d-muted)] opacity-60')
                }
              >
                {step}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Announces each transition once, rather than the whole list. */}
      <p role='status' aria-live='polite' className='sr-only'>
        {TRACKING_STEPS[state.trackingStep]}
      </p>

      <dl
        style={{ borderRadius: 'var(--d-radius)' }}
        className='p-3 bg-[var(--d-surface)] border border-[var(--d-border)] text-sm flex flex-col gap-1.5'
      >
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>Entrega en</dt>
          <dd className='text-right max-w-[60%] truncate'>{order.address}</dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-[var(--d-muted)]'>Pago</dt>
          <dd>{order.payment === 'card' ? 'Tarjeta' : 'Efectivo'}</dd>
        </div>
        <div className='flex justify-between pt-1.5 mt-1 border-t border-[var(--d-border)]'>
          <dt className='font-bold'>Total</dt>
          <dd><Money value={order.total} bold /></dd>
        </div>
      </dl>

      <DemoButton
        block
        variant='secondary'
        icon={<Truck size={14} aria-hidden='true' />}
        onClick={() => dispatch({ type: 'goto', screen: 'home' })}
      >
        Volver al inicio
      </DemoButton>
    </div>
  );
}

/* ── Application ───────────────────────────────────────────────────────── */

export default function TanCercaDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(
    reducer,
    scenarioId,
    createInitialState,
  );

  // Transient confirmations clear themselves, so the live region does not keep
  // repeating "added to cart" long after the fact.
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => dispatch({ type: 'dismissNotice' }), 2400);
    return () => clearTimeout(timer);
  }, [state.notice]);

  async function submit() {
    dispatch({ type: 'submit' });

    const result = await simulate(() => placeOrder(state), DEMO_LATENCY.normal);

    if (result.ok) {
      dispatch({ type: 'submitSucceeded', order: result.value });
      track('demo_completed', { project: 'tancerca', workflow: 'checkout' });
    } else {
      dispatch({
        type: 'submitFailed',
        message: result.failure.message,
        field: result.failure.field as keyof CheckoutForm | undefined,
      });
    }
  }

  const merchant = state.merchantId ? findMerchant(state.merchantId) : undefined;
  const titles: Record<State['screen'], string> = {
    home: 'TanCerca',
    merchant: merchant?.name ?? 'TanCerca',
    cart: 'Tu carrito',
    checkout: 'Confirmar pedido',
    tracking: 'Tu pedido',
  };

  const back: Record<State['screen'], (() => void) | undefined> = {
    home: undefined,
    merchant: () => dispatch({ type: 'goto', screen: 'home' }),
    cart: () =>
      dispatch({ type: 'goto', screen: merchant ? 'merchant' : 'home' }),
    checkout: () => dispatch({ type: 'goto', screen: 'cart' }),
    tracking: undefined,
  };

  return (
    <div className='h-full flex flex-col'>
      <Header
        state={state}
        title={titles[state.screen]}
        onBack={back[state.screen]}
        onCart={() => dispatch({ type: 'goto', screen: 'cart' })}
      />

      <div className='flex-1 min-h-0 overflow-y-auto'>
       <div className='max-w-5xl mx-auto w-full'>
        {state.screen === 'home' && (
          <HomeScreen state={state} dispatch={dispatch} />
        )}
        {state.screen === 'merchant' && (
          <MerchantScreen state={state} dispatch={dispatch} />
        )}
        {state.screen === 'cart' && (
          <CartScreen state={state} dispatch={dispatch} />
        )}
        {state.screen === 'checkout' && (
          <CheckoutScreen state={state} dispatch={dispatch} onSubmit={submit} />
        )}
        {state.screen === 'tracking' && (
          <TrackingScreen state={state} dispatch={dispatch} />
        )}
       </div>
      </div>

      {state.notice && (
        <div className='px-3 pb-3 pt-1 shrink-0'>
          <DemoStatus tone='success'>{state.notice}</DemoStatus>
        </div>
      )}
    </div>
  );
}
