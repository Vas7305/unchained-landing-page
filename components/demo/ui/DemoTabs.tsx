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
  /** Optional count or state shown after the label. */
  badge?: string | number;
}

export default function DemoTabs({
  tabs,
  active,
  onChange,
  label,
  variant = 'bar',
}: {
  tabs: readonly DemoTab[];
  active: string;
  onChange: (id: string) => void;
  /** Names the tablist for assistive technology. */
  label: string;
  /** `bar` sits on a surface; `pill` floats on the page ground. */
  variant?: 'bar' | 'pill';
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: React.KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
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
      onKeyDown={onKeyDown}
      className={
        variant === 'bar'
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
              'inline-flex items-center gap-2 px-3 min-h-10 text-xs font-medium whitespace-nowrap transition-colors duration-150 ' +
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--d-ring)] ' +
              (variant === 'bar'
                ? selected
                  ? 'text-[var(--d-fg)] border-b-2 border-[var(--d-accent)] -mb-px'
                  : 'text-[var(--d-muted)] border-b-2 border-transparent hover:text-[var(--d-fg)] -mb-px'
                : selected
                  ? 'bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
                  : 'bg-[var(--d-surface-2)] text-[var(--d-muted)] hover:text-[var(--d-fg)]')
            }
          >
            {tab.icon}
            {tab.label}
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
