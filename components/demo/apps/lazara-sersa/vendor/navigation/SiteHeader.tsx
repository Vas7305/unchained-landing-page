"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { Container } from "../layout/Container";
import { primaryNav, site } from "../content/site";

import { DirectionalLink } from "./DirectionalLink";
import styles from "./SiteHeader.module.css";

/**
 * How far the page must move before the bar lifts off the page.
 * Deliberately tiny: the change should read as a response to scrolling at all,
 * not as a threshold the visitor has to cross.
 */
const SCROLL_THRESHOLD = 12;

/**
 * The header is re-mounted on every route change, so its first client render
 * always starts from the server's `false`. Correcting that in `useEffect`
 * lands *after* the browser has painted, which is a visible one-frame flicker
 * of the un-scrolled bar on any navigation that restores a scroll position.
 * A layout effect corrects it before that paint. It never runs on the server —
 * the ternary only exists to keep React from warning about that.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The only route whose hero has to start at y=0, so the bar is lifted onto it
 * rather than sitting above it (Brand Identity §39).
 */
const OVERLAY_ROUTE = "/";

interface SiteHeaderProps {
  /**
   * Colouring, kept separate from positioning: an overlaid header sits on
   * light paper on the homepage but would need `inverse` over a dark
   * photograph. Positioning and tone are not the same decision.
   */
  tone?: "primary" | "inverse";
}

export function SiteHeader({ tone = "primary" }: SiteHeaderProps) {
  const pathname = usePathname();
  /* Derived, not passed. The header renders once in the root layout now, so
     there is no per-page caller left to tell it which mode to be in. */
  const overlay = pathname === OVERLAY_ROUTE;
  const [isScrolled, setIsScrolled] = useState(false);

  /**
   * The bar is a solid colour at every scroll position; what this state adds is
   * the glow that lifts it off the content passing behind it. Reads are batched
   * into a frame so a fast scroll cannot queue up a layout read per event.
   */
  useIsomorphicLayoutEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    // Restored sessions and hash links can land mid-page before the first
    // scroll event ever fires.
    measure();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={[
        styles.header,
        overlay ? styles.overlay : null,
        /* Global, not a module class: transitions.css needs to name this
           element's snapshot so it holds still while the page slides under
           it. Safe because the header renders once, in the root layout. */
        "site-header-anchor",
      ]
        .filter(Boolean)
        .join(" ")}
      data-surface={tone === "inverse" ? "inverse" : undefined}
      data-scrolled={isScrolled ? "true" : undefined}
    >
      <Container className={styles.inner}>
        <DirectionalLink href="/" className={styles.wordmark}>
          <span className={styles.wordmarkName}>{site.wordmark}</span>
          <span className="visually-hidden">— {site.descriptor}, home</span>
        </DirectionalLink>

        <nav aria-label="Primary">
          <ul className={styles.nav}>
            {primaryNav.map((item) => (
              <li key={item.href}>
                <DirectionalLink
                  href={item.href}
                  className={styles.navLink}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </DirectionalLink>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
