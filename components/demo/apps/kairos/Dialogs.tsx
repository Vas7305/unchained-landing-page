'use client';

import { useState, type FormEvent } from 'react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoModal from '@/components/demo/ui/DemoModal';
import { DemoInput, DemoTextarea } from '@/components/demo/ui/DemoField';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/demo/apps/kairos/data';
import {
  categoryOf,
  fmtDate,
  phraseFor,
  validateCounter,
  type Counter,
  type CounterDraft,
  type CounterInput,
  type MilestoneEvent,
} from '@/lib/demo/apps/kairos/state';
import { FOCUS, MONO, catInk } from './tokens';

/**
 * The counter form, the restart confirmation and the milestone share card,
 * from CounterFormDialog.tsx, CounterDeck/Home.tsx and lib/shareCard.ts.
 */

// ── CounterFormDialog ──────────────────────────────────────────────────────

function draftOf(editing: Counter | null, today: string): CounterDraft {
  return {
    title: editing?.title ?? '',
    category: editing?.category ?? 'habito',
    note: editing?.note ?? '',
    start_date: editing?.start_date ?? today,
    target_day: editing?.target_day ? String(editing.target_day) : '',
    alarm_time: editing?.alarm_time ?? '',
  };
}

/**
 * Mounted only while open, so its fields start from the counter being edited
 * — the product fills them from an effect when the dialog opens; mounting
 * does the same without the extra render.
 */
