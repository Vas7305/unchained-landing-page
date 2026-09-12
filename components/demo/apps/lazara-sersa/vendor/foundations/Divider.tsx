import styles from "./Divider.module.css";

interface DividerProps {
  /** `strong` is used where a rule must separate two dense blocks. */
  weight?: "hairline" | "strong";
  className?: string;
}

/**
 * A 1px rule (Brand Identity §34). Organises information — never decorates.
 * Colour follows the surrounding surface automatically.
 */
export function Divider({ weight = "hairline", className }: DividerProps) {
  return (
    <hr
      className={[styles.divider, styles[weight], className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
