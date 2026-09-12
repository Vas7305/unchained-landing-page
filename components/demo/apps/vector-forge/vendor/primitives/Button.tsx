import React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  label: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** @deprecated use iconLeft */
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick: () => void;
}

export function Button({ variant, size = 'md', label, iconLeft, iconRight, icon, loading, disabled, fullWidth, onClick }: ButtonProps) {
  const leftIcon = iconLeft ?? icon;
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${loading ? styles.loading : ''} ${fullWidth ? styles.fullWidth : ''}`}
      disabled={disabled || loading}
      onClick={onClick}
      type="button"
      aria-busy={loading}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : leftIcon ? (
        <span className={styles.icon} aria-hidden="true">{leftIcon}</span>
      ) : null}
      <span>{label}</span>
      {!loading && iconRight && (
        <span className={styles.icon} aria-hidden="true">{iconRight}</span>
      )}
    </button>
  );
}
