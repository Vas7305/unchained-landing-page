import type { CSSProperties } from 'react';

/**
 * Kairós's two themes, as custom properties on the demo's root.
 *
 * The product styles itself with Tailwind's neutral and amber scales and then
 * repaints them for its light theme with global overrides (`html:not(.dark)
 * .text-neutral-400 { … }` in frontend/src/index.css). Global overrides cannot
 * come into this website, so the same values are named once here and the
 * screens read them through `var(--k-*)`. The light values are the product's
 * own "tema claro esmeralda", shade for shade.
 *
 * The `--d-*` tokens are set again for each theme so the shared demo
 * primitives — the dialogs, the buttons — change theme with the product.
 */

const DARK = {
  '--k-page': '#0B0C10',
  '--k-header': 'rgb(11 12 16 / 0.8)',
  '--k-card': '#14161F',
  '--k-card-shadow': 'none',
  '--k-inset': '#10131C',
  '--k-active': '#1C1F2B',
  '--k-hero':
    'radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.08) 0%, rgba(11, 12, 16, 0.95) 75%)',
  '--k-line': 'rgb(255 255 255 / 0.1)',
  '--k-line-strong': 'rgb(255 255 255 / 0.2)',
  '--k-line-dash': 'rgb(255 255 255 / 0.25)',
  '--k-track': 'rgb(255 255 255 / 0.1)',
  '--k-cell': 'rgb(255 255 255 / 0.05)',
  '--k-ink': '#F3F4F6',
  '--k-ink-2': '#E5E5E5',
  '--k-ink-3': '#D4D4D4',
  '--k-ink-4': '#A3A3A3',
  '--k-ink-5': '#8A8A8A',
  '--k-ink-6': '#6E6E6E',
  '--k-amber': '#FBBF24',
  '--k-amber-soft': '#FCD34D',
  '--k-amber-mark': 'rgb(245 158 11 / 0.6)',
  '--k-emerald': '#34D399',
  '--k-emerald-soft': '#6EE7B7',
  '--k-cyan': '#67E8F9',
  '--k-red': '#F87171',
  '--k-primary': '#F59E0B',
  '--k-primary-hover': '#FBBF24',
  '--k-primary-ink': '#000000',
  '--k-go': '#10B981',
  '--k-go-hover': '#34D399',
  '--k-accent-text': '#FBBF24',
  '--k-accent-fill': 'none',
  '--cat-habito': '#F59E0B',
  '--cat-proyecto': '#06B6D4',
  '--cat-salud': '#10B981',
  '--cat-relacion': '#F43F5E',
  '--cat-desafio': '#8B5CF6',
  '--cat-meta': '#0EA5E9',
  '--d-bg': '#0B0C10',
  '--d-surface': '#14161F',
  '--d-surface-2': '#1C1F2B',
  '--d-border': 'rgb(255 255 255 / 0.1)',
  '--d-fg': '#F3F4F6',
  '--d-muted': '#9CA3AF',
  '--d-accent': '#F59E0B',
  '--d-accent-fg': '#0B0C10',
  '--d-ring': '#FBBF24',
  '--d-positive': '#10B981',
  '--d-danger': '#EF4444',
};

