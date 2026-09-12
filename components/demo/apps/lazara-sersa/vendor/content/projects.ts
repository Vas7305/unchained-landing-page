/* ===========================================================================
   PORTFOLIO CONTENT
   Structured project data. Components read from here — never the reverse.

   ⚠ EVERY ENTRY BELOW IS A CONCEPT (`status: "conceptual"`), NOT CLIENT WORK.
   These ten looks came in as a single reference sheet of creative directions.
   No client, talent, publication, campaign or production credit has been
   invented around them: the fields that would carry such claims are empty and
   the UI tags every entry "Conceptual" so a visitor, an editor or a prospective
   client cannot mistake them for commissioned work (Brand Identity §70).

   Promote an entry to `status: "verified"` only once the work is real and the
   credits are confirmed — that status is what unlocks project JSON-LD.
   =========================================================================== */

import type { Credit, Project, ProjectCategory } from "./types";

/**
 * Concept studies have no production behind them, so no production credit is
 * asserted. Fill these in — or replace the whole block — when a look is
 * actually shot.
 */
const conceptCredits: Credit[] = [
  { role: "Concept", name: "Lazara Sersa" },
  { role: "Makeup", name: null },
  { role: "Photography", name: null },
];

/**
 * Credits for real productions whose collaborators are not confirmed yet.
 * Naming an unconfirmed photographer or model is the one mistake this file
 * exists to prevent — leave them `null` until someone has actually checked.
 */
const pendingCredits: Credit[] = [
  { role: "Makeup", name: "Lazara Sersa" },
  { role: "Photography", name: null },
  { role: "Styling", name: null },
  { role: "Model", name: null },
];

/**
 * The looks were supplied as two 5x2 contact sheets, cut by
 * `scripts/slice-lookbook.mjs` into `/work/1.jpg` … `/work/20.jpg` in reading
 * order. Numbers are the file names.
 *
 * 1–10 are the creative/character sheet and carry that sheet's own captions as
 * titles. 11–20 are the beauty sheet, which arrived with no captions, so those
 * titles describe the look itself rather than repeating a supplied name.
 *
 * ⚠ Each frame is only ~215px wide — a tenth of a 1080px sheet. They hold up in
 * a gallery card and nowhere larger. Replace them with the full-size originals
 * before launch.
 *
 * ⚠ `/work/20.jpg` carries a translucent four-pointed sparkle on the neck. It
 * is an overlay from the source sheet, not makeup — swap in a clean original
 * before launch.
 */
