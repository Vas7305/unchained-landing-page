import { useState } from 'react';
import type { ImageRef } from '../types';
import { cn, hashString } from '../lib/utils';
import { IS_DEMO_CONTENT } from '../data/business';

/**
 * The image layer.
 *
 * Real photography does not exist yet, and a site full of grey boxes cannot be
 * design-reviewed. So every `ImageRef` without a `src` renders a deterministic,
 * on-brand composition derived from its seed: stable across reloads, correctly
 * proportioned, and immediately replaceable by dropping a `src` into the data.
 *
 * A broken real image falls back to the same placeholder rather than to the
 * browser's default, so a missing file never breaks a layout.
 */

export type AspectRatio = 'portrait' | 'landscape' | 'square' | 'wide' | 'tall';

const ASPECT: Record<AspectRatio, string> = {
  portrait: '3 / 4',
  landscape: '4 / 3',
  square: '1 / 1',
  wide: '16 / 9',
  tall: '2 / 3',
};

/** Warm, muted pairs. Nothing here should read as "stock gradient". */
const PALETTE: Array<[string, string]> = [
  ['#e9e1d5', '#cdbca8'],
  ['#e4dbd0', '#bfa993'],
  ['#ded5c8', '#b6a48e'],
  ['#eee7dc', '#d3c3ae'],
  ['#e2d8cd', '#c2ab97'],
  ['#e7ded1', '#b9a78f'],
];

interface PlaceholderArtProps {
  seed: string;
  className?: string;
}

function PlaceholderArt({ seed, className }: PlaceholderArtProps) {
  const hash = hashString(seed);
  const [from, to] = PALETTE[hash % PALETTE.length];
  const angle = 25 + (hash % 7) * 14;
  const cx = 22 + (hash % 5) * 13;
  const cy = 26 + ((hash >> 3) % 5) * 11;
  const r = 26 + ((hash >> 5) % 4) * 7;

  return (
    <svg
      className={cn('h-full w-full', className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`g-${hash}`} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`r-${hash}`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#g-${hash})`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#r-${hash})`} />
      <path
        d={`M0 ${70 + (hash % 12)} Q 50 ${45 + ((hash >> 2) % 25)} 100 ${62 + ((hash >> 4) % 16)} L100 100 L0 100 Z`}
        fill="#191512"
        opacity="0.05"
      />
    </svg>
  );
}

export interface FigureProps {
  image?: ImageRef;
  ratio?: AspectRatio;
  className?: string;
  /** Above-the-fold images skip lazy loading so the hero is not delayed. */
  priority?: boolean;
  /** Rendered over the image — captions, tags, gradient scrims. */
  children?: React.ReactNode;
  /** Slow zoom on hover for interactive cards. Off by default. */
  hoverZoom?: boolean;
  sizes?: string;
}

export function Figure({
  image,
  ratio = 'portrait',
  className,
  priority = false,
  children,
  hoverZoom = false,
  sizes,
}: FigureProps) {
  const [failed, setFailed] = useState(false);
  const seed = image?.seed ?? image?.alt ?? 'lanna-kamilina';
  const showPlaceholder = !image?.src || failed;

  return (
    <div
      className={cn('relative overflow-hidden bg-paper-2', className)}
      style={{ aspectRatio: ASPECT[ratio] }}
    >
      {showPlaceholder ? (
        <>
          <PlaceholderArt
            seed={seed}
            className={cn(
              'transition-transform duration-[900ms] ease-[var(--ease-editorial)]',
              hoverZoom && 'group-hover:scale-[1.04]',
            )}
          />
          {/* The alt text still has to reach assistive tech. */}
          <span className="sr-only">{image?.alt ?? ''}</span>
          {IS_DEMO_CONTENT && (
            <span
              aria-hidden="true"
              className="lk-type-meta absolute bottom-2 right-2 rounded-lk-xs bg-lk-paper/70 px-1.5 py-0.5 text-[0.625rem] tracking-[0.14em] text-lk-muted uppercase"
            >
              фото
            </span>
          )}
        </>
      ) : (
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-editorial)]',
            hoverZoom && 'group-hover:scale-[1.04]',
          )}
        />
      )}
      {children}
    </div>
  );
}

/** Bottom-up scrim so white text stays legible over any image. */
export function Scrim({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent',
        className,
      )}
    />
  );
}
