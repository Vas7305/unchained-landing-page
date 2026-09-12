import Link from "next/link";

import { categoryLabel } from "./projects";
import type { ProjectCategory } from "./types";

import styles from "./CategoryFilter.module.css";

interface CategoryFilterProps {
  categories: ProjectCategory[];
  /** `undefined` means "Selected Work" — the unfiltered overview. */
  active?: ProjectCategory;
  /**
   * DEMO ADAPTATION. In the product each tab is a real URL, so every filtered
   * view is shareable and server-rendered. Inside the demo there is no route to
   * push, so the caller passes a handler and the tabs become buttons carrying
   * the identical class contract. Everything else — the markup, the ordering,
   * the "Selected Work" entry, `aria-current`, `data-active` — is unchanged.
   */
  onSelect?: (category: ProjectCategory | undefined) => void;
}

/**
 * Discipline filter. Text links, not pills (Brand Identity §37) — and real
 * URLs, so every filtered view is shareable and server-rendered rather than
 * hidden behind client state.
 *
 * Only categories that have work behind them are passed in.
 */
export function CategoryFilter({
  categories,
  active,
  onSelect,
}: CategoryFilterProps) {
  if (categories.length === 0) return null;

  const entries = [
    { key: "all", label: "Selected Work", href: "/work", value: undefined },
    ...categories.map((category) => ({
      key: category,
      label: categoryLabel(category),
      href: `/work?category=${category}`,
      value: category as ProjectCategory | undefined,
    })),
  ];

  return (
    <nav aria-label="Filter work by discipline" className={styles.wrapper}>
      <ul className={styles.list}>
        {entries.map((entry) => {
          const isActive = entry.key === (active ?? "all");

          return (
            <li key={entry.key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(entry.value)}
                  className={styles.tab}
                  aria-current={isActive ? "true" : undefined}
                  data-active={isActive ? "true" : undefined}
                >
                  {entry.label}
                </button>
              ) : (
                <Link
                  href={entry.href}
                  className={styles.tab}
                  aria-current={isActive ? "true" : undefined}
                  data-active={isActive ? "true" : undefined}
                >
                  {entry.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
