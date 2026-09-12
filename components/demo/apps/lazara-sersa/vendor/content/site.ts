/* ===========================================================================
   SITE CONFIGURATION
   Brand-level facts, navigation and contact details.

   ⚠ UNCONFIRMED VALUES ARE `null` ON PURPOSE.
   The WhatsApp number below was supplied directly and is real. The email
   address, Instagram handle and geographic base still are not — inventing them
   would violate Brand Positioning §50 (editorial integrity), so the UI renders
   an honest "to be confirmed" state instead. Fill these in before launch —
   see README, "Before launch".
   =========================================================================== */

import { hasPublishedPress } from "./press";
import type { BrandLockup } from "./types";

export const site = {
  /** Master brand. Never fused with the descriptor. (Positioning §9) */
  name: "Lazara Sersa",
  /** Used wherever the wordmark is set in caps — the header and the footer. */
  wordmark: "LAZARA SERSA",
  /** Secondary descriptor — always subordinate to the name. */
  descriptor: "Makeup Artist",
  /** Documented public-facing baseline (Positioning §57). */
  disciplines: ["Beauty", "Editorial", "Fashion", "Celebrity"] as const,

  /**
   * ⚠ Still the old name, and deliberately so. Every other appearance of
   * "Sersa Sarria" was renamed to Lazara Sersa; a domain is not text, it is a
   * registration. Writing lazarasersa.com here because it reads better would
   * put a hostname nobody owns into the canonical tags, the sitemap, the OG
   * URLs and the JSON-LD — silently, and on every page. Change it once the
   * real domain is registered, not before.
   */
  domain: "sersasarria.com",
  url: "https://sersasarria.com",

  /** Primary brand language is English; Spanish is secondary (§36). */
  locale: "en",

  contact: {
    /**
     * E.164, with the leading plus. Displayed exactly as written here and
     * stripped down to digits for the wa.me link — see `whatsappUrl`.
     */
    /* DEMO ADAPTATION: the studio's real number is replaced by a reserved
       fictional one. The layout depends on a number being present — the
       inquiry trigger hides itself without one — but publishing a working
       contact for a real person inside a sandbox is exactly what §31 asks us
       to audit for. Nothing in the demo dials it; see InquiryFormStep. */
    whatsapp: "+99 000 000 000" as string | null,
    /** e.g. "studio@sersasarria.com" — TODO: confirm with Sersa. */
    email: null as string | null,
    /** Handle without the "@" — TODO: confirm the verified account. */
    instagram: null as string | null,
    /** e.g. "Based in Madrid · Available worldwide" — TODO: confirm. */
    location: null as string | null,
    /** Dedicated press/publicist contact, if one ever exists (Press Kit §27). */
    press: null as string | null,
  },

  /** Downloadable press kit PDF under /public. `null` until one exists. */
  pressKitUrl: null as string | null,

  /**
   * Open Graph image. Must be a strong approved photograph once one exists
   * (master brief §34). Until then the generated wordmark card is used.
   */
  ogImage: "/opengraph-image",
} as const;

/**
 * The WhatsApp deep link, or `null` while no number is set.
 *
 * `wa.me` takes digits only — a plus, a space or a dash in the path silently
 * produces a chat with nobody, so the number is stripped here rather than
 * written out a second time in a different format and left to drift from the
 * one that is displayed.
 */
export const whatsappUrl: string | null = site.contact.whatsapp
  ? `https://wa.me/${site.contact.whatsapp.replace(/\D/g, "")}`
  : null;

/**
 * The brand lockup — monogram, name and descriptor as one piece of artwork.
 * It opens the homepage.
 *
 * This is the keyed PNG produced by `scripts/prepare-lockup.mjs`, not the file
 * that was supplied: the dusty-rose ground has been removed so the mark sits on
 * the page instead of inside a rectangle. Re-run that script and update these
 * dimensions if the artwork is ever replaced — and re-sample the palette in
 * styles/tokens.css with it, which is derived from this artwork's own colours.
 *
 * The artwork reads LAZARA SERSA, and so now does the rest of the site — the
 * wordmark, `site.name`, the copy, the credits and the metadata all agree with
 * the mark. Only `domain` still carries the old name; see the note on it above
 * for why that one cannot be renamed from here.
 *
 * ⚠ 618px is the mark's true resolution — the source is a raster file, not
 * vector art. Keep the rendered width well under it (see BrandHero) or the
 * monogram goes soft on high-density screens. Ask for an SVG or a large PNG.
 */
export const brandLockup: BrandLockup = {
  src: "/brand/lazara-sersa-lockup.png",
  width: 618,
  height: 519,
};

export type NavItem = {
  label: string;
  href: string;
};

/**
 * Primary navigation (Brand Identity §39). Minimal, four entries.
 *
 * Press only appears once there is verified press to show. An empty section
 * advertised in the nav reads as a gap rather than as restraint ("empty
 * prestige is worse than no prestige", Positioning §33), so until the first
 * entry lands in `content/press.ts` the route is hidden here, dropped from the
 * sitemap and answers 404 — see `app/press/page.tsx`. Adding an entry brings
 * all three back on its own.
 */
export const primaryNav: NavItem[] = [
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  ...(hasPublishedPress()
    ? [{ label: "Press", href: "/press" } satisfies NavItem]
    : []),
  { label: "Contact", href: "/contact" },
];

/**
 * The site read as one horizontal strip: home first, then the nav in the order
 * it is printed. Navigation animates towards the side the destination sits on,
 * so the direction a page arrives from always matches where its link sits in
 * the bar — reordering `primaryNav` reorders the motion with it, which is why
 * this is derived here rather than written out again somewhere else.
 */
const routeOrder: string[] = ["/", ...primaryNav.map((item) => item.href)];

/** Position of a path on that strip. Unknown paths sit at home's end. */
export function navPosition(pathname: string): number {
  let position = 0;

  routeOrder.forEach((href, index) => {
    if (href === "/") return;
    // A project page belongs with the section it came from, so /work/<slug>
    // is not "further right" than /work — going back to the index is a step
    // left, and going deeper is not a sideways move at all.
    if (pathname === href || pathname.startsWith(`${href}/`)) position = index;
  });

  return position;
}
