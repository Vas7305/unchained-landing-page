import React from 'react';
import styles from './ModeCard.module.css';

interface ModeCardProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}

export function ModeCard({ icon, label, desc, active, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${active ? styles.active : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className={styles.header}>
        <span aria-hidden="true">{icon}</span>
        <span className={styles.label}>{label}</span>
      </div>
      <p className={styles.desc}>{desc}</p>
    </button>
  );
}
