/**
 * Preference persistence, adapted for the demo.
 *
 * The product writes `preferences.json` through the Tauri store plugin. A demo
 * keeps nothing: the whole point of the Reset control is that the next visitor
 * — or the same visitor a minute later — meets the application in the state
 * its author intended, and a preference surviving that would undermine it.
 *
 * So loading returns nothing and saving is a no-op, and the store above falls
 * back to its own `DEFAULTS`. This is also the isolation boundary: there is no
 * storage of any kind behind this module, so nothing a visitor does here can
 * outlive the tab.
 */

import type { UserPreferences } from '../types';

export async function loadPreferences(): Promise<Partial<UserPreferences>> {
  return {};
}

export async function savePreferences(_prefs: UserPreferences): Promise<void> {
  void _prefs;
}
