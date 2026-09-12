import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  pct: number;
  variant?: 'accent' | 'danger' | 'success';
  indeterminate?: boolean;
  width?: number;
}

export function ProgressBar({ pct, variant = 'accent', indeterminate, width }: ProgressBarProps) {
  return (
    <div
      className={`${styles.track} ${indeterminate ? styles.indeterminate : ''}`}
      style={width ? { width } : undefined}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`${styles.fill} ${styles[variant]}`}
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
