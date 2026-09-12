import Image from "next/image";
import type { CSSProperties } from "react";

import type { AspectRatio, EditorialImageSource } from "./types";

import styles from "./EditorialImage.module.css";

/** CSS `aspect-ratio` values for the supported editorial crops. */
const ratioValues: Record<AspectRatio, string> = {
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "3:4": "3 / 4",
  "2:3": "2 / 3",
  "3:2": "3 / 2",
  "16:9": "16 / 9",
};

interface EditorialImageProps {
  image: EditorialImageSource;
  /**
   * Responsive `sizes`. Always pass the real rendered width so mobile never
   * downloads a desktop-sized file (master brief §18).
   */
  sizes?: string;
  /** `true` only for the LCP image of a page — never for gallery items. */
  priority?: boolean;
  /** Adds a restrained hover treatment when the image is inside a link. */
  interactive?: boolean;
  /** Renders caption/credit under the frame. */
  showCaption?: boolean;
  /**
   * Ignores the declared ratio and fills the parent instead. Used only where
   * the container defines the crop — the full-viewport hero, for example.
   */
  fillContainer?: boolean;
  className?: string;
}

/**
 * A single photograph, or a clearly labelled placeholder when no photography
 * exists yet (Brand Identity §69 — never substitute stock or AI imagery).
 *
 * The frame always reserves its aspect ratio, so images cannot cause layout
 * shift, and each image carries its own focal point so a crop never cuts
 * through eyes or lips.
 */
export function EditorialImage({
  image,
  sizes = "100vw",
  priority = false,
  interactive = false,
  showCaption = true,
  fillContainer = false,
  className,
}: EditorialImageProps) {
  const { src, alt, ratio, focal = "50% 50%", caption, credit } = image;
  const frameStyle = (
    fillContainer ? undefined : { aspectRatio: ratioValues[ratio] }
  ) as CSSProperties | undefined;
  const hasMeta = showCaption && Boolean(caption || credit);

  return (
    <figure
      className={[styles.figure, fillContainer ? styles.fill : null, className]
        .filter(Boolean)
        .join(" ")}
      data-interactive={interactive ? "true" : undefined}
    >
      <div className={styles.frame} style={frameStyle}>
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            loading={priority ? undefined : "lazy"}
            quality={88}
            className={styles.image}
            style={{ objectPosition: focal }}
          />
        ) : (
          <div className={styles.placeholder} role="img" aria-label={alt}>
            <span className={styles.placeholderLabel} aria-hidden="true">
              Placeholder image
            </span>
          </div>
        )}
      </div>

      {hasMeta ? (
        <figcaption className={styles.caption}>
          {caption ? (
            <span className={styles.captionText}>{caption}</span>
          ) : null}
          {credit ? <span className={styles.credit}>{credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
