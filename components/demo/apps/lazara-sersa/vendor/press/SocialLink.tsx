import styles from "./SocialLink.module.css";

interface SocialLinkProps {
  href: string;
  children: string;
  /** External links get the correct rel and a new tab. */
  external?: boolean;
  size?: "meta" | "body";
  className?: string;
}

/**
 * A text link. This brand has no icon set (Brand Identity §35), so Instagram
 * and email are rendered as typography, never as glyphs.
 */
export function SocialLink({
  href,
  children,
  external = false,
  size = "meta",
  className,
}: SocialLinkProps) {
  const classes = [styles.link, styles[size], className]
    .filter(Boolean)
    .join(" ");

  if (external) {
    return (
      <a
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer me"
      >
        {children}
      </a>
    );
  }

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
