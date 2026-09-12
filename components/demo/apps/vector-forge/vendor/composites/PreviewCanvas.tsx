import React from 'react';
import { ImageOff } from 'lucide-react';
import type { ZoomLevel } from '../types';
import { Skeleton } from '../primitives/Skeleton';
import styles from './PreviewCanvas.module.css';

interface PreviewCanvasProps {
  kind: 'source' | 'vector' | 'before-after';
  zoom: ZoomLevel;
  state: 'empty' | 'loading' | 'loaded' | 'error';
  children?: React.ReactNode;
  label?: string;
}

export function PreviewCanvas({ zoom, state, children, label }: PreviewCanvasProps) {
  return (
    <div className={styles.root}>
      {label && <span className={styles.label}>{label}</span>}

      {state === 'loading' && (
        <Skeleton width="80%" height="80%" radius={8} />
      )}

      {state === 'empty' && (
        <div className={styles.empty} aria-label="No content">
          <span className={styles.emptyIcon} aria-hidden="true">
            <ImageOff size={32} strokeWidth={1} />
          </span>
          <span className={styles.emptyText}>Drop an image to begin</span>
        </div>
      )}

      {state === 'error' && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ImageOff size={32} strokeWidth={1} />
          </span>
          <span className={styles.emptyText}>Preview unavailable</span>
        </div>
      )}

      {state === 'loaded' && (
        <div
          className={styles.inner}
          style={{ zoom: zoom / 100 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
