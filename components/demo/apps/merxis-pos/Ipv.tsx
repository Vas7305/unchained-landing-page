'use client';

import type { Dispatch, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoModal from '@/components/demo/ui/DemoModal';
import { DAY_WAGE } from '@/lib/demo/apps/merxis-pos/data';
import {
  SHIFT_KIND_LABEL,
  shiftLabel,
  type ClosedShift,
  type Deductions,
  type IpvLine,
  type IpvTotals,
  type Shift,
  type ShiftKind,
} from '@/lib/demo/apps/merxis-pos/ipv';
import {
  badCounts,
  cup,
  deductionsOf,
  formatQty,
  liveIpv,
  type Action,
  type DeductionKey,
  type State,
} from '@/lib/demo/apps/merxis-pos/state';
import { Card, Row } from './ui';
import { INCOME, radius } from './tokens';

/**
 * IPV por turno — the open shift's sheet, its payments and its closing.
 *
 * Reconstructed from the product's Turno tab (src/components/shift-panel.tsx
 * and src/components/ipv-table.tsx in the Merxis repository): the columns, the
 * Día-orange and Noche-purple headers, the count typed into the sheet with
 * Final, Conteo and Dif. brought next to the product, "Pagos del turno", the
 * two-sided footer, and the review before a shift is closed for good.
 */

/** Header colours of each shift, as on the shop's paper sheet. */
const KIND_TONE: Record<ShiftKind, { background: string; color: string }> = {
  dia: { background: 'color-mix(in oklab, #f2c46d 15%, transparent)', color: '#f2c46d' },
  noche: { background: 'color-mix(in oklab, #8b5cf6 18%, transparent)', color: '#c4b5fd' },
};

const COST = '#f2c46d';

/** Units sold, in Spanish grouping. Built once: a formatter is not free. */
const UNITS = new Intl.NumberFormat('es');
const num = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
}

export default function IpvView({ state, dispatch, onClose }: Props & { onClose: () => void }) {
  if (state.shift) return <OpenShift state={state} dispatch={dispatch} onClose={onClose} />;
  if (state.closedShift) return <ClosedShiftView closed={state.closedShift} dispatch={dispatch} />;
  return null;
}

function KindBadge({ kind }: { kind: ShiftKind }) {
  return (
    <span
      className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold'
      style={KIND_TONE[kind]}
    >
      {SHIFT_KIND_LABEL[kind]}
    </span>
  );
}

/* ── The open shift ────────────────────────────────────────────────────── */

const DEDUCTIONS: [DeductionKey, string][] = [
  ['cuentaCasa', 'Cuenta casa'],
  ['limpieza', 'Limpieza'],
  ['extracciones', 'Extracciones de caja'],
];

