/**
 * The brand lockup, inlined.
 *
 * ─── Why this file diverges ───────────────────────────────────────────────
 * The product imports three SVG files and renders whichever one the props ask
 * for through an `<img src>`. Vite resolves such an import to a URL; Next's
 * bundler resolves it to a static-image object, so the same line would hand
 * `<img>` an object and render nothing.
 *
 * Rather than add a loader to the site's build for one asset, the artwork is
 * inlined below — copied out of `src/assets/brand/lockup/*.svg` verbatim, the
 * same three files, the same paths, the same colours. The component keeps its
 * props and its behaviour; only the transport changed.
 *
 * Inlining also buys the demo something real: the mark inherits `currentColor`
 * nowhere and is drawn at whatever size the sidebar gives it, with no second
 * request and nothing to wait for on a page whose weight this repository
 * measures.
 */

import type { JSX } from 'react';

const LOCKUPS: Record<string, { viewBox: string; art: JSX.Element }> = {
  horizDark: {
    viewBox: '0 0 560 150',
    art: (
      <>
      <g transform="translate(20,19) scale(1.12)">
        <polygon points="50,7 88,28.5 88,71.5 50,93 12,71.5 12,28.5" fill="#0E2A24" stroke="#1FB896" strokeWidth="3"></polygon>
        <path d="M32,38 L50,66 L68,38" fill="none" stroke="#5BE0C0" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round"></path>
        <rect x="28.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B0F14" stroke="#5BE0C0" strokeWidth="2.4"></rect>
        <rect x="64.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B0F14" stroke="#5BE0C0" strokeWidth="2.4"></rect>
        <rect x="46.2" y="62.2" width="7.6" height="7.6" rx="1" fill="#5BE0C0"></rect>
        </g>
        <text x="132" y="81" fontFamily="var(--font-ui)" fontWeight="800" fontSize="58" letterSpacing="-1.5"><tspan fill="#ECF1F6">Vector</tspan><tspan fill="#5BE0C0">Forge</tspan></text>
        <text x="134" y="107" fontFamily="var(--font-mono)" fontWeight="500" fontSize="13" letterSpacing="4.4" fill="#7A8696">IMAGE → ASSET ENGINE</text>
      </>
    ),
  },
  horizLight: {
    viewBox: '0 0 560 150',
    art: (
      <>
      <g transform="translate(20,19) scale(1.12)">
        <polygon points="50,7 88,28.5 88,71.5 50,93 12,71.5 12,28.5" fill="#D8EFE9" stroke="#006D5B" strokeWidth="3"></polygon>
        <path d="M32,38 L50,66 L68,38" fill="none" stroke="#006D5B" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round"></path>
        <rect x="28.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#FFFFFF" stroke="#006D5B" strokeWidth="2.4"></rect>
        <rect x="64.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#FFFFFF" stroke="#006D5B" strokeWidth="2.4"></rect>
        <rect x="46.2" y="62.2" width="7.6" height="7.6" rx="1" fill="#006D5B"></rect>
        </g>
        <text x="132" y="81" fontFamily="var(--font-ui)" fontWeight="800" fontSize="58" letterSpacing="-1.5"><tspan fill="#0B0F14">Vector</tspan><tspan fill="#006D5B">Forge</tspan></text>
        <text x="134" y="107" fontFamily="var(--font-mono)" fontWeight="500" fontSize="13" letterSpacing="4.4" fill="#7A8696">IMAGE → ASSET ENGINE</text>
      </>
    ),
  },
  vertDark: {
    viewBox: '0 0 360 300',
    art: (
      <>
      <g transform="translate(125,18) scale(1.1)">
        <polygon points="50,7 88,28.5 88,71.5 50,93 12,71.5 12,28.5" fill="#0E2A24" stroke="#1FB896" strokeWidth="3"></polygon>
        <path d="M32,38 L50,66 L68,38" fill="none" stroke="#5BE0C0" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round"></path>
        <rect x="28.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B0F14" stroke="#5BE0C0" strokeWidth="2.4"></rect>
        <rect x="64.2" y="34.2" width="7.6" height="7.6" rx="1" fill="#0B0F14" stroke="#5BE0C0" strokeWidth="2.4"></rect>
        <rect x="46.2" y="62.2" width="7.6" height="7.6" rx="1" fill="#5BE0C0"></rect>
        </g>
        <text x="180" y="218" textAnchor="middle" fontFamily="var(--font-ui)" fontWeight="800" fontSize="46" letterSpacing="-1.1"><tspan fill="#ECF1F6">Vector</tspan><tspan fill="#5BE0C0">Forge</tspan></text>
        <text x="180" y="246" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="500" fontSize="12" letterSpacing="4" fill="#7A8696">IMAGE → ASSET ENGINE</text>
      </>
    ),
  },
};

export interface BrandLockupProps {
  orientation?: 'horizontal' | 'vertical';
  tone?: 'dark' | 'light';
  height?: number;
}

export function BrandLockup({
  orientation = 'horizontal',
  tone = 'dark',
  height = 40,
}: BrandLockupProps) {
  const key =
    orientation === 'vertical' ? 'vertDark' : tone === 'light' ? 'horizLight' : 'horizDark';
  const { viewBox, art } = LOCKUPS[key];
  const [, , width, boxHeight] = viewBox.split(' ').map(Number);

  return (
    <svg
      viewBox={viewBox}
      height={height}
      width={(height * width) / boxHeight}
      role="img"
      aria-label="VectorForge"
      fill="none"
    >
      {art}
    </svg>
  );
}
