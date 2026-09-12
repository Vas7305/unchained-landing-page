import type { ReactNode } from "react";

import { DirectionalLink } from "../navigation/DirectionalLink";

import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";

interface BaseProps {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

interface LinkButtonProps extends BaseProps {
  href: string;
  /** Set for links leaving the site — adds rel/target and an a11y hint. */
  external?: boolean;
  onClick?: never;
  type?: never;
  ariaLabel?: string;
}

interface ActionButtonProps extends BaseProps {
  href?: undefined;
  external?: never;
  type?: "button" | "submit";
  onClick?: () => void;
  ariaLabel?: string;
  /** Set on a control that opens a dialog, so the fact is announced first. */
  ariaHasPopup?: "dialog";
}

type ButtonProps = LinkButtonProps | ActionButtonProps;

/**
 * Typography-led CTA (Brand Identity §36–§37): uppercase, tracked, minimal
 * radius, no pill shapes, no shadows. Hover is a colour shift only.
 */
export function Button(props: ButtonProps) {
  const { children, variant = "primary", className, ariaLabel } = props;
  const classes = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  if (props.href !== undefined) {
    if (props.external) {
      return (
        <a
          href={props.href}
          className={classes}
          aria-label={ariaLabel}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }

    /* Internal, so it carries a direction — "View all work" has to leave the
       same way the nav's Work link does, or the two disagree about where the
       page sits. */
    return (
      <DirectionalLink
        href={props.href}
        className={classes}
        aria-label={ariaLabel}
      >
        {children}
      </DirectionalLink>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className={classes}
      aria-label={ariaLabel}
      aria-haspopup={props.ariaHasPopup}
    >
      {children}
    </button>
  );
}
