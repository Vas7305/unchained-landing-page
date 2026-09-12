import { useId } from 'react';
import styles from './Input.module.css';

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  label?: string;
}

export function Input({ value, onChange, placeholder, error, disabled, label }: InputProps) {
  const id = useId();
  return (
    <div className={styles.wrap}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <input
        id={label ? id : undefined}
        className={`${styles.input} ${error ? styles.error : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error}
      />
    </div>
  );
}
