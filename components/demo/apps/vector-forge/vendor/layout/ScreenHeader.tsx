import React, { memo } from 'react';
import styles from './ScreenHeader.module.css';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}

export const ScreenHeader = memo(function ScreenHeader({ title, subtitle, eyebrow, actions }: ScreenHeaderProps) {
  return (
    <div className={styles.root}>
      <div className={styles.left}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title} tabIndex={-1}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
});
