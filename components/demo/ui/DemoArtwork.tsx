'use client';

import { hueFrom, initials } from '@/lib/demo/format';

/**
 * Imagery for the demos, drawn rather than downloaded.
 *
 * ─── Why no photographs ───────────────────────────────────────────────────
 * Three of these products are about people — a salon's stylists, a directory
 * of psychologists, a dating app — and two are about pictures. The honest
 * options for their imagery were a stock library or nothing, and a stock photo
 * of a real person captioned with an invented name and an invented
 * qualification is exactly the kind of fabricated record the demos must not
 * contain (§7). Every face and every gallery tile here is therefore obviously
 * synthetic: a deterministic mark derived from the fixture's own name.
 *
 * ─── And why that is also the fast answer (§12) ───────────────────────────
 * These are a few hundred bytes of SVG generated at render time. The demos add
 * no image requests at all, nothing to lazy-load, nothing to compress, and
 * nothing that can 404 — which is most of the asset-optimisation problem
 * solved by not creating it.
 *
 * Determinism: both components derive everything from the `seed` string, so
 * the same person has the same portrait on every render, in every scenario,
 * before and after a reset.
 */

/** A person, as a monogram on a stable colour. */
export function DemoAvatar({
  name,
  size = 40,
  square = false,
}: {
  name: string;
  size?: number;
  /** Squared corners follow the surface radius instead of a circle. */
  square?: boolean;
}) {
  const hue = hueFrom(name);

  return (
    <span
      aria-hidden='true'
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        borderRadius: square ? 'var(--d-radius)' : '9999px',
        background: `linear-gradient(145deg, oklch(0.72 0.11 ${hue}), oklch(0.55 0.13 ${(hue + 42) % 360}))`,
        color: 'oklch(0.99 0.01 0)',
      }}
      className='inline-flex items-center justify-center font-semibold tracking-wide shrink-0 select-none'
    >
      {initials(name)}
    </span>
  );
}

/**
 * A picture-shaped tile: a gallery frame, a product shot, a venue image.
 *
 * The composition varies with the seed — bands, arcs and a grain field — so a
 * grid of them reads as a set of distinct images rather than as one repeated
 * placeholder, without any of them pretending to be a photograph.
 */
export function DemoArtwork({
  seed,
  className = '',
  label,
}: {
  seed: string;
  className?: string;
  /** Rarely needed: the tile is decorative wherever a caption names it. */
  label?: string;
}) {
  const hue = hueFrom(seed);
  const hue2 = (hue + 55) % 360;
  const variant = hueFrom(`${seed}:v`) % 3;

  return (
    <svg
      viewBox='0 0 120 120'
      preserveAspectRatio='xMidYMid slice'
      className={`block w-full h-full ${className}`}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={`g-${seed}`} x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor={`oklch(0.62 0.13 ${hue})`} />
          <stop offset='100%' stopColor={`oklch(0.34 0.09 ${hue2})`} />
        </linearGradient>
      </defs>

      <rect width='120' height='120' fill={`url(#g-${seed})`} />

      {variant === 0 && (
        <g fill='none' stroke='white' strokeOpacity='0.22' strokeWidth='1.2'>
          {[18, 34, 50, 66, 82, 98].map((y) => (
            <path key={y} d={`M-5 ${y} Q 60 ${y - 22}, 125 ${y}`} />
          ))}
        </g>
      )}

      {variant === 1 && (
        <g stroke='white' strokeOpacity='0.24' fill='none'>
          <circle cx='60' cy='58' r='38' strokeWidth='1.4' />
          <circle cx='60' cy='58' r='24' strokeWidth='1.4' />
          <circle cx='60' cy='58' r='11' strokeWidth='1.4' />
          <path d='M0 96 L120 96' strokeWidth='1.2' />
        </g>
      )}

      {variant === 2 && (
        <g fill='white' fillOpacity='0.16'>
          <rect x='12' y='16' width='34' height='88' />
          <rect x='54' y='38' width='20' height='66' />
          <rect x='82' y='24' width='26' height='80' />
        </g>
      )}

      {/* A soft vignette, so text laid over a tile stays readable. */}
      <rect
        width='120'
        height='120'
        fill='black'
        fillOpacity='0.12'
        style={{ mixBlendMode: 'multiply' }}
      />
    </svg>
  );
}