export const projects: Project[] = [
  {
    slug: "abstract-galaxy",
    title: "Abstract Galaxy",
    category: "character",
    status: "conceptual",
    role: "Makeup",
    summary: "Cosmic body art in deep violet and midnight blue.",
    description:
      "A nebula worked across the face, shoulders and décolleté in violet, indigo and black, scattered with white star points. The eye is kept graphic and dark so the colour reads as atmosphere rather than as shadow.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/1.jpg",
      alt: "Galaxy body art in violet and indigo across the face and shoulders, scattered with white star points and a graphic dark eye.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "butterfly-metamorphosis",
    title: "Butterfly Metamorphosis",
    category: "character",
    status: "conceptual",
    role: "Makeup",
    summary: "Monarch wings painted across the eyes and temples.",
    description:
      "Monarch wing panels in orange, black and pale blue, drawn symmetrically from the brow bone out to the temples, with the antennae traced in fine liner across the forehead. Skin and lip stay bare so the graphic carries alone.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/2.jpg",
      alt: "Monarch butterfly wings painted in orange, black and pale blue across the eyes and temples, with fine liner antennae on the forehead.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "metallic-chrome-sculpture",
    title: "Metallic Chrome Sculpture",
    category: "fashion",
    status: "conceptual",
    role: "Makeup",
    summary: "Liquid chrome and gold worked as a sculpted surface.",
    description:
      "Mirror-finish silver laid over the face and neck and broken by a single gold plane at the jaw and shoulder. The face is treated as a surface rather than a portrait — the highlight does the drawing.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/3.jpg",
      alt: "Mirror-finish silver chrome makeup across the face and neck, broken by a gold plane at the jaw and shoulder.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "floral-fantasy",
    title: "Floral Fantasy",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Pressed petals and pearls set into a luminous skin.",
    description:
      "Real petals, leaves and freshwater pearls set directly onto the skin and carried down the neck, over a warm luminous base. The colour palette is taken from the flowers themselves rather than applied against them.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/4.jpg",
      alt: "Pressed petals, leaves and pearls set onto luminous skin and carried down the neck, with a warm blush eye.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "gothic-onyx",
    title: "Gothic Onyx",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Blackened eye and lip under an ornamental brow lace.",
    description:
      "A smoked black eye and deep oxblood lip beneath an ornamental lace pattern drawn in fine liner across the brow and temples. The drawing is symmetrical and jewel-like, closer to metalwork than to makeup.",
    span: 6,
    heroImage: {
      src: "/demo/lazara-sersa/work/5.jpg",
      alt: "Smoked black eye and deep oxblood lip under an ornamental lace pattern drawn in fine liner across the brow and temples.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "optical-illusion-geometry",
    title: "Optical Illusion Geometry",
    category: "character",
    status: "conceptual",
    role: "Makeup",
    summary: "Hard-edged black and white op-art split across the face.",
    description:
      "Stripes, dots and hard geometric blocks in black and white, split down the centre line and continued onto the neck and shoulders. Each half runs a different pattern, so the face reads as two competing surfaces.",
    span: 6,
    heroImage: {
      src: "/demo/lazara-sersa/work/6.jpg",
      alt: "Black and white op-art makeup — stripes, dots and geometric blocks split down the centre of the face and continued onto the shoulders.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "natures-embrace",
    title: "Nature's Embrace",
    category: "character",
    status: "conceptual",
    role: "Makeup",
    summary: "Gold leaf, moss and feathers over a bronzed skin.",
    description:
      "Gold leaf broken across the cheekbone and brow, set against moss, dried fern and feather worked into the hairline. The eye is kept deep and earthy so the metal stays the brightest thing in the frame.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/7.jpg",
      alt: "Gold leaf broken across the cheekbone and brow, with moss, dried fern and feathers worked into the hairline over bronzed skin.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "crystal-spectrum",
    title: "Crystal Spectrum",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Crystals graded from brow to cheekbone in a full spectrum.",
    description:
      "Hundreds of crystals set individually, graded from a dense crown at the hairline out to scattered singles along the cheekbone and jaw. The spectrum runs cool to warm across the face rather than repeating a single colour.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/8.jpg",
      alt: "Hundreds of crystals set from a dense crown at the hairline out to scattered singles along the cheekbone, graded cool to warm.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "tribal-warrior",
    title: "Tribal Warrior",
    category: "character",
    status: "conceptual",
    role: "Makeup",
    summary: "White pigment linework over a sculpted bronze skin.",
    description:
      "Fine white linework — chevrons, dots and rays — set on the brow, cheekbones and sternum over deeply sculpted bronze skin, with gold detail worked into the braids.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/9.jpg",
      alt: "Fine white chevrons, dots and rays painted on the brow, cheekbones and sternum over sculpted bronze skin, with gold in the braids.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "ethereal-glow",
    title: "Ethereal Glow",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Iridescent skin in a near-invisible pearl finish.",
    description:
      "A pearl-and-opal finish laid over the high points of the face so the skin shifts lilac, mint and rose with the light. Almost no drawn line anywhere — the whole look is texture and reflectance.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/10.jpg",
      alt: "Iridescent pearl and opal finish over the high points of the face, shifting lilac, mint and rose, with almost no drawn line.",
      ratio: "4:5",
    },
    images: [],
    credits: conceptCredits,
  },

  /* ---- Sheet two: beauty. Uncaptioned, so titles describe the look. ------ */

  {
    slug: "emerald-smoke",
    title: "Emerald Smoke",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Deep green smoke worked into a warm, glossy skin.",
    description:
      "Emerald and forest green packed through the socket and blended out past the crease, kept wet-looking rather than powdered. Skin stays warm and lit, and the lip is left glossy and bare so the eye holds everything.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/11.jpg",
      alt: "Deep emerald smoky eye blended past the crease over warm glossy skin, with a bare glossy lip.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "graphic-liner-crimson-lip",
    title: "Graphic Liner, Crimson Lip",
    category: "editorial",
    status: "conceptual",
    role: "Makeup",
    summary: "A hard winged line against a deep matte crimson.",
    description:
      "A single sharp wing carried well past the outer corner, weighted along the lash line and left clean above it. The lip answers in a deep matte crimson, and everything between the two is kept sculpted and quiet.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/12.jpg",
      alt: "Sharp black winged liner carried past the outer corner, with a deep matte crimson lip and sculpted neutral skin.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "bare-gloss",
    title: "Bare Gloss",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Luminous skin, soft bronze eye, nothing drawn.",
    description:
      "A near-bare face: soft bronze washed over the lid, skin left luminous and unpowdered through the high points, and a sheer pink gloss. The work is all in the finish rather than in any line.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/13.jpg",
      alt: "Near-bare beauty look with luminous unpowdered skin, a soft bronze wash on the lid and a sheer pink gloss.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "terracotta-wash",
    title: "Terracotta Wash",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "One warm terracotta carried from lid to cheek.",
    description:
      "A single terracotta tone taken across the lid, up into the crease and out onto the cheekbone, so eye and blush read as one continuous wash rather than as two separate steps.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/14.jpg",
      alt: "Warm terracotta carried from the lid up into the crease and out onto the cheekbone as one continuous wash.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "cobalt-line",
    title: "Cobalt Line",
    category: "editorial",
    status: "conceptual",
    role: "Makeup",
    summary: "A cobalt graphic line over deep, polished skin.",
    description:
      "A cobalt line drawn thick along the upper lash and lifted into a blunt point, set against deeply polished skin and an iridescent lip. The colour is used structurally, as drawing rather than as shadow.",
    span: 6,
    heroImage: {
      src: "/demo/lazara-sersa/work/15.jpg",
      alt: "Thick cobalt blue line along the upper lash lifted to a blunt point, over deeply polished skin and an iridescent lip.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "berry-smoke",
    title: "Berry Smoke",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Plum smoke and a berry lip against auburn hair.",
    description:
      "Plum and warm mauve smoked around the whole eye, top and bottom, with a berry-stained lip. The palette is pulled from the hair rather than set against it.",
    span: 6,
    heroImage: {
      src: "/demo/lazara-sersa/work/16.jpg",
      alt: "Plum and mauve smoked around the whole eye with a berry-stained lip, against auburn hair.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "sculpted-neutral",
    title: "Sculpted Neutral",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Matte neutral built entirely on structure.",
    description:
      "No colour anywhere: a matte neutral base, a full brushed-up brow and shadow placed only where it builds the cheekbone and jaw. A study in what is left when the palette is taken away.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/17.jpg",
      alt: "Matte neutral makeup with a full brushed-up brow and shadow placed only to build the cheekbone and jaw.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "rose-diffusion",
    title: "Rose Diffusion",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Rose blush diffused from the lid across the cheek.",
    description:
      "One rose tone diffused with no visible edge anywhere — over the lid, along the temple and high across the cheek — so the flush reads as skin rather than as product.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/18.jpg",
      alt: "Rose blush diffused edgelessly over the lid, temple and high cheek so it reads as flushed skin.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "bronze-smoke",
    title: "Bronze Smoke",
    category: "beauty",
    status: "conceptual",
    role: "Makeup",
    summary: "Warm bronze smoke with a wet-looking finish.",
    description:
      "Bronze and copper packed through the socket and taken under the lower lash, finished wet on the centre of the lid. Skin is warm and glossy throughout and the lip stays nude.",
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/19.jpg",
      alt: "Warm bronze and copper smoky eye finished wet on the centre of the lid, over glossy skin with a nude lip.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },
  {
    slug: "silver-smoke-red-lip",
    title: "Silver Smoke, Red Lip",
    category: "editorial",
    status: "conceptual",
    role: "Makeup",
    summary: "Cool silver lid against a deep red lip.",
    description:
      "A cool silver-grey smoked close to the lash line and kept tight, played against a deep blue-red lip. The two temperatures are held apart deliberately rather than reconciled.",
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/20.jpg",
      alt: "Cool silver-grey smoked tight to the lash line against a deep blue-red lip.",
      ratio: "3:4",
    },
    images: [],
    credits: conceptCredits,
  },

  /* ---- Production stills — /work/21.jpg … /work/25.jpg.

       Real shoots, credits not confirmed yet, so these carry `pending` rather
       than `conceptual`. Promote to `verified` once someone has checked the
       collaborators.

       These five, and only these five, are the homepage sequence. They are the
       only full-resolution files on the site — everything above is a ~215px
       crop off a contact sheet — so the landing page leads with actual
       photography rather than with reference thumbnails. Their spans tile to
       two clean rows plus an inset closing frame; changing one means
       rebalancing the others.
       -------------------------------------------------------------------- */

  {
    slug: "ritual",
    title: "Ritual",
    category: "character",
    status: "pending",
    role: "Makeup",
    summary: "Character work for a folkloric studio series, shot on red.",
    description:
      "Warm, lived-in skin and a softly smoked eye built to hold up under hard studio light on a saturated red cyclorama. The makeup is kept matte and unglossed so it reads as character rather than as beauty.",
    featured: true,
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/21.jpg",
      alt: "Character portrait in folkloric costume against a red backdrop, holding lit palo santo, with warm matte skin and a softly smoked eye.",
      ratio: "4:5",
    },
    images: [],
    credits: pendingCredits,
  },
  {
    slug: "sunflowers",
    title: "Sunflowers",
    category: "editorial",
    status: "pending",
    role: "Makeup",
    summary: "Profile study lit hard against black, with magenta rim.",
    description:
      "Cut against a black field with a magenta rim raking the hair, so the whole read is the profile line. Skin is kept warm and low-shine to take a hard key without flaring.",
    featured: true,
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/22.jpg",
      alt: "Profile study against black, holding sunflowers, with a magenta rim light across the hair and warm low-shine skin.",
      ratio: "4:5",
    },
    images: [],
    credits: pendingCredits,
  },
  {
    slug: "soft-glam",
    title: "Soft Glam",
    category: "beauty",
    status: "pending",
    role: "Makeup",
    summary: "Warm blush, defined brow and a soft daylight finish.",
    description:
      "A warm blush carried high on the cheek, a full defined brow and a clean lash line — built to hold in daylight and in movement rather than only under a key light.",
    featured: true,
    span: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/23.jpg",
      alt: "Smiling portrait with warm blush carried high on the cheek, a full defined brow and a clean lash line.",
      ratio: "2:3",
    },
    images: [],
    credits: pendingCredits,
  },
  {
    slug: "movement",
    title: "Movement",
    category: "character",
    status: "pending",
    role: "Makeup",
    summary: "The same folkloric character, shot full length in motion.",
    description:
      "A movement frame from the same red-cyc series. Makeup was built to survive a full-length dancing frame, where nothing can be retouched between takes and the face is read at distance.",
    featured: true,
    span: 7,
    heroImage: {
      src: "/demo/lazara-sersa/work/24.jpg",
      alt: "Full-length frame of the folkloric character mid-turn against red, skirts and scarf in motion.",
      ratio: "2:3",
    },
    images: [],
    credits: pendingCredits,
  },
  {
    slug: "set-piece",
    title: "Set Piece",
    category: "fashion",
    status: "pending",
    role: "Makeup",
    summary: "Full-length set work, makeup built to read at distance.",
    description:
      "A built-set frame where the face sits small in a busy composition. The makeup is weighted accordingly — stronger lip and brow, no fine detail that would be lost at that scale.",
    featured: true,
    /* Fifth of five: no partner to pair with, so it is inset and held off
       centre rather than stretched across the row. */
    span: 6,
    start: 5,
    heroImage: {
      src: "/demo/lazara-sersa/work/25.jpg",
      alt: "Full-length frame on a built set papered in banknotes, the subject in pink against the wall.",
      ratio: "1:1",
    },
    images: [],
    credits: pendingCredits,
  },
];

