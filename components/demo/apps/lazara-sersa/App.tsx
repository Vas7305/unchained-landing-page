"use client";

import { useReducer, useState } from "react";

import type { DemoAppProps } from "@/lib/demo/types";
import {
  createInitialState,
  openProject,
  reducer,
  visibleProjects,
} from "@/lib/demo/apps/lazara-sersa/state";

import { Button } from "./vendor/actions/Button";
import { CategoryFilter } from "./vendor/content/CategoryFilter";
import { ImageGallery } from "./vendor/content/ImageGallery";
import { ProjectGallery } from "./vendor/content/ProjectGallery";
import { getActiveCategories } from "./vendor/content/projects";
import { TypographyBlock } from "./vendor/foundations/TypographyBlock";
import { InquiryModal } from "./vendor/inquiry/InquiryModal";
import { Container } from "./vendor/layout/Container";
import { Section } from "./vendor/layout/Section";
import { SiteFooter } from "./vendor/navigation/SiteFooter";
import { SiteHeader } from "./vendor/navigation/SiteHeader";

import surface from "./vendor/styles/surface.module.css";

/**
 * Lazara Sersa — the product's own frontend, running on demo state.
 *
 * ─── Almost nothing on this screen was written for the demo ───────────────
 * `SiteHeader`, `CategoryFilter`, `ProjectGallery`, `ProjectCard`,
 * `EditorialImage`, `ImageGallery`, `InquiryModal`, `Button`, `Container`,
 * `Section`, `TypographyBlock`, `SiteFooter` and every `.module.css` beside
 * them are the application's own files, copied from its repository. So is the
 * portfolio content, and so is the photography. The product is a Next.js 16 /
 * React 19 application and so is this site, which is why the copy is close to
 * verbatim rather than a reimplementation.
 *
 * ─── What the demo supplies, and it is only three things ──────────────────
 *   1. `surface.module.css` — the product's own tokens and base stylesheet,
 *      mechanically rescoped from `:root`/`html`/`body` onto a single class so
 *      its design system cannot leak onto the site around it.
 *   2. Local state where the product used the router. Its filter is a set of
 *      real URLs and its card is a link to `/work/<slug>`; both would carry the
 *      visitor off this site, so each gained one optional handler and renders a
 *      button instead. Their markup, classes and ARIA are untouched.
 *   3. One severed outbound call. The real inquiry dialog ends at
 *      `window.open(wa.me/...)` — the only request the vendored tree could
 *      make. It is gone; see the adaptation note in InquiryFormStep.
 *
 * Everything else the visitor touches is the product.
 */
export default function LazaraSersaDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const projects = visibleProjects(state);
  const opened = openProject(state);

  return (
    // The single element that scopes the product's design system.
    <div className={surface.surface} style={{ height: "100%", overflowY: "auto" }}>
      <SiteHeader />

      <Section rhythm="tight">
        <Container>
          <TypographyBlock
            eyebrow="Work"
            heading="Selected Work"
            headingLevel="h2"
            body="Beauty, editorial, fashion and bridal."
          />

          <CategoryFilter
            categories={getActiveCategories()}
            active={state.category}
            onSelect={(category) => dispatch({ type: "filter", category })}
          />

          <ProjectGallery
            projects={projects}
            headingLevel="h3"
            onOpen={(project) => dispatch({ type: "open", slug: project.slug })}
          />
        </Container>
      </Section>

      {/* A project opens into its own images, through the product's own
          ImageGallery reading the project's real image list. */}
      {opened ? (
        <Section rhythm="tight" surface="secondary">
          <Container>
            <TypographyBlock
              eyebrow={opened.year}
              heading={opened.title}
              headingLevel="h2"
              body={opened.summary}
            />
            <ImageGallery images={opened.images} />
            <Button variant="ghost" onClick={() => dispatch({ type: "close" })}>
              Close
            </Button>
          </Container>
        </Section>
      ) : null}

      <Section rhythm="tight">
        <Container>
          <Button
            variant="primary"
            ariaHasPopup="dialog"
            onClick={() => setInquiryOpen(true)}
          >
            Enquire about a booking
          </Button>
        </Container>
      </Section>

      <SiteFooter />

      {/* The product's real multi-step inquiry dialog: its steps, its fields,
          its validation and its composed brief all run. Only delivery is cut. */}
      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </div>
  );
}
