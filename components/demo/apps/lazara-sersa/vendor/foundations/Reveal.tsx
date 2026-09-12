"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

import styles from "./Reveal.module.css";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  /** Stagger in milliseconds, for sequences of sibling items. */
  delay?: number;
  /**
   * `image` is the treatment for photography: the same fade and rise, plus a
   * barely-perceptible settle from under-size, so the print appears to be laid
   * onto the page along with its shadow. Type keeps the plain `default`.
   */
  variant?: "default" | "image";
  className?: string;
}

/**
 * Editorial entrance: a slow fade with a slight vertical rise
 * (Brand Identity §53). No parallax, no bounce.
 *
 * Content is always present in the DOM. The hidden start state is defined in
 * CSS and is disabled for `prefers-reduced-motion` and for no-JS environments,
 * so the page is never blank for anyone.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  variant = "default",
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // `prefers-reduced-motion` needs no branch here: the stylesheet already
    // pins the reveal to its final state for those users.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      // Fire slightly before the block reaches the fold so the reveal has
      // finished by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={[
        styles.reveal,
        variant === "image" ? styles.image : null,
        isVisible ? styles.visible : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
