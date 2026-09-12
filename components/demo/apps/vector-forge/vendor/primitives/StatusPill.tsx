import styles from './StatusPill.module.css';

interface StatusPillProps {
  text: string;
  color: string;
  pulse: boolean;
}

export function StatusPill({ text, color, pulse }: StatusPillProps) {
  return (
    <div className={styles.pill}>
      <span
        className={`${styles.dot} ${pulse ? styles.pulse : ''}`}
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className={styles.text}>{text}</span>
    </div>
  );
}