function OpenShift({ state, dispatch, onClose }: Props & { onClose: () => void }) {
  const shift = state.shift as Shift;
  const { lines, totals } = liveIpv(state)!;
  const { values, bad } = deductionsOf(state);
  const wrongCounts = badCounts(state);
  const uncounted = lines.filter((l) => l.conteo === undefined).length;

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='flex items-center gap-2 text-lg font-semibold'>
              Turno {shiftLabel(shift.number)} <KindBadge kind={shift.kind} />
            </h2>
            <p className='text-sm text-[var(--d-muted)]'>
              {shift.worker} · abrió {shift.openedAt}
            </p>
          </div>
          <DemoButton
            disabled={wrongCounts > 0}
            onClick={() => dispatch({ type: 'reviewShift', open: true })}
          >
            Cerrar turno
          </DemoButton>
        </div>
        <p className='mt-3 mb-4 text-sm text-[var(--d-muted)]'>
          Al terminar, cuenta lo que hay en el estante y escríbelo en <b>Conteo</b>. Los productos
          que no cuentes quedan sin conteo.
        </p>
        <IpvTable
          lines={lines}
          kind={shift.kind}
          label={`IPV del turno ${shiftLabel(shift.number)}`}
          countCell={(line) => {
            const raw = state.ipvCounts[line.productId] ?? '';
            const invalid = raw.trim() !== '' && !/^\d+([.,]\d+)?$/.test(raw.trim());
            return (
              <input
                inputMode='decimal'
                autoComplete='off'
                value={raw}
                placeholder='—'
                aria-label={`Conteo de ${line.name}`}
                aria-invalid={invalid}
                onChange={(event) =>
                  dispatch({ type: 'ipvCount', productId: line.productId, text: event.target.value })
                }
                style={{
                  ...radius,
                  borderColor: invalid ? 'var(--d-danger)' : '#434a54',
                }}
                className='h-9 w-16 px-2 text-right tabular-nums bg-[var(--d-bg)] border focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
              />
            );
          }}
        />
        {wrongCounts > 0 && (
          <p className='mt-2 text-sm' style={{ color: 'var(--d-danger)' }}>
            Revisa los conteos marcados: solo números de 0 o más.
          </p>
        )}
      </Card>

      <Card className='grid gap-6 @3xl:grid-cols-2'>
        <div className='grid content-start gap-2'>
          <h2 className='text-lg font-semibold'>Pagos del turno</h2>
          <p className='text-[11px] font-medium uppercase tracking-wider text-[var(--d-muted)]'>
            Sueldos y gastos fijos del día
          </p>
          <DeductionInput
            id='sueldo'
            label={`Sueldo de ${shift.worker}`}
            hint={
              state.deductions.sueldo === String(DAY_WAGE / 100)
                ? 'De Gastos → Sueldos, por día'
                : undefined
            }
            value={state.deductions.sueldo}
            invalid={bad.includes('sueldo')}
            onChange={(text) => dispatch({ type: 'deduction', key: 'sueldo', text })}
          />
          <p className='mt-2 text-[11px] font-medium uppercase tracking-wider text-[var(--d-muted)]'>
            Del turno
          </p>
          {DEDUCTIONS.map(([key, text]) => (
            <DeductionInput
              key={key}
              id={key}
              label={text}
              value={state.deductions[key]}
              invalid={bad.includes(key)}
              onChange={(value) => dispatch({ type: 'deduction', key, text: value })}
            />
          ))}
        </div>
        <div className='grid content-start gap-2'>
          <h2 className='text-lg font-semibold'>Hasta ahora</h2>
          <IpvFooter totals={totals} deductions={values} worker={shift.worker} />
        </div>
      </Card>

      <DemoModal
        open={state.reviewingShift}
        onClose={() => dispatch({ type: 'reviewShift', open: false })}
        title={`Cerrar turno ${shiftLabel(shift.number)}`}
        description='El IPV se guarda como está ahora y ya no se puede cambiar.'
        labelClose='Seguir en el turno'
        footer={
          <div className='flex justify-end gap-2'>
            <DemoButton variant='secondary' onClick={() => dispatch({ type: 'reviewShift', open: false })}>
              Seguir en el turno
            </DemoButton>
            <DemoButton pending={state.shiftPending} disabled={bad.length > 0} onClick={onClose}>
              Cerrar turno
            </DemoButton>
          </div>
        }
      >
        {uncounted > 0 && (
          <p
            style={{ ...radius, background: 'color-mix(in oklab, #f2c46d 12%, transparent)' }}
            className='mb-3 flex items-start gap-2 px-3 py-2.5 text-sm'
          >
            <TriangleAlert size={16} aria-hidden='true' className='mt-0.5 shrink-0' style={{ color: COST }} />
            {uncounted === lines.length
              ? 'No contaste ningún producto.'
              : `${uncounted} ${uncounted === 1 ? 'producto queda' : 'productos quedan'} sin conteo.`}
          </p>
        )}
        <dl className='grid gap-1.5 text-sm'>
          <Row term='Importe' value={cup(totals.importe)} />
          {totals.faltante !== 0 && (
            <Row
              term={totals.faltante > 0 ? 'Faltante' : 'Sobrante'}
              value={cup(Math.abs(totals.faltante))}
              tone={totals.faltante > 0 ? 'var(--d-danger)' : COST}
            />
          )}
          {totals.transferencias + totals.extracciones > 0 && (
            <Row
              term='Transferencias y extracciones'
              value={cup(-(totals.transferencias + totals.extracciones))}
            />
          )}
          <Row term='Dinero en caja' value={cup(totals.dineroEnCaja)} strong />
        </dl>
      </DemoModal>
    </div>
  );
}

