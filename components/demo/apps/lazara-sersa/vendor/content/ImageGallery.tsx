import { Grid, GridItem } from "../layout/Grid";
import { Reveal } from "../foundations/Reveal";
import type { AspectRatio, EditorialImageSource } from "./types";

import { EditorialImage } from "./EditorialImage";
import styles from "./ImageGallery.module.css";

interface ImageGalleryProps {
  images: EditorialImageSource[];
  className?: string;
}

const wideRatios: AspectRatio[] = ["16:9", "3:2"];

interface LaidOutImage {
  image: EditorialImageSource;
  span: number;
  start?: number;
  index: number;
}

/**
 * Sequences a project's images into an editorial spread.
 *
 * Wide frames run full width; upright frames pair into a spread. An upright
 * frame left without a partner is inset and offset instead of being stretched,
 * which keeps the page from settling into a repeating two-up rhythm.
 */
function layoutImages(images: EditorialImageSource[]): LaidOutImage[] {
  const laidOut: LaidOutImage[] = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (!image) continue;

    if (wideRatios.includes(image.ratio)) {
      laidOut.push({ image, span: 12, index });
      continue;
    }

    const next = images[index + 1];
    if (next && !wideRatios.includes(next.ratio)) {
      laidOut.push({ image, span: 6, index });
      laidOut.push({ image: next, span: 6, index: index + 1 });
      index += 1;
      continue;
    }

    laidOut.push({ image, span: 7, start: 4, index });
  }

  return laidOut;
}

function sizesForSpan(span: number): string {
  const desktop = Math.round((span / 12) * 100);
  return `(min-width: 1024px) ${desktop}vw, (min-width: 640px) ${span >= 7 ? 100 : 50}vw, 100vw`;
}

/** An asymmetric sequence of photographs — never a uniform tile grid. */
export function ImageGallery({ images, className }: ImageGalleryProps) {
  if (images.length === 0) return null;

  return (
    <Grid
      rowGap="editorial"
      className={[styles.gallery, className].filter(Boolean).join(" ")}
    >
      {layoutImages(images).map(({ image, span, start, index }) => (
        <GridItem key={index} span={span} start={start}>
          <Reveal variant="image" delay={Math.min(index, 3) * 90}>
            <EditorialImage image={image} sizes={sizesForSpan(span)} />
          </Reveal>
        </GridItem>
      ))}
    </Grid>
  );
}
