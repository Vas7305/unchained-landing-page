import Link from "next/link";

import { Metadata } from "../foundations/Metadata";
import { StatusTag } from "../foundations/StatusTag";
import { categoryLabel } from "./projects";
import type { Project } from "./types";

import { EditorialImage } from "./EditorialImage";
import styles from "./ProjectCard.module.css";

interface ProjectCardProps {
  project: Project;
  /** Responsive `sizes` for the image, matching its span in the gallery. */
  sizes?: string;
  priority?: boolean;
  /**
   * Heading level for the project title. Set it to match the surrounding
   * document outline — `h2` when the gallery follows the page `h1` directly,
   * `h3` when it sits under a section heading.
   */
  headingLevel?: "h2" | "h3";
  /**
   * DEMO ADAPTATION. In the product the whole card is a link to
   * `/work/<slug>`. The demo has no such route — following it would take the
   * visitor off the Unchained Business site — so when a handler is supplied
   * the same card becomes a button and reports the project instead.
   *
   * The contents, the classes and the document outline are identical either
   * way; only the wrapping element changes.
   */
  onOpen?: (project: Project) => void;
}

/**
 * A project as it appears in a gallery: image first, then the quietest
 * possible metadata. There is no card chrome — no border, no background,
 * no shadow. The photograph is the object; the type merely labels it.
 */
export function ProjectCard({
  project,
  sizes = "100vw",
  priority = false,
  headingLevel: Heading = "h3",
  onOpen,
}: ProjectCardProps) {
  const body = (
    <>
      <EditorialImage
        image={project.heroImage}
        sizes={sizes}
        priority={priority}
        interactive
        showCaption={false}
      />

      <div className={styles.meta}>
        <Metadata tone="muted" as="span" className={styles.category}>
          {categoryLabel(project.category)}
          {project.year ? ` — ${project.year}` : null}
        </Metadata>

        <Heading className={styles.title}>{project.title}</Heading>

        {project.status !== "verified" ? (
          <StatusTag status={project.status} className={styles.status} />
        ) : null}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(project)}
        className={styles.card}
        aria-label={`Open ${project.title}`}
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={`/work/${project.slug}`} className={styles.card}>
      {body}
    </Link>
  );
}
