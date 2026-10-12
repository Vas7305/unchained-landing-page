'use client';

import { useReducer, useState, type Dispatch, type FormEvent, type ReactNode } from 'react';
import {
  Banknote,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ScanBarcode,
  Search,
  ShoppingBasket,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoModal from '@/components/demo/ui/DemoModal';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { demoDate, longDate } from '@/lib/demo/format';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  METHOD_LABEL,
  TILE_PASTEL,
  findProduct,
  store,
  type Method,
} from '@/lib/demo/apps/merxis-pos/data';
import {
  bills,
  cartRows,
  cartTotal,
  cashPeriod,
  cashStatus,
  cashSuggestions,
  change,
  checkout,
  closeRegister,
  countLines,
  counted,
  createInitialState,
  cup,
  expected,
  findSale,
  folioLabel,
  formatQty,
  groups,
  isBulk,
  parsePesos,
  pieces,
  qtyInCart,
  reducer,
  stockLevel,
  tileName,
  today,
  visibleProducts,
  type Action,
  type State,
  type View,
} from '@/lib/demo/apps/merxis-pos/state';

/**
 * Merxis POS — the Caja screen, the day's sales and the cash closing.
 *
 * Reconstructed from the product's own sell route (src/routes/vender.tsx,
 * src/components/pos-cart.tsx and src/components/cash-closing.tsx in the
 * Merxis repository), in its "Escritorio moderno" look in dark mode — the
 * look of the screenshot on its portfolio card. The labels, the tile layout,
 * the abbreviated names, the payment controls and the closing's arithmetic
 * are the product's; the store and its numbers are fixtures.
 *
 * Only two things differ, both because a website cannot do them: the camera
 * scanner is replaced by a list of codes to "scan", and there is no printer.
 *
 * The layout responds to the frame, not the window — container queries — so
 * the ticket sits beside the grid when there is room and becomes a "Cobrar"
 * bar with a dialog when there is not, as the product does on a phone.
 */

/** The product's tokens that have no --d-* equivalent. */
const TILE_TEXT = '#0b1220';
const SCAN_BG = '#24324f';
const SCAN_FG = '#cfe0ff';
const INCOME = 'var(--d-positive)';

const radius = { borderRadius: 'var(--d-radius)' } as const;

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
}

export default function MerxisPosDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  async function charge() {
    dispatch({ type: 'chargeStart' });
    const result = await simulate(() => checkout(state), DEMO_LATENCY.normal);
    if (!result.ok) {
      dispatch({ type: 'chargeFailed', message: result.failure.message });
      return;
    }
    setTicketOpen(false);
    dispatch({ type: 'chargeDone', sale: result.value });
    track('demo_completed', { project: 'merxis-pos', workflow: 'checkout' });
  }

  async function close() {
    dispatch({ type: 'closeStart' });
    const result = await simulate(() => closeRegister(state), DEMO_LATENCY.normal);
    if (!result.ok) {
      dispatch({ type: 'closeFailed', message: result.failure.message });
      return;
    }
    dispatch({ type: 'closeDone', closing: result.value });
    track('demo_completed', { project: 'merxis-pos', workflow: 'cash_closing' });
  }

  const day = today(state);

  return (
    <div className='@container h-full flex flex-col bg-[var(--d-bg)] text-[var(--d-fg)]'>
      <Header />

      <div className='flex-1 min-h-0 overflow-y-auto'>
        <div className='px-4 @2xl:px-8 py-5 flex flex-col gap-4 max-w-6xl mx-auto'>
          <div className='flex flex-col gap-3 @2xl:flex-row @2xl:items-end @2xl:justify-between'>
            <div>
              <h1 className='text-2xl @2xl:text-3xl font-semibold tracking-tight'>
                {store.caja} · {store.name}
              </h1>
              <p className='mt-1 text-sm text-[var(--d-muted)]'>
                Hoy: {day.count} {day.count === 1 ? 'venta' : 'ventas'} ·{' '}
                <span className='font-medium tabular-nums' style={{ color: INCOME }}>
                  {cup(day.total)}
                </span>
              </p>
            </div>
            <ViewSwitch view={state.view} dispatch={dispatch} />
          </div>

          {/* While a dialog is open, its own region speaks for it; announcing
              the same refusal twice would be read twice. */}
          <DemoStatus tone='error'>
            {state.notice?.tone === 'error' && !state.weighing && !ticketOpen
              ? state.notice.text
              : null}
          </DemoStatus>
          <DemoStatus tone='info'>
            {state.notice?.tone === 'info' ? state.notice.text : null}
          </DemoStatus>

          {state.view === 'caja' && (
            <Register
              state={state}
              dispatch={dispatch}
              onCharge={charge}
              onScan={() => setScanOpen(true)}
            />
          )}
          {state.view === 'ventas' && <SalesList state={state} dispatch={dispatch} />}
          {state.view === 'cierre' && (
            <CashClosing state={state} dispatch={dispatch} onClose={close} />
          )}
        </div>
      </div>

      {/* Narrow frames: the ticket lives behind a bar, as on the phone app. */}
      {state.view === 'caja' && state.cart.length > 0 && (
        <div className='@3xl:hidden shrink-0 p-3 border-t border-[var(--d-border)] bg-[var(--d-bg)]'>
          <button
            type='button'
            onClick={() => setTicketOpen(true)}
            style={radius}
            className='w-full min-h-12 flex items-center gap-3 px-4 bg-[var(--d-accent)] text-[var(--d-accent-fg)] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
          >
            <ShoppingBasket size={18} aria-hidden='true' />
            <span className='text-sm'>
              {pieces(state)} {pieces(state) === 1 ? 'artículo' : 'artículos'}
            </span>
            <span className='ml-auto text-lg tabular-nums'>{cup(cartTotal(state))}</span>
            <span className='flex items-center text-sm'>
              Cobrar
              <ChevronRight size={16} aria-hidden='true' />
            </span>
          </button>
        </div>
      )}

      <DemoModal
        open={ticketOpen && state.view === 'caja' && state.cart.length > 0}
        onClose={() => setTicketOpen(false)}
        title='Ticket'
        labelClose='Cerrar'
      >
        <TicketPanel state={state} dispatch={dispatch} onCharge={charge} inDialog />
      </DemoModal>

      <WeighDialog key={state.weighing ?? 'none'} state={state} dispatch={dispatch} />
      <ScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onPick={(code) => {
          setScanOpen(false);
          dispatch({ type: 'query', query: code });
          dispatch({ type: 'scan' });
        }}
      />
      <ReceiptDialog state={state} dispatch={dispatch} />
    </div>
  );
}