/* --------------------------------------------------------------------------
   SELECTORS
   Keep every query in one place so pages stay declarative.
   ----------------------------------------------------------------------- */

const categoryLabels: Record<ProjectCategory, string> = {
  editorial: "Editorial",
  beauty: "Beauty",
  fashion: "Fashion",
  celebrity: "Celebrity",
  campaigns: "Campaigns",
  character: "Character",
};

/** Display order for category filters, matching the brand architecture (§11). */
const categoryOrder: ProjectCategory[] = [
  "editorial",
  "beauty",
  "fashion",
  "celebrity",
  "campaigns",
  "character",
];

export function categoryLabel(category: ProjectCategory): string {
  return categoryLabels[category];
}

/**
 * Categories that actually have work behind them. Empty categories are never
 * rendered — the brand does not invent sections to look larger (§11).
 */
export function getActiveCategories(): ProjectCategory[] {
  const present = new Set(projects.map((project) => project.category));
  return categoryOrder.filter((category) => present.has(category));
}

export function isProjectCategory(value: string): value is ProjectCategory {
  return (categoryOrder as string[]).includes(value);
}

export function getProjects(category?: ProjectCategory): Project[] {
  if (!category) return projects;
  return projects.filter((project) => project.category === category);
}

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/**
 * Homepage sequence — featured first, capped so the page stays curated.
 * The fallback to the full list only matters if every `featured` flag is
 * removed; it exists so the landing page can never render an empty gallery.
 */
export function getFeaturedProjects(limit = 5): Project[] {
  const featured = projects.filter((project) => project.featured);
  return (featured.length > 0 ? featured : projects).slice(0, limit);
}

/**
 * Related work for a project page: same discipline first, then anything else,
 * so the section never renders half-empty while other work exists.
 */
export function getRelatedProjects(slug: string, limit = 2): Project[] {
  const current = getProject(slug);
  if (!current) return [];

  const others = projects.filter((project) => project.slug !== slug);
  const sameCategory = others.filter(
    (project) => project.category === current.category,
  );
  const rest = others.filter((project) => project.category !== current.category);

  return [...sameCategory, ...rest].slice(0, limit);
}
