/* ===========================================================================
   PRESS CONTENT

   ⚠ INTENTIONALLY EMPTY.
   No verified press exists yet. "Empty prestige is worse than no prestige"
   (Brand Positioning §33) and fabricating publications is a hard prohibition
   (Press Kit §54). While this array holds no verified entry the section does
   not exist publicly at all: no nav link, no sitemap row, and /press answers
   404. Adding one restores all three — see README, "Add a press entry".
   =========================================================================== */

import type { PressEntry } from "./types";

export const press: PressEntry[] = [];

/** Only verified entries are ever published. */
export function getPublishedPress(): PressEntry[] {
  return press.filter((entry) => entry.status === "verified");
}

export function hasPublishedPress(): boolean {
  return getPublishedPress().length > 0;
}
