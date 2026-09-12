import type { ImageRef } from '../types';

/**
 * Real photography.
 *
 * The shoot lives in `public/Lanna Kamilina/` — `Clientes/` for finished looks,
 * `Before-after/` for matched pairs — under numeric filenames, which say nothing
 * about what is in the frame. This module is the one place that translates a
 * file into a described image: every consumer imports a named `ImageRef` and
 * never a path, so re-shooting a look means editing one line here instead of
 * hunting through sections and catalogue data.
 *
 * Intrinsic dimensions are recorded so the browser can reserve the box before
 * the bytes arrive — `Figure` still fixes the aspect ratio, but width/height
 * keep the image itself from being the thing that shifts.
 */

const DIR = '/Lanna%20Kamilina/Clientes';
const PAIRS_DIR = '/Lanna%20Kamilina/Before-after';

function photo(file: string, alt: string, width: number, height: number): ImageRef {
  return { src: `${DIR}/${file}`, alt, width, height };
}

function pairPhoto(file: string, alt: string, width: number, height: number): ImageRef {
  return { src: `${PAIRS_DIR}/${file}`, alt, width, height };
}

/** Front-facing, warm, a full look — the strongest single frame we have. */
export const heroPortrait = photo(
  '1.png',
  'Клиентка салона Lanna Kamilina: мягкие волны и дневной макияж',
  434,
  542,
);

/** Cropped square in the hero. Close work, shown close. */
export const heroDetail = photo(
  '6.png',
  'Крупный план: растушёвка теней во время макияжа',
  434,
  541,
);

export const bridalWaves = photo(
  '2.png',
  'Свадебный образ: голливудская волна и кружевное платье',
  407,
  542,
);

export const dayMakeup = photo(
  '3.png',
  'Нанесение дневного макияжа: ровный тон и естественный акцент',
  352,
  542,
);

export const balayageLength = photo(
  '4.png',
  'Тёплый балаяж на длинных волосах: мягкая растяжка цвета по длине',
  345,
  544,
);

export const mensCut = photo(
  '5.png',
  'Мужская классическая стрижка с укладкой',
  371,
  355,
);

export const eveningLook = photo(
  '7.png',
  'Вечерний образ: локоны, красная помада и чёрное платье',
  361,
  543,
);

/* ------------------------------------------------------------ before/after */

/**
 * A real matched pair: same person, same sweater, same light, same distance.
 * Only the work changed, which is exactly what makes the slider worth pulling.
 *
 * The day-makeup "before" is a re-crop (`1-aligned.png`), not the camera
 * original. She leaned in between the two frames, so her face landed ~6%
 * larger and ~3% lower in the "after" — enough that dragging the slider slid
 * her eye and lip line out from under themselves and read as two different
 * photos. `1-aligned.png` re-frames the "before" onto the "after"'s window, so
 * the seam lands on the same face. Re-shoot the pair and the crop has to be
 * recomputed; do not point this back at the uncropped `1.png`.
 */

export const dayMakeupBefore = pairPhoto(
  '1-aligned.png',
  'До: лицо без макияжа и неуложенные волосы',
  1009,
  1385,
);

export const dayMakeupAfter = pairPhoto(
  '2.jpeg',
  'После: дневной макияж — ровный тон, акцент на глаза и губы — и мягкая укладка',
  786,
  1080,
);

export const curlsBefore = pairPhoto(
  '3.png',
  'До: пушистые волосы без формы и лицо без макияжа',
  1082,
  1353,
);

export const curlsAfter = pairPhoto(
  '4.png',
  'После: крупные мягкие локоны с прикорневым объёмом и вечерний макияж',
  434,
  542,
);

export const eveningBefore = pairPhoto(
  '5.png',
  'До: лицо без макияжа и волосы, уложенные мягкой волной',
  1083,
  1453,
);

/**
 * `-clean`, not the camera original: the shoot had a decorative four-point
 * sparkle stamped over her shoulder, which reads as a watermark next to real
 * work. It is painted out — the sparkle sat on smooth, out-of-focus skin, so
 * the patch is a harmonic fill from the surrounding gradient plus matched
 * grain, and nothing outside that ~50px area is touched. Re-export `6.jpeg`
 * and the retouch has to be redone; do not point this back at it.
 */
export const eveningAfter = pairPhoto(
  '6-clean.jpeg',
  'После: вечерний макияж с красной помадой и акцентом на глаза, локоны уложены набок',
  805,
  1080,
);
