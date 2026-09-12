import React from 'react';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  children?: React.ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Options panel">
      <div className={styles.inner}>
        {children ?? (
          <div className={styles.empty}>
            <span className={styles.emptyText}>No options</span>
          </div>
        )}
      </div>
    </aside>
  );
}
