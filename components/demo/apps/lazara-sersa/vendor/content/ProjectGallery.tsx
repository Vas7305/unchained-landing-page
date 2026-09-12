import { Grid, GridItem } from "../layout/Grid";
import { Reveal } from "../foundations/Reveal";
import type { Project } from "./types";

import { ProjectCard } from "./ProjectCard";
import styles from "./ProjectGallery.module.css";

interface ProjectGalleryProps {
  projects: Project[];
  /** The first item of the first gallery on a page can be the LCP element. */
  priorityFirst?: boolean;
  /** Passed through to each card so the document outline stays valid. */
  headingLevel?: "h2" | "h3";
  /** DEMO ADAPTATION: passed through to each card. See ProjectCard. */
  onOpen?: (project: Project) => void;
}

/**
 * The portfolio gallery: an asymmetric 12-column composition, not a card grid.
 * Each project declares its own span, and every other item is offset downward
 * so the eye moves diagonally rather than scanning uniform rows.
 */

/** `sizes` derived from the span so no viewport over-downloads. */
function sizesForSpan(span: number): string {
  const desktop = Math.round((span / 12) * 100);
  const tablet = span >= 7 ? 100 : 50;
  return `(min-width: 1024px) ${desktop}vw, (min-width: 640px) ${tablet}vw, 100vw`;
}

export function ProjectGallery({
  projects,
  priorityFirst = false,
  headingLevel = "h3",
  onOpen,
}: ProjectGalleryProps) {
  return (
    <Grid rowGap="editorial" className={styles.gallery}>
      {projects.map((project, index) => {
        const span = project.span ?? 6;

        return (
          <GridItem
            key={project.slug}
            span={span}
            start={project.start}
            className={index % 2 === 1 ? styles.offset : undefined}
          >
            {/* Entrance only. The travel down the page belongs to
                `SmoothScroll`, which moves the whole document as one body —
                a card drifting against its own caption would undo that. */}
            <Reveal variant="image" delay={Math.min(index, 3) * 90}>
              <ProjectCard
                project={project}
                sizes={sizesForSpan(span)}
                priority={priorityFirst && index === 0}
                headingLevel={headingLevel}
                onOpen={onOpen}
              />
            </Reveal>
          </GridItem>
        );
      })}
    </Grid>
  );
}
