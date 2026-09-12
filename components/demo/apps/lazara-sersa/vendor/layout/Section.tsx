import type { ReactNode } from "react";

import styles from "./Section.module.css";

type SectionSurface = "primary" | "secondary" | "tertiary" | "inverse";
type SectionRhythm = "tight" | "default" | "loose" | "none";

interface SectionProps {
  children: ReactNode;
  /** Surface tokens cascade to descendants — see base.css. */
  surface?: SectionSurface;
  /** Vertical rhythm. Fluid, so mobile keeps editorial breathing room. */
  rhythm?: SectionRhythm;
  id?: string;
  className?: string;
  ariaLabelledBy?: string;
  ariaLabel?: string;
}

/** A page band. Owns vertical rhythm and surface; never horizontal layout. */
export function Section({
  children,
  surface = "primary",
  rhythm = "default",
  id,
  className,
  ariaLabelledBy,
  ariaLabel,
}: SectionProps) {
  return (
    <section
      id={id}
      data-surface={surface === "primary" ? undefined : surface}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={[styles.section, styles[rhythm], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
