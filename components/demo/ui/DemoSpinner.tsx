/**
 * The demo system's pending indicator.
 *
 * `aria-hidden`, always: it never carries the message on its own. Whatever it
 * is spinning inside says what is happening — a button sets `aria-busy`, a
 * panel pairs it with a <DemoStatus> live region — because a screen reader
 * user learns nothing from an announced rotating circle.
 *
 * The spin is a CSS animation, so globals.css's `prefers-reduced-motion` rule
 * flattens it along with everything else on the site rather than this file
 * needing its own media query.
 */
export default function DemoSpinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      aria-hidden='true'
      className='animate-spin shrink-0'
    >
      <circle
        cx='8'
        cy='8'
        r='6.5'
        stroke='currentColor'
        strokeWidth='2'
        opacity='0.25'
      />
      <path
        d='M8 1.5a6.5 6.5 0 0 1 6.5 6.5'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  );
}
