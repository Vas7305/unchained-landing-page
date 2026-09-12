import type { ReactNode } from "react";

import { Metadata } from "./Metadata";
import styles from "./TypographyBlock.module.css";

interface TypographyBlockProps {
  /** Small tracked label above the heading. */
  eyebrow?: string;
  heading?: ReactNode;
  /** Heading level. Pick for document outline, not for size. */
  headingLevel?: "h1" | "h2" | "h3";
  /** Visual size, decoupled from the semantic level. */
  headingSize?: "h1" | "h2" | "h3";
  /** Body paragraphs. Constrained to a comfortable measure. */
  body?: string | string[];
  headingId?: string;
  align?: "start" | "center";
  measure?: "narrow" | "default" | "wide";
  children?: ReactNode;
  className?: string;
}

/**
 * The standard way to introduce a section: eyebrow → serif heading → body.
 * Composition, not decoration, is what makes each instance feel different.
 */
export function TypographyBlock({
  eyebrow,
  heading,
  headingLevel = "h2",
  headingSize,
  body,
  headingId,
  align = "start",
  measure = "default",
  children,
  className,
}: TypographyBlockProps) {
  const Heading = headingLevel;
  const size = headingSize ?? headingLevel;
  const paragraphs = typeof body === "string" ? [body] : (body ?? []);

  return (
    <div
      className={[styles.block, styles[align], className]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? (
        <Metadata tone="muted" className={styles.eyebrow}>
          {eyebrow}
        </Metadata>
      ) : null}

      {heading ? (
        <Heading id={headingId} className={`${styles.heading} ${styles[size]}`}>
          {heading}
        </Heading>
      ) : null}

      {paragraphs.length > 0 ? (
        <div className={`${styles.body} ${styles[`measure-${measure}`]}`}>
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  );
}
