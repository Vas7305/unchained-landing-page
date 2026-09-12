import type { ContentStatus } from "../content/types";

import styles from "./StatusTag.module.css";

interface StatusTagProps {
  status: ContentStatus;
  className?: string;
}

/**
 * Content authenticity marker (Brand Identity §70). Verified work carries no
 * tag — it is the baseline. Everything else is labelled so a visitor can never
 * mistake a placeholder, concept or unconfirmed credit for client work.
 */
const labels: Partial<Record<ContentStatus, string>> = {
  placeholder: "Placeholder",
  pending: "Pending confirmation",
  conceptual: "Conceptual",
  personal: "Personal work",
};

export function StatusTag({ status, className }: StatusTagProps) {
  const label = labels[status];
  if (!label) return null;

  return (
    <span className={[styles.tag, className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );
}
