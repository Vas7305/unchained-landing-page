import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The full Unchained Business wordmark, as drawn on every share card.
 *
 * The same file the navbar and footer show, so a link preview carries the
 * brand exactly as the site does. It is white and greige on transparent, which
 * is why both cards keep a black background.
 */
export const OG_LOGO_SIZE = { width: 1000, height: 297 } as const;

/** Read once per process: it is the same on every card. */
export const ogLogoSrc = readFile(
  join(process.cwd(), 'public', 'unchained-business-logo.png'),
).then((logo) => `data:image/png;base64,${logo.toString('base64')}`);

/** The logo's height at a given width, keeping its proportions. */
export function ogLogoHeight(width: number): number {
  return Math.round((width * OG_LOGO_SIZE.height) / OG_LOGO_SIZE.width);
}
