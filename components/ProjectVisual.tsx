/**
 * Deterministic, monochrome system diagram used in place of stock imagery.
 * The node layout is derived from the project slug, so every project gets a
 * distinct — but consistently restrained — visual signature.
 */

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export default function ProjectVisual({
  slug,
  density = 'compact',
}: {
  slug: string;
  density?: 'compact' | 'full';
}) {
  const uid = `${slug}-${density}`;
  const seed = hash(slug);
  const count = density === 'full' ? 9 : 6;

  const nodes = Array.from({ length: count }, (_, i) => {
    const n = seed + i * 977;
    return {
      x: 12 + ((n % 76) / 100) * 100,
      y: 14 + (((n >> 5) % 72) / 100) * 100,
      r: 2 + ((n >> 9) % 3),
    };
  });

  return (
    <svg
      viewBox='0 0 120 120'
      className='w-full h-full'
      role='presentation'
      aria-hidden='true'
      preserveAspectRatio='xMidYMid slice'
    >
      <defs>
        <pattern
          id={`grid-${uid}`}
          width='12'
          height='12'
          patternUnits='userSpaceOnUse'
        >
          <path
            d='M 12 0 L 0 0 0 12'
            fill='none'
            stroke='currentColor'
            strokeWidth='0.35'
            opacity='0.18'
          />
        </pattern>
      </defs>

      <rect width='120' height='120' fill={`url(#grid-${uid})`} />

      {nodes.slice(0, -1).map((node, i) => {
        const next = nodes[i + 1];
        return (
          <line
            key={`edge-${i}`}
            x1={node.x}
            y1={node.y}
            x2={next.x}
            y2={next.y}
            stroke='currentColor'
            strokeWidth='0.5'
            opacity='0.28'
          />
        );
      })}

      {nodes.map((node, i) => (
        <circle
          key={`node-${i}`}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill='currentColor'
          opacity={i === 0 ? 0.6 : 0.32}
        />
      ))}
    </svg>
  );
}
