import React from 'react';
import styles from './Label.module.css';

interface LabelProps {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function Label({ htmlFor, required, children }: LabelProps) {
  return (
    <label className={styles.label} htmlFor={htmlFor}>
      {children}
      {required && <span className={styles.required} aria-hidden="true"> *</span>}
    </label>
  );
}