function DeductionInput({
  id,
  label,
  hint,
  value,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  invalid: boolean;
  onChange: (text: string) => void;
}) {
  const inputId = `merxis-pago-${id}`;
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='min-w-0'>
        <label htmlFor={inputId} className='text-sm'>
          {label}
        </label>
        {hint && <p className='text-xs text-[var(--d-muted)]'>{hint}</p>}
      </div>
      <input
        id={inputId}
        inputMode='decimal'
        autoComplete='off'
        placeholder='0'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        style={{ ...radius, borderColor: invalid ? 'var(--d-danger)' : '#434a54' }}
        className='h-10 w-32 shrink-0 px-3 text-right tabular-nums bg-[var(--d-bg)] border focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
      />
    </div>
  );
}

/* ── A closed shift ────────────────────────────────────────────────────── */

function ClosedShiftView({
  closed,
  dispatch,
}: {
  closed: ClosedShift;
  dispatch: Dispatch<Action>;
}) {
  const next: ShiftKind = closed.kind === 'dia' ? 'noche' : 'dia';
  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
          <div>
            <h2 className='flex items-center gap-2 text-lg font-semibold'>
              Turno {shiftLabel(closed.number)} cerrado <KindBadge kind={closed.kind} />
            </h2>
            <p className='text-sm text-[var(--d-muted)]'>
              {closed.worker} · {closed.openedAt} – {closed.closedAt}
            </p>
          </div>
          <DemoButton variant='secondary' onClick={() => dispatch({ type: 'openShift' })}>
            Abrir turno {SHIFT_KIND_LABEL[next]}
          </DemoButton>
        </div>
        <IpvTable
          lines={closed.lines}
          kind={closed.kind}
          label={`IPV del turno ${shiftLabel(closed.number)}`}
        />
      </Card>
      <Card>
        <IpvFooter totals={closed.totals} deductions={closed.deductions} worker={closed.worker} />
      </Card>
    </div>
  );
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

/**
 * The product's table. With `countCell` the Conteo column takes inputs, and
 * Final, Conteo and Dif. move next to the product so counting needs no
 * sideways scroll; frozen, they sit in the sheet's own order.
 */