/* ── Chrome ────────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className='shrink-0 flex items-center gap-3 px-4 @2xl:px-6 h-16 border-b border-[var(--d-border)]'>
      {/* The Merxis mark: Lime Sprout on Fresh Canopy, the brand's two colours. */}
      <span
        aria-hidden='true'
        className='w-10 h-10 grid place-items-center rounded-xl text-xl font-bold'
        style={{ background: '#2d3e2c', color: '#e4fd97' }}
      >
        M
      </span>
      <div className='min-w-0'>
        <p className='text-base font-semibold leading-tight truncate'>{store.name}</p>
        <p className='text-xs text-[var(--d-muted)]'>Atiende: {store.seller}</p>
      </div>
    </header>
  );
}

const VIEWS: [View, string][] = [
  ['caja', 'Caja'],
  ['ventas', 'Ventas'],
  ['cierre', 'Cierre'],
];

/** The product's segmented control: the current view sits raised on a card. */
function ViewSwitch({ view, dispatch }: { view: View; dispatch: Dispatch<Action> }) {
  return (
    <div
      role='group'
      aria-label='Vista'
      style={radius}
      className='grid grid-cols-3 gap-1 p-1 bg-[var(--d-surface-2)] w-full @2xl:w-96'
    >
      {VIEWS.map(([key, text]) => (
        <button
          key={key}
          type='button'
          aria-pressed={view === key}
          onClick={() => dispatch({ type: 'view', view: key })}
          style={radius}
          className={
            'h-10 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
            (view === key
              ? 'bg-[var(--d-surface)] text-[var(--d-fg)] shadow-[0_0_0_1px_#2b3038,0_1px_2px_rgba(0,0,0,0.35)]'
              : 'text-[var(--d-muted)] hover:text-[var(--d-fg)]')
          }
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      style={radius}
      className={`bg-[var(--d-surface)] border border-[var(--d-border)] p-5 ${className}`}
    >
      {children}
    </section>
  );
}

/* ── Caja ──────────────────────────────────────────────────────────────── */

function Register({
  state,
  dispatch,
  onCharge,
  onScan,
}: Props & { onCharge: () => void; onScan: () => void }) {
  const shown = visibleProducts(state);

  function submit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: 'scan' });
  }

  return (
    <div className='grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_20rem]'>
      <div className='@container min-w-0 flex flex-col gap-3'>
        <form onSubmit={submit} className='flex gap-2'>
          <div className='relative flex-1 min-w-0'>
            <Search
              size={18}
              aria-hidden='true'
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--d-muted)]'
            />
            <input
              value={state.query}
              onChange={(event) => dispatch({ type: 'query', query: event.target.value })}
              placeholder='Buscar o escanear código'
              aria-label='Buscar o escanear producto'
              enterKeyHint='search'
              autoComplete='off'
              style={radius}
              className='w-full h-12 pl-10 pr-3 text-base bg-[var(--d-surface)] border border-[#434a54] placeholder:text-[var(--d-muted)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
            />
          </div>
          <button
            type='button'
            onClick={onScan}
            aria-label='Escanear un código'
            style={{ ...radius, background: SCAN_BG, color: SCAN_FG }}
            className='h-12 shrink-0 inline-flex items-center gap-2 px-4 text-sm font-semibold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
          >
            <ScanBarcode size={18} aria-hidden='true' />
            <span className='hidden @md:inline'>Escanear</span>
          </button>
        </form>

        <div className='-mx-1 px-1 pb-1 flex gap-1 overflow-x-auto'>
          <Chip active={state.group === null} onClick={() => dispatch({ type: 'group', group: null })}>
            Todo
          </Chip>
          {groups().map((group) => (
            <Chip
              key={group}
              active={state.group === group}
              onClick={() =>
                dispatch({ type: 'group', group: state.group === group ? null : group })
              }
            >
              {group}
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className='py-10 text-center text-sm text-[var(--d-muted)]'>
            No hay productos que coincidan.
          </p>
        ) : (
          <ul className='grid grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-4 gap-2'>
            {shown.map((product) => {
              const level = stockLevel(product.left, product.minStock);
              const qty = qtyInCart(state, product.id);
              const bulk = isBulk(product.unit);
              return (
                <li key={product.id} className='relative'>
                  <button
                    type='button'
                    disabled={level === 'agotado'}
                    title={product.name}
                    onClick={() =>
                      dispatch(
                        bulk
                          ? { type: 'weigh', productId: product.id }
                          : { type: 'add', productId: product.id, qty: 1 },
                      )
                    }
                    style={{
                      background: TILE_PASTEL[product.color],
                      color: TILE_TEXT,
                      borderRadius: '0.875rem',
                      ...(qty ? { boxShadow: '0 0 0 2px var(--d-bg), 0 0 0 4px var(--d-accent)' } : {}),
                    }}
                    className='relative w-full h-full min-h-32 p-3 flex flex-col justify-between gap-2 text-left transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
                  >
                    <span
                      className={`line-clamp-2 text-[15px] font-semibold leading-snug ${qty ? (bulk ? 'pr-20' : 'pr-11') : ''}`}
                    >
                      <span aria-hidden='true'>{tileName(product.name)}</span>
                      <span className='sr-only'>{product.name}</span>
                    </span>
                    <span className='pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-2xl leading-none tabular-nums'>
                      {cup(product.price)}
                      {bulk && <span className='text-sm opacity-80'>/{product.unit}</span>}
                    </span>
                    {/* The tile colour means nothing, so low stock is flagged by weight and icon. */}
                    <span
                      className={`flex items-center gap-1 text-sm tabular-nums ${level === 'ok' ? 'opacity-85' : 'font-semibold'}`}
                    >
                      {level === 'bajo' && <TriangleAlert size={14} aria-hidden='true' className='shrink-0' />}
                      {level === 'agotado' ? 'Agotado' : `Quedan ${formatQty(product.left, product.unit)}`}
                      {level === 'bajo' && <span className='sr-only'> (stock bajo)</span>}
                    </span>
                  </button>
                  {/* A sibling, not a child: buttons cannot nest. */}
                  {qty > 0 && (
                    <div className='absolute -right-1.5 -top-1.5 flex h-8 items-center rounded-full pr-2.5 text-xs font-semibold tabular-nums bg-[var(--d-accent)] text-[var(--d-accent-fg)]'>
                      <button
                        type='button'
                        onClick={() =>
                          dispatch({ type: 'setQty', productId: product.id, qty: bulk ? 0 : qty - 1 })
                        }
                        aria-label={bulk ? `Quitar ${product.name} del ticket` : `Quitar un ${product.name}`}
                        className='w-8 h-8 grid place-items-center rounded-full hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                      >
                        <Minus size={14} aria-hidden='true' />
                      </button>
                      {bulk ? formatQty(qty, product.unit) : qty}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Card className='hidden @3xl:block sticky top-0'>
        <h2 className='text-xl font-semibold mb-3'>Ticket</h2>
        <TicketPanel state={state} dispatch={dispatch} onCharge={onCharge} />
      </Card>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className={
        'h-10 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)] ' +
        (active
          ? 'bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
          : 'bg-[var(--d-surface-2)] text-[var(--d-fg)] hover:bg-[#272b31]')
      }
    >
      {children}
    </button>
  );
}

const METHODS: Method[] = ['efectivo', 'tarjeta', 'transferencia'];

function TicketPanel({
  state,
  dispatch,
  onCharge,
  inDialog = false,
}: Props & { onCharge: () => void; inDialog?: boolean }) {
  const rows = cartRows(state);
  const total = cartTotal(state);
  const owed = change(state);
  const short = owed !== null && owed < 0;

  if (rows.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 py-10 text-center'>
        <span className='w-12 h-12 grid place-items-center rounded-full bg-[var(--d-surface-2)]'>
          <ShoppingBasket size={22} aria-hidden='true' className='text-[var(--d-muted)]' />
        </span>
        <p className='font-semibold'>Ticket vacío</p>
        <p className='max-w-56 text-sm text-[var(--d-muted)]'>
          Toca un producto o escanea su código para agregarlo.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-[var(--d-muted)]'>
          {pieces(state)} {pieces(state) === 1 ? 'artículo' : 'artículos'}
        </p>
        <button
          type='button'
          onClick={() => dispatch({ type: 'clear' })}
          style={radius}
          className='inline-flex h-9 items-center gap-1 px-2 text-sm text-[var(--d-muted)] hover:bg-[var(--d-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
        >
          <X size={14} aria-hidden='true' />
          Vaciar
        </button>
      </div>

      <ul className='divide-y divide-[var(--d-border)]'>
        {rows.map((row) => {
          const bulk = isBulk(row.product.unit);
          return (
            <li key={row.product.id} className='py-3 first:pt-0'>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='font-medium leading-snug'>{row.product.name}</p>
                  <p className='text-xs text-[var(--d-muted)] tabular-nums'>
                    {cup(row.product.price)} / {row.product.unit}
                  </p>
                </div>
                <p className='shrink-0 font-medium tabular-nums'>{cup(row.subtotal)}</p>
              </div>
              <div className='mt-2 flex items-center gap-2'>
                {bulk ? (
                  <span className='text-sm tabular-nums text-[var(--d-muted)]'>
                    {formatQty(row.qty, row.product.unit)}
                  </span>
                ) : (
                  <div style={radius} className='flex items-center border border-[var(--d-border)]'>
                    <button
                      type='button'
                      aria-label={`Quitar un ${row.product.name}`}
                      onClick={() => dispatch({ type: 'setQty', productId: row.product.id, qty: row.qty - 1 })}
                      className='w-10 h-10 grid place-items-center text-[var(--d-muted)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                    >
                      <Minus size={14} aria-hidden='true' />
                    </button>
                    <span
                      className='w-10 text-center font-medium tabular-nums border-x border-[var(--d-border)] leading-10'
                      aria-label={`Cantidad de ${row.product.name}: ${row.qty}`}
                    >
                      {row.qty}
                    </span>
                    <button
                      type='button'
                      aria-label={`Agregar un ${row.product.name}`}
                      onClick={() => dispatch({ type: 'setQty', productId: row.product.id, qty: row.qty + 1 })}
                      className='w-10 h-10 grid place-items-center text-[var(--d-muted)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                    >
                      <Plus size={14} aria-hidden='true' />
                    </button>
                  </div>
                )}
                <button
                  type='button'
                  aria-label={`Quitar ${row.product.name}`}
                  onClick={() => dispatch({ type: 'remove', productId: row.product.id })}
                  style={radius}
                  className='ml-auto w-10 h-10 grid place-items-center text-[var(--d-muted)] hover:bg-[var(--d-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                >
                  <Trash2 size={15} aria-hidden='true' />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className='flex items-baseline justify-between border-t border-[var(--d-border)] pt-4'>
        <span className='text-sm font-medium uppercase tracking-wider text-[var(--d-muted)]'>Total</span>
        <span className='text-3xl tabular-nums'>{cup(total)}</span>
      </div>

      <div
        role='radiogroup'
        aria-label='Forma de pago'
        style={radius}
        className='grid grid-cols-3 gap-1 p-1 bg-[var(--d-surface-2)]'
      >
        {METHODS.map((method) => (
          <button
            key={method}
            type='button'
            role='radio'
            aria-checked={state.method === method}
            onClick={() => dispatch({ type: 'method', method })}
            style={radius}
            className={
              'h-10 min-w-0 truncate px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
              (state.method === method
                ? 'bg-[var(--d-surface)] text-[var(--d-fg)] shadow-[0_0_0_1px_#2b3038]'
                : 'text-[var(--d-muted)]')
            }
          >
            {METHOD_LABEL[method]}
          </button>
        ))}
      </div>

      {state.method === 'efectivo' && (
        <div className='grid gap-2'>
          <div className='flex items-center gap-3'>
            <label htmlFor='merxis-cash' className='w-20 shrink-0 text-sm text-[var(--d-muted)]'>
              Recibido
            </label>
            <input
              id='merxis-cash'
              inputMode='decimal'
              autoComplete='off'
              placeholder={String(total / 100)}
              value={state.received}
              onChange={(event) => dispatch({ type: 'received', text: event.target.value })}
              style={radius}
              className='w-full h-11 px-3 text-base font-medium tabular-nums bg-[var(--d-bg)] border border-[#434a54] placeholder:text-[var(--d-muted)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
            />
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {cashSuggestions(total).map((value, index) => (
              <button
                key={value}
                type='button'
                onClick={() => dispatch({ type: 'received', text: String(value / 100) })}
                className='h-9 rounded-full px-3 text-sm font-medium tabular-nums bg-[var(--d-surface-2)] hover:bg-[#272b31] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                {index === 0 ? 'Exacto' : cup(value)}
              </button>
            ))}
          </div>
          {owed !== null && (
            <div className='flex items-baseline justify-between'>
              <span className='text-sm text-[var(--d-muted)]'>{short ? 'Falta' : 'Cambio'}</span>
              <span
                className='text-2xl tabular-nums'
                style={{ color: short ? 'var(--d-danger)' : INCOME }}
              >
                {cup(Math.abs(owed))}
              </span>
            </div>
          )}
        </div>
      )}

      {inDialog && (
        <DemoStatus tone='error'>
          {state.notice?.tone === 'error' ? state.notice.text : null}
        </DemoStatus>
      )}

      <DemoButton size='lg' className='w-full min-h-14 text-base' disabled={short} pending={state.charging} onClick={onCharge}>
        Cobrar {cup(total)}
      </DemoButton>
    </div>
  );
}

/** How much of a product sold by the kilo goes on the ticket. */
function WeighDialog({ state, dispatch }: Props) {
  const product = state.weighing ? findProduct(state.weighing) : undefined;
  const [draft, setDraft] = useState('');
  const amount = Number(draft.replace(',', '.'));
  const valid = draft.trim() !== '' && Number.isFinite(amount) && amount > 0;
  const left = product ? (state.stock[product.id] ?? 0) : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!product || !valid) return;
    dispatch({ type: 'add', productId: product.id, qty: Math.round(amount * 1000) / 1000 });
  }

  return (
    <DemoModal
      open={!!product}
      onClose={() => dispatch({ type: 'weigh', productId: null })}
      title={product?.name ?? ''}
      description={product ? `${cup(product.price)} por ${product.unit} · quedan ${formatQty(left, product.unit)}` : undefined}
      labelClose='Cancelar'
    >
      {product && (
        <form onSubmit={submit} className='grid gap-4'>
          <div className='flex items-center gap-2'>
            <input
              data-autofocus
              inputMode='decimal'
              autoComplete='off'
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder='0'
              aria-label={`Cantidad en ${product.unit}`}
              style={radius}
              className='w-full h-12 px-3 text-lg font-medium tabular-nums bg-[var(--d-bg)] border border-[#434a54] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
            />
            <span className='text-[var(--d-muted)]'>{product.unit}</span>
          </div>
          <div className='grid grid-cols-4 gap-1.5'>
            {[0.25, 0.5, 1, 2].map((value) => (
              <button
                key={value}
                type='button'
                onClick={() => setDraft(String(value))}
                style={radius}
                className='h-10 text-sm font-medium tabular-nums bg-[var(--d-surface-2)] hover:bg-[#272b31] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              >
                {value}
              </button>
            ))}
          </div>
          {valid && (
            <p className='text-sm text-[var(--d-muted)]'>
              Importe:{' '}
              <span className='text-xl text-[var(--d-fg)] tabular-nums'>
                {cup(Math.round(amount * product.price))}
              </span>
            </p>
          )}
          <DemoStatus tone='error'>
            {state.notice?.tone === 'error' ? state.notice.text : null}
          </DemoStatus>
          <div className='flex justify-end gap-2'>
            <DemoButton type='button' variant='secondary' onClick={() => dispatch({ type: 'weigh', productId: null })}>
              Cancelar
            </DemoButton>
            <DemoButton type='submit' disabled={!valid}>
              Agregar al ticket
            </DemoButton>
          </div>
        </form>
      )}
    </DemoModal>
  );
}

/**
 * The camera, as a website can show it: the codes on a few shelf products.
 * Picking one is exactly what a scan does — the code is typed and confirmed.
 */
function ScanDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const samples = ['refresco', 'cerveza', 'arroz', 'cafe', 'papel'].map((id) => findProduct(id)!);
  return (
    <DemoModal
      open={open}
      onClose={onClose}
      title='Escanear'
      description='En la tienda, la cámara del teléfono o un lector Bluetooth leen el código de barras. Aquí, elige un código para escanearlo.'
      labelClose='Cerrar'
    >
      <ul className='grid gap-1.5'>
        {samples.map((product) => (
          <li key={product.id}>
            <button
              type='button'
              onClick={() => onPick(product.sku)}
              style={radius}
              className='w-full flex items-center gap-3 px-3 py-2.5 text-left bg-[var(--d-surface-2)] hover:bg-[#272b31] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
            >
              <ScanBarcode size={18} aria-hidden='true' className='text-[var(--d-muted)] shrink-0' />
              <span className='min-w-0'>
                <span className='block text-sm font-medium truncate'>{product.name}</span>
                <span className='block text-xs text-[var(--d-muted)] tabular-nums'>{product.sku}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </DemoModal>
  );
}

function ReceiptDialog({ state, dispatch }: Props) {
  const sale = state.receipt ? findSale(state, state.receipt.folio) : undefined;
  const fresh = state.receipt?.fresh ?? false;
  const confirming = sale && state.confirmCancel === sale.folio;
  const cancelled = sale?.status === 'anulada';
  const changeGiven = sale?.received != null ? sale.received - sale.total : null;
  const closeReceipt = () => dispatch({ type: 'closeReceipt' });

  return (
    <DemoModal
      open={!!sale}
      onClose={closeReceipt}
      title={sale ? `Venta ${folioLabel(sale.folio)}${cancelled ? ' · Anulada' : ''}` : ''}
      description={sale ? `${store.name} · ${longDate(demoDate(0), 'es')} · ${sale.time}` : undefined}
      labelClose='Cerrar'
      footer={
        sale &&
        (confirming ? (
          <>
            <p className='text-xs text-[var(--d-muted)]'>
              Los productos regresan al almacén y el ingreso se quita del día.
            </p>
            <div className='flex justify-end gap-2'>
              <DemoButton variant='secondary' onClick={() => dispatch({ type: 'askCancel', folio: null })}>
                Cancelar
              </DemoButton>
              <DemoButton variant='danger' onClick={() => dispatch({ type: 'cancelSale', folio: sale.folio })}>
                Anular
              </DemoButton>
            </div>
          </>
        ) : (
          <div className='flex justify-end gap-2'>
            {!fresh && !cancelled && (
              <DemoButton variant='secondary' onClick={() => dispatch({ type: 'askCancel', folio: sale.folio })}>
                Anular venta
              </DemoButton>
            )}
            <DemoButton onClick={closeReceipt}>{fresh ? 'Nueva venta' : 'Cerrar'}</DemoButton>
          </div>
        ))
      }
    >
      {sale && (
        <div
          style={radius}
          className={`border border-dashed border-[var(--d-border)] bg-[var(--d-bg)] px-4 py-3 text-sm ${cancelled ? 'opacity-60' : ''}`}
        >
          <ul className='grid gap-2'>
            {sale.items.map((item) => (
              <li key={item.productId} className='flex justify-between gap-3'>
                <span className='min-w-0'>
                  <span className='block truncate'>{item.name}</span>
                  <span className='text-xs text-[var(--d-muted)] tabular-nums'>
                    {formatQty(item.qty, item.unit)} × {cup(item.price)}
                  </span>
                </span>
                <span className='shrink-0 tabular-nums'>{cup(Math.round(item.qty * item.price))}</span>
              </li>
            ))}
          </ul>
          <dl className='mt-3 grid gap-1 border-t border-dashed border-[var(--d-border)] pt-3'>
            <div className='flex justify-between font-medium'>
              <dt>Total</dt>
              <dd className='text-xl tabular-nums'>{cup(sale.total)}</dd>
            </div>
            <div className='flex justify-between text-[var(--d-muted)]'>
              <dt>Pago</dt>
              <dd>{METHOD_LABEL[sale.method]}</dd>
            </div>
            {sale.received != null && (
              <div className='flex justify-between text-[var(--d-muted)]'>
                <dt>Recibido</dt>
                <dd className='tabular-nums'>{cup(sale.received)}</dd>
              </div>
            )}
            {changeGiven !== null && changeGiven > 0 && (
              <div className='flex justify-between font-medium' style={{ color: INCOME }}>
                <dt>Cambio</dt>
                <dd className='tabular-nums'>{cup(changeGiven)}</dd>
              </div>
            )}
            <div className='flex justify-between text-[var(--d-muted)]'>
              <dt>Atendió</dt>
              <dd>{sale.seller}</dd>
            </div>
          </dl>
        </div>
      )}
    </DemoModal>
  );
}

/* ── Ventas ────────────────────────────────────────────────────────────── */

function SalesList({ state, dispatch }: Props) {
  const day = today(state);
  const newestFirst = [...state.sales].reverse();

  return (
    <Card>
      <div className='mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
        <h2 className='text-lg font-semibold'>{longDate(demoDate(0), 'es')}</h2>
        <p className='text-sm text-[var(--d-muted)]'>
          {day.count} {day.count === 1 ? 'venta' : 'ventas'} ·{' '}
          <span className='font-medium tabular-nums' style={{ color: INCOME }}>
            {cup(day.total)}
          </span>
        </p>
      </div>
      <ul className='divide-y divide-[var(--d-border)]'>
        {newestFirst.map((sale) => (
          <li key={sale.folio}>
            <button
              type='button'
              onClick={() => dispatch({ type: 'openReceipt', folio: sale.folio })}
              className='w-full min-h-14 py-2 flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
            >
              <div className='min-w-0 flex-1'>
                <p className={`font-medium ${sale.status === 'anulada' ? 'line-through opacity-60' : ''}`}>
                  Venta {folioLabel(sale.folio)}
                </p>
                <p className='truncate text-xs text-[var(--d-muted)]'>
                  {sale.time} · {METHOD_LABEL[sale.method]} · {sale.seller} ·{' '}
                  {sale.items.map((item) => item.name).join(', ')}
                </p>
              </div>
              {sale.status === 'anulada' ? (
                <span
                  className='shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full'
                  style={{ color: 'var(--d-danger)', background: 'color-mix(in oklab, var(--d-danger) 14%, transparent)' }}
                >
                  Anulada
                </span>
              ) : (
                <span className='shrink-0 font-medium tabular-nums' style={{ color: INCOME }}>
                  {cup(sale.total)}
                </span>
              )}
              <ChevronRight size={16} aria-hidden='true' className='shrink-0 text-[var(--d-muted)]' />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Cierre ────────────────────────────────────────────────────────────── */

const STATUS = {
  exacto: { text: 'Cuadra', color: 'var(--d-positive)' },
  faltante: { text: 'Faltante', color: 'var(--d-danger)' },
  sobrante: { text: 'Sobrante', color: '#f2c46d' },
} as const;

function CashClosing({ state, dispatch, onClose }: Props & { onClose: () => void }) {
  if (state.closing) {
    const c = state.closing;
    const status = STATUS[cashStatus(c.difference)];
    return (
      <Card className='max-w-xl'>
        <div className='flex items-center gap-3 mb-4'>
          <span
            className='w-10 h-10 grid place-items-center rounded-full'
            style={{ background: 'color-mix(in oklab, var(--d-positive) 18%, transparent)', color: 'var(--d-positive)' }}
          >
            <Check size={20} aria-hidden='true' />
          </span>
          <h2 className='text-lg font-semibold'>Cierre {folioLabel(c.number)} guardado</h2>
        </div>
        <dl className='grid gap-2 text-sm'>
          <Row term='Fondo inicial' value={cup(c.float)} />
          <Row term={`Ventas en efectivo (${c.cashCount})`} value={cup(c.cashSales)} />
          <Row term='Efectivo esperado' value={cup(c.expected)} />
          <Row term='Efectivo contado' value={cup(c.counted)} />
          <Row term='Billetes contados' value={String(c.bills)} />
          <div className='flex justify-between gap-3 border-t border-[var(--d-border)] pt-2 font-medium'>
            <dt>Diferencia</dt>
            <dd className='tabular-nums' style={{ color: status.color }}>
              {c.difference === 0 ? status.text : `${status.text} · ${cup(Math.abs(c.difference))}`}
            </dd>
          </div>
        </dl>
        <DemoButton variant='secondary' className='mt-5' onClick={() => dispatch({ type: 'newShift' })}>
          Abrir nuevo turno
        </DemoButton>
      </Card>
    );
  }

  const cash = cashPeriod(state);
  const owed = expected(state);
  const total = counted(state);
  const difference = owed === null ? null : total - owed;
  const status = difference === null ? null : STATUS[cashStatus(difference)];
  const floatOk = parsePesos(state.float.trim() === '' ? '0' : state.float) !== null;

  return (
    <div className='grid gap-4 @3xl:grid-cols-2 items-start'>
      <Card>
        <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3'>
          <h2 className='text-lg font-semibold'>Efectivo esperado</h2>
          <p className='text-sm text-[var(--d-muted)]'>
            {state.closings === 0 ? 'Desde la apertura' : `Desde el cierre ${folioLabel(state.closings)}`}
          </p>
        </div>
        <dl className='grid gap-2 text-sm'>
          <div className='flex items-center justify-between gap-3'>
            <dt>
              <label htmlFor='merxis-float'>Fondo inicial</label>
            </dt>
            <dd>
              <input
                id='merxis-float'
                inputMode='decimal'
                autoComplete='off'
                value={state.float}
                onChange={(event) => dispatch({ type: 'float', text: event.target.value })}
                aria-invalid={!floatOk}
                aria-describedby='merxis-float-help'
                style={radius}
                className='h-11 w-36 px-3 text-right tabular-nums bg-[var(--d-bg)] border border-[#434a54] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              />
            </dd>
          </div>
          <p
            id='merxis-float-help'
            className='-mt-1 text-xs'
            style={{ color: floatOk ? 'var(--d-muted)' : 'var(--d-danger)' }}
          >
            {floatOk ? 'El cambio que había en la caja al empezar.' : 'Escribe un monto de 0 o más.'}
          </p>
          <Row term={`Ventas en efectivo (${cash.count})`} value={cup(cash.total)} />
          <div className='flex justify-between gap-3 border-t border-[var(--d-border)] pt-2 font-medium'>
            <dt>Debe haber</dt>
            <dd className='text-lg tabular-nums'>{owed === null ? '—' : cup(owed)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <div className='flex items-center gap-2 mb-3'>
          <Banknote size={18} aria-hidden='true' className='text-[var(--d-muted)]' />
          <h2 className='text-lg font-semibold'>Conteo de billetes</h2>
        </div>
        <ul className='grid gap-1.5'>
          {countLines(state).map((line) => (
            <li key={line.denomination} className='grid grid-cols-[4.5rem_1fr_auto] items-center gap-3'>
              <label htmlFor={`merxis-bill-${line.denomination}`} className='text-sm tabular-nums'>
                {cup(line.denomination * 100)}
              </label>
              <input
                id={`merxis-bill-${line.denomination}`}
                inputMode='numeric'
                autoComplete='off'
                placeholder='0'
                value={state.counts[line.denomination] ?? ''}
                onChange={(event) =>
                  dispatch({ type: 'count', denomination: line.denomination, text: event.target.value })
                }
                aria-label={`Cantidad de billetes de ${cup(line.denomination * 100)}`}
                style={radius}
                className='h-10 w-full px-3 text-right tabular-nums bg-[var(--d-bg)] border border-[#434a54] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              />
              <span className='w-24 text-right text-sm tabular-nums text-[var(--d-muted)]'>
                {line.quantity ? cup(line.subtotal) : '—'}
              </span>
            </li>
          ))}
        </ul>
        <dl className='mt-4 grid gap-2 border-t border-[var(--d-border)] pt-3 text-sm'>
          <Row term='Billetes' value={String(bills(state))} />
          <Row term='Contado' value={cup(total)} />
          <div className='flex justify-between gap-3 font-medium'>
            <dt>Diferencia</dt>
            <dd className='tabular-nums' style={{ color: status?.color }}>
              {difference === null || status === null
                ? '—'
                : difference === 0
                  ? status.text
                  : `${status.text} · ${cup(Math.abs(difference))}`}
            </dd>
          </div>
        </dl>
        <DemoButton className='mt-4 w-full' size='lg' pending={state.closingPending} disabled={!floatOk} onClick={onClose}>
          Cerrar caja
        </DemoButton>
      </Card>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className='flex justify-between gap-3'>
      <dt className='text-[var(--d-muted)]'>{term}</dt>
      <dd className='tabular-nums'>{value}</dd>
    </div>
  );
}