const LIGHT: typeof DARK = {
  '--k-page': 'linear-gradient(165deg, #F2FCF7 0%, #E1F6EB 38%, #D5F0E3 72%, #CDEDDF 100%)',
  '--k-header': 'linear-gradient(180deg, rgb(242 252 247 / 0.92) 0%, rgb(225 246 235 / 0.85) 100%)',
  '--k-card': 'linear-gradient(180deg, #FFFFFF 0%, #F1FAF5 100%)',
  '--k-card-shadow': '0 1px 2px rgba(6, 78, 59, 0.06), 0 12px 28px -18px rgba(6, 78, 59, 0.35)',
  '--k-inset': 'linear-gradient(135deg, #F7FDFA 0%, #E9F7F0 100%)',
  '--k-active': 'linear-gradient(135deg, #FFF9EB 0%, #E6F7EE 100%)',
  '--k-hero':
    'radial-gradient(ellipse at 15% 0%, rgba(245, 158, 11, 0.20) 0%, transparent 55%), radial-gradient(ellipse at 90% 30%, rgba(16, 185, 129, 0.28) 0%, transparent 60%), linear-gradient(180deg, #F2FCF7 0%, #E1F6EB 100%)',
  '--k-line': 'rgba(6, 78, 59, 0.14)',
  '--k-line-strong': 'rgba(6, 78, 59, 0.26)',
  '--k-line-dash': 'rgba(6, 78, 59, 0.28)',
  '--k-track': 'rgba(6, 78, 59, 0.11)',
  '--k-cell': 'rgba(6, 78, 59, 0.07)',
  '--k-ink': '#062E22',
  '--k-ink-2': '#0B3B2C',
  '--k-ink-3': '#174F3D',
  '--k-ink-4': '#24584A',
  '--k-ink-5': '#35644F',
  '--k-ink-6': '#3F6857',
  '--k-amber': '#92400E',
  '--k-amber-soft': '#92400E',
  '--k-amber-mark': '#D97706',
  '--k-emerald': '#046A4D',
  '--k-emerald-soft': '#046A4D',
  '--k-cyan': '#0E6680',
  '--k-red': '#B91C1C',
  '--k-primary': 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
  '--k-primary-hover': 'linear-gradient(135deg, #FDE68A 0%, #FBBF24 100%)',
  '--k-primary-ink': '#10231B',
  '--k-go': 'linear-gradient(135deg, #6EE7B7 0%, #10B981 100%)',
  '--k-go-hover': 'linear-gradient(135deg, #A7F3D0 0%, #34D399 100%)',
  '--k-accent-text': 'transparent',
  '--k-accent-fill': 'linear-gradient(90deg, #B45309 0%, #C2410C 35%, #047857 100%)',
  '--cat-habito': '#B45309',
  '--cat-proyecto': '#0E6680',
  '--cat-salud': '#046A4D',
  '--cat-relacion': '#BE123C',
  '--cat-desafio': '#6D28D9',
  '--cat-meta': '#0369A1',
  '--d-bg': '#E1F6EB',
  '--d-surface': '#FFFFFF',
  '--d-surface-2': '#E9F7F0',
  '--d-border': 'rgba(6, 78, 59, 0.14)',
  '--d-fg': '#062E22',
  '--d-muted': '#35644F',
  '--d-accent': '#F59E0B',
  '--d-accent-fg': '#10231B',
  '--d-ring': '#059669',
  '--d-positive': '#046A4D',
  '--d-danger': '#B91C1C',
};

export function themeVars(theme: 'dark' | 'light'): CSSProperties {
  return (theme === 'dark' ? DARK : LIGHT) as CSSProperties;
}

/** The product's three faces, declared by next/font in App.tsx. */
export const HEADING = 'font-[family-name:var(--font-kr-heading)]';
export const MONO = 'font-[family-name:var(--font-kr-mono)]';

/** The overline every Kairós panel opens with. */
export const OVERLINE = `${MONO} text-xs uppercase tracking-[0.25em]`;

/** Panel surface: obsidian card in the dark, a soft white gradient in the light. */
export const CARD =
  'rounded-2xl border border-[var(--k-line)] [background:var(--k-card)] [box-shadow:var(--k-card-shadow)]';

export const INSET = 'border border-[var(--k-line)] [background:var(--k-inset)]';

export const PRIMARY =
  'font-semibold text-[var(--k-primary-ink)] [background:var(--k-primary)] hover:[background:var(--k-primary-hover)]';

export const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]';

/** Category text colour, readable in either theme. */
export function catInk(category: string): string {
  return `var(--cat-${category})`;
}
