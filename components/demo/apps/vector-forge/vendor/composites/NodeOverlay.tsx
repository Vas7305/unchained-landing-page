interface NodeOverlayProps {
  visible: boolean;
  points: [number, number][];
}

export function NodeOverlay({ visible, points }: NodeOverlayProps) {
  if (!visible || points.length === 0) return null;

  // Cap render at 2000 points to avoid DOM pressure (H-PERF-01 partial mitigation)
  const capped = points.length > 2000 ? points.slice(0, 2000) : points;

  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {capped.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="var(--accent-500)" fillOpacity={0.85} />
      ))}
    </svg>
  );
}
