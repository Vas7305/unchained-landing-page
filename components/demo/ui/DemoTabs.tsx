'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * A tab bar with the keyboard behaviour the pattern requires.
 *
 * Arrow keys move between tabs, Home and End jump to the ends, and only the
 * active tab is in the tab sequence — which is what `roving tabindex` means and
 * what separates a real tablist from a row of buttons wearing `role="tab"`.
 * Several demos use this as their primary navigation, so getting it wrong once
 * would get it wrong everywhere (§19).
 *
 * Activation follows selection (moving to a tab shows its panel). That is the
 * right choice here because every panel is local state with nothing to fetch,
 * so there is no cost to the visitor arrowing across the bar.
 */

export interface DemoTab {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Second line under the label. Products whose navigation carries one. */
  sublabel?: string;
  /** Optional count or state shown after the label. */
  badge?: string | number;
}

export default function DemoTabs({
  tabs,
  active,
  onChange,
  label,
  variant = 'bar',
  orientation = 'horizontal',
}: {
  tabs: readonly DemoTab[];
  active: string;
  onChange: (id: string) => void;
  /** Names the tablist for assistive technology. */
  label: string;
  /**
   * `bar` sits on a surface; `pill` floats on the page ground; `sidebar` is a
   * vertical rail, which is what several of these products actually use.
   */
  variant?: 'bar' | 'pill' | 'sidebar';
  orientation?: 'horizontal' | 'vertical';
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const vertical = orientation === 'vertical';

  function onKeyDown(event: React.KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;

    // A vertical tablist is driven by Up and Down; a horizontal one by Left
    // and Right. Using the wrong pair is the usual way this pattern is got
    // wrong, and it is the pair screen-reader users are told to press.
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';

    let next = index;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === back) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div
      role='tablist'
      aria-label={label}
      aria-orientation={vertical ? 'vertical' : undefined}
      onKeyDown={onKeyDown}
      className={
        variant === 'sidebar'
          ? 'flex flex-col'
          : variant === 'bar'
            ? 'flex items-stretch gap-1 border-b border-[var(--d-border)] overflow-x-auto'
            : 'flex items-center gap-1.5 overflow-x-auto'
      }
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            role='tab'
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            style={variant === 'pill' ? { borderRadius: 'var(--d-radius)' } : undefined}
            className={
              (variant === 'sidebar'
                ? 'w-full text-left flex items-start gap-2.5 px-3 py-2.5 border-l-2 text-xs font-medium transition-colors duration-150 '
                : 'inline-flex items-center gap-2 px-3 min-h-10 text-xs font-medium whitespace-nowrap transition-colors duration-150 ') +
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--d-ring)] ' +
              (variant === 'sidebar'
                ? selected
                  ? 'border-[var(--d-accent)] bg-[color-mix(in_oklab,var(--d-accent)_14%,transparent)] text-[var(--d-fg)]'
                  : 'border-transparent text-[var(--d-muted)] hover:text-[var(--d-fg)] hover:bg-[var(--d-surface-2)]'
                : variant === 'bar'
                  ? selected
                    ? 'text-[var(--d-fg)] border-b-2 border-[var(--d-accent)] -mb-px'
                    : 'text-[var(--d-muted)] border-b-2 border-transparent hover:text-[var(--d-fg)] -mb-px'
                  : selected
                    ? 'bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
                    : 'bg-[var(--d-surface-2)] text-[var(--d-muted)] hover:text-[var(--d-fg)]')
            }
          >
            {variant === 'sidebar' ? (
              <>
                <span
                  className='mt-0.5 shrink-0'
                  style={{ color: selected ? 'var(--d-accent)' : undefined }}
                >
                  {tab.icon}
                </span>
                <span className='min-w-0'>
                  <span className='block truncate'>{tab.label}</span>
                  {tab.sublabel && (
                    <span className='block text-[10px] text-[var(--d-muted)] truncate'>
                      {tab.sublabel}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                {tab.icon}
                {tab.label}
              </>
            )}
            {tab.badge !== undefined && (
              <span
                className={
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full ' +
                  (selected && variant === 'pill'
                    ? 'bg-[var(--d-accent-fg)]/20'
                    : 'bg-[var(--d-accent)] text-[var(--d-accent-fg)]')
                }
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The panel half of the pattern. Keeps the wiring in one place. */
export function DemoTabPanel({
  id,
  active,
  children,
  className = '',
}: {
  id: string;
  active: string;
  children: ReactNode;
  className?: string;
}) {
  if (id !== active) return null;

  return (
    <div
      role='tabpanel'
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={`focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ${className}`}
    >
      {children}
    </div>
  );
}
