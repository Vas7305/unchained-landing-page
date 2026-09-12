import { useId } from 'react';
import styles from './Switch.module.css';

type SwitchProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
} & ({ label: string; ariaLabel?: never } | { ariaLabel: string; label?: never });

export function Switch({ checked, onChange, disabled, ...rest }: SwitchProps) {
  const id = useId();
  const labelText = 'label' in rest ? rest.label : undefined;
  const ariaLabel = 'ariaLabel' in rest ? rest.ariaLabel : undefined;

  return (
    <label className={`${styles.wrap} ${disabled ? styles.disabled : ''}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {labelText && <span className={styles.label}>{labelText}</span>}
    </label>
  );
}
