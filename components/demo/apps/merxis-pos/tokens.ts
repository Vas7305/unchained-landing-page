/**
 * Style values the Merxis screens share. Kept apart from ui.tsx so that file
 * exports only components, which is what lets Fast Refresh keep their state.
 */

export const radius = { borderRadius: 'var(--d-radius)' } as const;

/** The product's income green. */
export const INCOME = 'var(--d-positive)';
