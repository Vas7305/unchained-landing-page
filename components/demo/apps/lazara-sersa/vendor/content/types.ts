/* ===========================================================================
   CONTENT TYPES
   The shape of every piece of editable content on the site. These types are
   deliberately transport-agnostic: the same objects can later come from a CMS,
   Supabase or a JSON API without touching a single component.
   =========================================================================== */

/**
 * Content authenticity classification (Brand Identity §70).
 * Never mix these deceptively — the badge shown in the UI is driven by it.
 *
 * - `verified`    real work with confirmed credits
 * - `pending`     real work awaiting permission or credit confirmation
 * - `conceptual`  original creative concept, not client work
 * - `personal`    self-initiated work
 * - `placeholder` structural scaffolding — no real work behind it yet
 */
export type ContentStatus =
  | "verified"
  | "pending"
  | "conceptual"
  | "personal"
  | "placeholder";

/**
 * Aspect ratios the image system supports (Photography Art Direction §38).
 * Images are never forced into a single ratio.
 */
export type AspectRatio = "1:1" | "4:5" | "3:4" | "2:3" | "3:2" | "16:9";

/**
 * CSS `object-position` value. Set per image so a crop never cuts through
 * eyes, lips or another critical facial element (master brief §21).
 */
export type FocalPoint = string;

export interface EditorialImageSource {
  /** Path under /public. When omitted a labelled placeholder is rendered. */
  src?: string;
  /**
   * Meaningful alternative text. Describe the image, not the file — e.g.
   * "Close-up profile, graphic liner in oxblood, hard side light".
   */
  alt: string;
  ratio: AspectRatio;
  /** Defaults to "50% 50%". Override to protect the focal area of a crop. */
  focal?: FocalPoint;
  /** Optional caption shown beneath the image. */
  caption?: string;
  /** Optional photography credit shown beneath the image. */
  credit?: string;
}

/**
 * The brand lockup artwork — mark, name and descriptor as one supplied file.
 * Distinct from `EditorialImageSource` on purpose: artwork is never cropped,
 * never captioned and never carries a focal point, so it must not travel
 * through the photography components. Intrinsic dimensions are required so the
 * hero reserves its space before the file loads.
 */
export interface BrandLockup {
  /** Path under /public. Must have a transparent background. */
  src: string;
  /** Intrinsic pixel dimensions, trimmed to the ink. */
  width: number;
  height: number;
}

export interface Credit {
  /** Role label, e.g. "Photography". Rendered uppercase by the component. */
  role: string;
  /** Confirmed name only. Use `null` while a credit is unconfirmed. */
  name: string | null;
}

/**
 * Portfolio disciplines (Brand Positioning §21).
 * A category only appears in the UI once at least one project uses it —
 * empty categories are never rendered.
 */
export type ProjectCategory =
  | "editorial"
  | "beauty"
  | "fashion"
  | "celebrity"
  | "campaigns"
  | "character";

export interface Project {
  slug: string;
  title: string;
  category: ProjectCategory;
  status: ContentStatus;
  /** Publication year, e.g. "2026". */
  year?: string;
  client?: string;
  talent?: string;
  publication?: string;
  /** Sersa's role on the production, e.g. "Makeup". */
  role?: string;
  location?: string;
  /** One or two lines used on cards and in metadata. */
  summary?: string;
  /** Longer editorial paragraph shown on the project page. */
  description?: string;
  heroImage: EditorialImageSource;
  /** Sequenced as an editorial story, not chronologically (Photography §35). */
  images: EditorialImageSource[];
  credits: Credit[];
  /** Surfaces the project in the homepage "Selected Work" sequence. */
  featured?: boolean;
  /**
   * Columns the item occupies in the 12-column gallery. Drives the
   * asymmetry of the editorial grid. Collapses to full width on mobile.
   */
  span?: number;
  /**
   * 1-based desktop start column. Set it only for a frame that has no partner
   * on its row: an orphan is inset deliberately rather than stretched to fill
   * (the same rule `ImageGallery` applies to unpaired upright frames).
   * Ignored below 1024px, where the gallery is a single sequence.
   */
  start?: number;
}

export interface PressEntry {
  id: string;
  /** Publication or outlet name. */
  publication: string;
  /** Project or article title. */
  title: string;
  /** Display date, e.g. "March 2026". */
  date: string;
  /** "Editorial" | "Interview" | "Feature" | "Campaign" … */
  kind?: string;
  /** External link to the piece, when one exists publicly. */
  url?: string;
  status: ContentStatus;
}
