import React from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps {
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}

export function IconButton({ icon, title, disabled, onClick }: IconButtonProps) {
  return (
    <button
      className={styles.btn}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  );
}