export function CounterForm({
  editing,
  today,
  onClose,
  onSave,
}: {
  editing: Counter | null;
  today: string;
  onClose: () => void;
  onSave: (input: CounterInput) => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(editing, today));
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof CounterDraft>(key: K, value: CounterDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (error?.field === key) setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    let result;
    try {
      result = await simulate(() => validateCounter(draft, today), DEMO_LATENCY.quick);
    } finally {
      setPending(false);
    }
    if (!result.ok) {
      setError(result.failure);
      return;
    }
    onSave(result.value);
  }

  const errorFor = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <DemoModal
      open
      onClose={onClose}
      labelClose='Cerrar'
      title={editing ? 'Editar contador' : 'Nuevo contador'}
      description='Marca el día cero. Kairós contará desde esa fecha y avisará cada 10 días.'
    >
      <form className='flex flex-col gap-4' onSubmit={submit} noValidate>
        <DemoInput
          label='Título'
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder='Ej. Dejé de fumar'
          error={errorFor('title')}
          data-autofocus
        />
        <fieldset className='flex flex-col gap-1.5'>
          <legend className='mb-1.5 text-xs font-medium text-[var(--d-muted)]'>Categoría</legend>
          <div className='flex flex-wrap gap-2'>
            {CATEGORY_KEYS.map((key) => {
              const cat = CATEGORIES[key];
              const on = draft.category === key;
              return (
                <button
                  key={key}
                  type='button'
                  aria-pressed={on}
                  onClick={() => set('category', key)}
                  className={`${MONO} min-h-8 rounded-full border px-3 py-1 text-xs transition-opacity duration-150 ${FOCUS} ${
                    on ? 'ring-2 ring-offset-1 ring-offset-[var(--d-surface)]' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${cat.bar}1A`,
                    borderColor: `${cat.bar}4D`,
                    color: catInk(key),
                    ['--tw-ring-color' as string]: cat.bar,
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <DemoInput
          label='Día marcado'
          type='date'
          value={draft.start_date}
          max={today}
          onChange={(e) => set('start_date', e.target.value)}
          error={errorFor('start_date')}
        />
        <DemoTextarea
          label='Nota (opcional)'
          value={draft.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder='¿Por qué cuenta este día?'
          rows={2}
        />
        <div className='grid grid-cols-2 gap-3'>
          <DemoInput
            label='Meta en días (opcional)'
            type='number'
            min={1}
            inputMode='numeric'
            value={draft.target_day}
            onChange={(e) => set('target_day', e.target.value)}
            placeholder='Ej. 100'
            error={errorFor('target_day')}
          />
          <DemoInput
            label='Alarma diaria (opcional)'
            type='time'
            value={draft.alarm_time}
            onChange={(e) => set('alarm_time', e.target.value)}
            error={errorFor('alarm_time')}
          />
        </div>
        {draft.alarm_time && (
          <p
            className={`${MONO} rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-[var(--k-cyan)]`}
          >
            Te avisaremos cada día a las {draft.alarm_time} (hora de este dispositivo), incluso con la app cerrada si
            activas las notificaciones.
          </p>
        )}
        <DemoButton type='submit' block pending={pending} disabled={!draft.title.trim() || !draft.start_date}>
          {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear contador'}
        </DemoButton>
      </form>
    </DemoModal>
  );
}

// ── Restart ────────────────────────────────────────────────────────────────

/** The product asks with `window.confirm`; a page cannot, so it asks here. */
export function RestartDialog({
  counter,
  onClose,
  onConfirm,
}: {
  counter: Counter | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DemoModal
      open={counter !== null}
      onClose={onClose}
      labelClose='Cerrar'
      title={`¿Reiniciar "${counter?.title ?? ''}" al día 0?`}
      description='Se pierde su historial de hitos.'
      footer={
        <>
          <DemoButton variant='danger' block onClick={onConfirm} data-autofocus>
            Reiniciar
          </DemoButton>
          <DemoButton variant='ghost' block onClick={onClose}>
            Cancelar
          </DemoButton>
        </>
      }
    />
  );
}

// ── Share card ─────────────────────────────────────────────────────────────

// `preserve`: the product spaces its letters with spaces, which SVG would collapse.
const CENTER = { textAnchor: 'middle', dominantBaseline: 'middle', xmlSpace: 'preserve' } as const;

/**
 * The 1200 × 630 card the product draws on a canvas and hands to the phone's
 * share sheet, drawn here as SVG with the same coordinates, colours and type.
 */
export function ShareCard({ event, onClose }: { event: MilestoneEvent | null; onClose: () => void }) {
  const title = event && event.title.length > 34 ? `${event.title.slice(0, 33)}…` : event?.title;
  const color = event ? categoryOf(event.category).bar : '#F59E0B';

  return (
    <DemoModal
      open={event !== null}
      onClose={onClose}
      labelClose='Cerrar'
      title='Tarjeta de hito lista'
      description={event ? `Día ${event.milestone} · ${event.title}` : undefined}
      footer={
        <DemoButton variant='secondary' block onClick={onClose} data-autofocus>
          Cerrar
        </DemoButton>
      }
    >
      {event && (
        <>
          <svg
            viewBox='0 0 1200 630'
            role='img'
            aria-label={`Tarjeta: ${event.milestone} días cumplidos, ${event.title}, ${fmtDate(event.date)}. «${phraseFor(event.category, event.milestone)}»`}
            className='w-full rounded-lg'
          >
            <defs>
              <radialGradient id='kr-card-glow' cx='600' cy='160' r='520' gradientUnits='userSpaceOnUse'>
                <stop offset='0' stopColor='rgba(245,158,11,0.16)' />
                <stop offset='1' stopColor='rgba(11,12,16,0)' />
              </radialGradient>
            </defs>
            <rect width='1200' height='630' fill='#0B0C10' />
            <rect width='1200' height='630' fill='url(#kr-card-glow)' />
            <rect x='24.5' y='24.5' width='1151' height='581' fill='none' stroke='rgba(255,255,255,0.08)' />
            <g>
              <text {...CENTER} x='600' y='72' fill='#F59E0B' fontSize='24' fontWeight='500' style={{ fontFamily: 'var(--font-kr-mono)' }}>
                K A I R Ó S  ·  H I T O  D E C Á D I C O
              </text>
              <circle cx='600' cy='285' r='205' fill='none' stroke={color} strokeWidth='5' strokeDasharray='16 12' />
              <circle cx='600' cy='285' r='150' fill={color} fillOpacity='0.14' />
              <text {...CENTER} x='600' y='275' fill='#F9FAFB' fontSize='170' fontWeight='900' style={{ fontFamily: 'var(--font-kr-heading)' }}>
                {event.milestone}
              </text>
              <text {...CENTER} x='600' y='445' fill='#9CA3AF' fontSize='26' fontWeight='500' style={{ fontFamily: 'var(--font-kr-mono)' }}>
                D Í A S   C U M P L I D O S
              </text>
              <text {...CENTER} x='600' y='490' fill='#FBBF24' fontSize='26' fontWeight='500' style={{ fontFamily: 'var(--font-kr-sans)' }}>
                “{phraseFor(event.category, event.milestone)}”
              </text>
              <text {...CENTER} x='600' y='548' fill='#F3F4F6' fontSize='44' fontWeight='700' style={{ fontFamily: 'var(--font-kr-heading)' }}>
                {title}
              </text>
              <text {...CENTER} x='600' y='592' fill='#6B7280' fontSize='20' style={{ fontFamily: 'var(--font-kr-mono)' }}>
                {fmtDate(event.date)}
              </text>
            </g>
          </svg>
          <p className='mt-3 text-xs leading-relaxed text-[var(--d-muted)]'>
            En el teléfono se abre el menú de compartir con la imagen; en el ordenador se descarga como
            kairos-hito-{event.milestone}.png.
          </p>
        </>
      )}
    </DemoModal>
  );
}
