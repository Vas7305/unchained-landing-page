import type { ElementType, ReactNode } from "react";

import styles from "./Container.module.css";

type ContainerWidth = "default" | "narrow" | "full";

interface ContainerProps {
  children: ReactNode;
  /** `full` keeps the page gutter but removes the max-width cap. */
  width?: ContainerWidth;
  as?: ElementType;
  className?: string;
  id?: string;
}

/**
 * Horizontal page frame: max-width cap plus the responsive page gutter.
 * Every page-level block sits inside one of these so margins stay systematic.
 */
export function Container({
  children,
  width = "default",
  as: Tag = "div",
  className,
  id,
}: ContainerProps) {
  return (
    <Tag
      id={id}
      className={[styles.container, styles[width], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
