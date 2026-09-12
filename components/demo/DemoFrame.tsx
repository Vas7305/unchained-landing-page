'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { DemoDefinition } from '@/lib/demo/types';

/**
 * The window the product is shown in, and the boundary its theme applies
 * inside.
 *
 * ─── Two jobs, deliberately in one component ──────────────────────────────
 * The frame draws the device — a phone, a browser window, a desktop
 * application — and the same element establishes the CSS custom properties the
 * whole demo is written against. Keeping them together means there is exactly
 * one node that can be described as "inside the demo": the theme cannot leak
 * onto the site, and the site's tokens cannot bleed into the product.
 *
 * ─── Why a frame at all ───────────────────────────────────────────────────
 * §17: the visitor should be able to tell what they are looking at. A consumer
 * PWA and a private-equity console rendered as bare panels of the same width
 * look like two pages of the same application, which is the opposite of what a
 * portfolio needs to communicate. The frame is also honest about scale — a
 * phone product shown at 380px is being shown at the size it is used at.
 *
 * ─── The chrome is a drawing ──────────────────────────────────────────────
 * The address bar is `aria-hidden` and is not a link, the traffic lights are
 * not buttons, and nothing in the chrome is focusable. It is a picture of a
 * window; making any of it interactive would put controls in the tab order
 * that do nothing (§19).
 */

function themeStyle(definition: DemoDefinition): CSSProperties {
  return {
    ...definition.theme,
    ...(definition.fontFamily ? { fontFamily: definition.fontFamily } : {}),
    background: 'var(--d-bg)',
    color: 'var(--d-fg)',
  } as CSSProperties;
}

/** Height of the interactive area. Tall enough to be an app, short enough to
 *  leave the page's own chrome visible on a laptop. */
const STAGE_HEIGHT = 'h-[min(76vh,44rem)] min-h-[30rem]';

function Chrome({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden='true'
      className='flex items-center gap-2 px-3 h-10 shrink-0 border-b border-[var(--d-border)] bg-[var(--d-surface-2)] select-none'
    >
      {children}
    </div>
  );
}

function Dots() {
  return (
    <div className='flex items-center gap-1.5 shrink-0'>
      {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
        <span
          key={color}
          className='w-2.5 h-2.5 rounded-full'
          style={{ background: color, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}

export default function DemoFrame({
  definition,
  label,
  children,
}: {
  definition: DemoDefinition;
  /** Names the demo region for assistive technology. */
  label: string;
  children: ReactNode;
}) {
  const { frame, surfaceLabel, lang } = definition;

  // `lang` moves with the surface: the product's interface is in its own
  // language, and a screen reader should switch voice at this boundary rather
  // than read Spanish with the site's English synthesiser (§19).
  const surface = (
    <div
      lang={lang}
      style={themeStyle(definition)}
      className='flex flex-col h-full overflow-hidden'
    >
      {frame === 'browser' && (
        <Chrome>
          <Dots />
          <div
            className='flex-1 flex items-center gap-1.5 justify-center mx-2 px-3 h-6 max-w-sm text-[11px] text-[var(--d-muted)] bg-[var(--d-bg)] border border-[var(--d-border)]'
            style={{ borderRadius: '9999px' }}
          >
            <Lock size={9} className='shrink-0' />
            <span className='truncate'>{surfaceLabel}</span>
          </div>
          <div className='w-11 shrink-0' />
        </Chrome>
      )}

      {frame === 'desktop' && (
        <Chrome>
          <span className='text-[11px] font-medium text-[var(--d-fg)] truncate'>
            {surfaceLabel}
          </span>
          <div className='flex-1' />
          <div className='flex items-center gap-3 text-[var(--d-muted)] text-[10px] tracking-widest'>
            <span>—</span>
            <span>▢</span>
            <span>✕</span>
          </div>
        </Chrome>
      )}

      {frame === 'phone' && (
        <Chrome>
          <span className='text-[11px] font-semibold text-[var(--d-fg)]'>
            9:41
          </span>
          <div className='flex-1' />
          <div className='flex items-center gap-1 text-[var(--d-muted)] text-[10px]'>
            <span>▮▮▮</span>
            <span>􀙇</span>
          </div>
        </Chrome>
      )}

      {/* `relative` is the positioning context every DemoModal uses: a dialog
          inside a demo covers the product, never the website around it. */}
      <div className='relative flex-1 min-h-0 overflow-hidden'>{children}</div>
    </div>
  );

  if (frame === 'phone') {
    return (
      <div className='flex justify-center'>
        <section
          aria-label={label}
          className={`w-full max-w-[23.5rem] ${STAGE_HEIGHT} overflow-hidden border border-border shadow-2xl shadow-black/40 rounded-[2.25rem] p-1.5 bg-secondary`}
        >
          <div className='h-full overflow-hidden rounded-[1.85rem]'>
            {surface}
          </div>
        </section>
      </div>
    );
  }

  return (
    <section
      aria-label={label}
      className={`w-full ${STAGE_HEIGHT} overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/40`}
    >
      {surface}
    </section>
  );
}
