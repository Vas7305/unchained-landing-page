import type { ElementType, ReactNode } from "react";

import styles from "./Metadata.module.css";

interface MetadataProps {
  children: ReactNode;
  as?: ElementType;
  /** `muted` for supporting information, `strong` for section markers. */
  tone?: "default" | "muted";
  className?: string;
  id?: string;
}

/**
 * The brand's small uppercase tracked label (Brand Identity §15).
 * Used for dates, roles, section markers and category labels — never for
 * anything long enough to become a paragraph.
 */
export function Metadata({
  children,
  as: Tag = "p",
  tone = "default",
  className,
  id,
}: MetadataProps) {
  return (
    <Tag
      id={id}
      className={[styles.meta, styles[tone], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
