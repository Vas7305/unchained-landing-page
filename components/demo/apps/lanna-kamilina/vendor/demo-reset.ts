/**
 * Putting the salon back the way it was found.
 *
 * ─── Why this file has to exist ───────────────────────────────────────────
 * Most demos in this repository reset by remounting: the shell changes the
 * React `key` and the whole tree is rebuilt from its initial state.
 *
 * This one holds state that is not in the tree. The appointment book in
 * `features/booking/schedule.ts` is a module-level `cache` over a module-level
 * store, exactly as it is in the product — that is what lets a booking made on
 * one screen disappear from the calendar on another. A module singleton
 * survives every remount the shell can perform, so without this, pressing
 * Reset would rebuild the components around a calendar that still had the
 * previous visitor's appointment blocked out of it.
 *
 * `resetSchedule` lives next to the book it clears, because that is the only
 * place that knows what "empty" means for it. This module is the list, and the
 * list is deliberately short: everything else in this demo really is in the
 * tree, and really does come back clean on its own.
 */

import { resetSchedule } from './features/booking/schedule';

export function resetDemoStores(): void {
  resetSchedule();
}
