import { memo } from 'react';
import { Slider } from '../primitives/Slider';
import styles from './SliderRow.module.css';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  displayValue?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export const SliderRow = memo(function SliderRow({ label, value, min, max, step, unit, displayValue, onChange, disabled }: SliderRowProps) {
  const display = displayValue ?? (unit ? `${value}${unit}` : String(value));
  return (
    <div className={styles.row}>
      <Slider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        displayValue={display}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
});
