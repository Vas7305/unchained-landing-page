import React from 'react';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  children?: React.ReactNode;
}

// DEMO DIVERGENCE — `role="complementary"` removed from the <aside> below: it
// is that element's implicit role, so the attribute only restated what the
// markup already meant. The accessible name stays.
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
