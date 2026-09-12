import { useCallback, useRef } from 'react';

interface UseResizableWidthOptions {
  value: number;
  onChange: (width: number) => void;
  min: number;
  max: number;
  /** When true, dragging right shrinks the panel instead of growing it (panel sits right-of-handle). */
  invert?: boolean;
}

/** Drag-to-resize handlers for a panel width controlled by the caller (store or local state). */
export function useResizableWidth({ value, onChange, min, max, invert = false }: UseResizableWidthOptions) {
  const startX = useRef(0);
  const startWidth = useRef(value);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = value;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const handleMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX.current;
        const next = startWidth.current + (invert ? -delta : delta);
        onChange(Math.min(max, Math.max(min, next)));
      };
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [value, min, max, invert, onChange]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 16;
      if (e.key === 'ArrowLeft') onChange(Math.max(min, value + (invert ? step : -step)));
      else if (e.key === 'ArrowRight') onChange(Math.min(max, value + (invert ? -step : step)));
    },
    [min, max, invert, value, onChange]
  );

  return { onPointerDown, onKeyDown };
}