function IpvTable({
  lines,
  kind,
  label,
  countCell,
}: {
  lines: IpvLine[];
  kind: ShiftKind;
  label: string;
  countCell?: (line: IpvLine) => ReactNode;
}) {
  const counting = !!countCell;
  const showCount = counting || lines.some((l) => l.conteo !== undefined);

  const countHeads = (
    <>
      <th className={num}>Final</th>
      {showCount && <th className={num}>Conteo</th>}
      {showCount && <th className={num}>Dif.</th>}
    </>
  );

  function countCells(line: IpvLine, off: boolean) {
    const dif = line.diferencia;
    return (
      <>
        <td
          className={`${num} font-medium`}
          style={line.final < 0 ? { color: 'var(--d-danger)' } : undefined}
        >
          {formatQty(line.final, line.unit)}
        </td>
        {showCount && (
          <td className={num}>
            {countCell
              ? countCell(line)
              : line.conteo === undefined
                ? '—'
                : formatQty(line.conteo, line.unit)}
          </td>
        )}
        {showCount && (
          <td
            className={`${num} ${off && dif !== undefined && dif < 0 ? 'font-medium' : ''}`}
            style={off && dif !== undefined ? { color: dif < 0 ? 'var(--d-danger)' : COST } : undefined}
          >
            {dif === undefined ? '—' : dif === 0 ? '0' : `${dif > 0 ? '+' : ''}${formatQty(dif, line.unit)}`}
          </td>
        )}
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <p style={radius} className='bg-[var(--d-surface-2)] px-3 py-6 text-center text-sm text-[var(--d-muted)]'>
        Esta tienda aún no tiene productos con existencia ni movimientos en el turno.
      </p>
    );
  }

  return (
    <div style={radius} className='-mx-1 overflow-x-auto border border-[var(--d-border)]'>
      <table className='w-full min-w-max border-collapse text-sm'>
        <caption className='sr-only'>{label}</caption>
        <thead>
          <tr className='text-xs font-semibold uppercase' style={KIND_TONE[kind]}>
            <th className='px-2 py-2 text-right'>#</th>
            <th className='px-2 py-2 text-left'>Producto</th>
            {counting && countHeads}
            <th className={num}>Inicio</th>
            <th className={num}>Costo</th>
            <th className={num}>Precio</th>
            <th className={num}>Entrada</th>
            <th className={num}>Salida</th>
            <th className={num}>Utilidad</th>
            {!counting && countHeads}
            <th className={num}>Importe</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-[var(--d-border)]'>
          {lines.map((line, index) => {
            const off = line.diferencia !== undefined && line.diferencia !== 0;
            return (
              <tr
                key={line.productId}
                style={off ? { background: 'color-mix(in oklab, var(--d-danger) 8%, transparent)' } : undefined}
              >
                <td className='px-2 py-1.5 text-right tabular-nums text-[var(--d-muted)]'>{index + 1}</td>
                <th scope='row' className='max-w-40 truncate px-2 py-1.5 text-left font-medium'>
                  {line.name}
                </th>
                {counting && countCells(line, off)}
                <td className={num}>{formatQty(line.inicio, line.unit)}</td>
                <td className={num}>{cup(line.costo)}</td>
                <td className={num}>{cup(line.precio)}</td>
                <td className={num}>{line.entrada ? formatQty(line.entrada, line.unit) : '—'}</td>
                <td className={num}>{line.salida ? formatQty(line.salida, line.unit) : '—'}</td>
                <td className={num} style={{ color: INCOME }}>
                  {cup(line.utilidad)}
                </td>
                {!counting && countCells(line, off)}
                <td className={num}>{cup(line.importe)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The sheet's footer. Left, the cash: importe less transferencias and
 * extracciones is the Dinero en caja. Right, the profit: utilidad less every
 * payment of the shift is the Ganancia neta.
 */
function IpvFooter({
  totals,
  deductions,
  worker,
}: {
  totals: IpvTotals;
  deductions: Deductions;
  worker: string;
}) {
  const paid: [string, number][] = (
    [
      [`Sueldo de ${worker}`, deductions.sueldo],
      ['Cuenta casa', deductions.cuentaCasa],
      ['Limpieza', deductions.limpieza],
    ] as [string, number][]
  ).filter(([, amount]) => amount > 0);

  return (
    <div className='grid gap-4 @md:grid-cols-2'>
      <dl className='grid content-start gap-1.5 text-sm'>
        <Row term='Importe' value={cup(totals.importe)} />
        {totals.transferencias > 0 && (
          <Row term='− Transferencias' value={cup(totals.transferencias)} />
        )}
        <Row term='− Extracciones de caja' value={cup(totals.extracciones)} />
        <Row term='Dinero en caja' value={cup(totals.dineroEnCaja)} strong />
        <Row term='Unidades vendidas' value={UNITS.format(totals.salida)} />
        {totals.faltante !== 0 && (
          <Row
            term={totals.faltante > 0 ? 'Faltante (a precio)' : 'Sobrante (a precio)'}
            value={cup(Math.abs(totals.faltante))}
            tone={totals.faltante > 0 ? 'var(--d-danger)' : COST}
          />
        )}
      </dl>
      <dl className='grid content-start gap-1.5 text-sm'>
        <Row term='Utilidad' value={cup(totals.utilidad)} tone={INCOME} />
        {paid.length === 0 ? (
          <Row term='− Pagos del turno' value={cup(0)} />
        ) : (
          paid.map(([term, amount]) => <Row key={term} term={`− ${term}`} value={cup(amount)} />)
        )}
        <Row term='Ganancia neta' value={cup(totals.gananciaNeta)} tone={INCOME} strong />
      </dl>
    </div>
  );
}
