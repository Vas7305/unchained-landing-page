import type { CSSProperties, ElementType, ReactNode } from "react";

import styles from "./Grid.module.css";

interface GridProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Vertical gap between rows. Column gap is always the brand gutter. */
  rowGap?: "gutter" | "loose" | "editorial";
}

/**
 * The editorial grid: 12 columns on desktop, 8 on tablet, 4 on mobile
 * (Brand Identity §19). The grid is structural discipline — it is never
 * rendered visibly, and items are expected to break its symmetry.
 */
export function Grid({
  children,
  as: Tag = "div",
  className,
  rowGap = "gutter",
}: GridProps) {
  return (
    <Tag
      className={[styles.grid, styles[`gap-${rowGap}`], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

interface GridItemProps {
  children: ReactNode;
  /** Columns occupied on desktop, out of 12. Defaults to full width. */
  span?: number;
  /** Columns occupied on tablet, out of 8. Derived from `span` when omitted. */
  spanMd?: number;
  /** 1-based desktop start column, for deliberate asymmetry. */
  start?: number;
  as?: ElementType;
  className?: string;
}

/** Tablet fallback: wide desktop items stay wide, narrow ones become halves. */
function deriveTabletSpan(span: number): number {
  if (span >= 7) return 8;
  if (span >= 4) return 4;
  return 3;
}

export function GridItem({
  children,
  span = 12,
  spanMd,
  start,
  as: Tag = "div",
  className,
}: GridItemProps) {
  const style = {
    "--span-lg": span,
    "--span-md": spanMd ?? deriveTabletSpan(span),
    ...(start ? { "--start-lg": start } : {}),
  } as CSSProperties;

  return (
    <Tag
      className={[styles.item, start ? styles.positioned : null, className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {children}
    </Tag>
  );
}
