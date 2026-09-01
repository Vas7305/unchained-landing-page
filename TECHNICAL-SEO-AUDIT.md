# Technical SEO Audit — Unchained Business

**Target:** https://unchainedbusiness.com (serves from `www.unchainedbusiness.com`)
**Repository:** unchained-landing-page (Next.js 16, App Router, deployed on Vercel)
**Audit date:** 2026-09-01
**Method:** Static analysis of the repository (source of truth for implementation) cross-checked against live HTTP requests to production (headers, raw HTML, robots.txt, sitemap.xml, redirect behavior, 404 behavior). No Lighthouse/PSI/CrUX field data was obtainable in this environment (API quota exhausted) — see §11.

---

## 1. Executive Summary

**SEO readiness score: 70/100**

**CONTENT PUBLICATION STATUS: NO-GO** (short punch list, low complexity — see §12)

The technical foundation is genuinely good: the site is fully server-rendered static HTML (Googlebot needs zero JavaScript to read any page's title, meta description, H1, or body text), robots.txt and sitemap.xml are both valid and unblocked, every checked page has a unique title/description/H1, 404s return real HTTP 404s (no SPA soft-404 problem), HTTPS/HSTS is enforced, and the route-generation pattern (`lib/projects.ts` + `lib/pillar-content.ts` driving `sitemap.ts` and `generateStaticParams`) is a scalable, metadata-driven foundation rather than hardcoded routes.

Three concrete, low-effort problems should be fixed before a content push, in order of importance:

1. **Canonical host mismatch.** Every canonical tag, the `og:url`, and every `<loc>` in sitemap.xml point to `https://unchainedbusiness.com` (apex, no `www`) — but that URL 308-redirects to `https://www.unchainedbusiness.com`, which is where the page actually lives. The site is telling Google its canonical URL is one redirect hop away from itself. (§10, §25)
2. **Six unfinished project pages are live, indexable, and internally un-gated.** `/work/frito`, `/work/lanna-kamilina`, `/work/lazara-sersa`, `/work/mensalere`, `/work/unchained-os`, and `/work/klassisches-ballet` (a `status: 'dismissed'` project) all return HTTP 200 with their own title, meta description, and self-referencing canonical, despite the code's own documentation stating a project should only get a page "when `detailed` is true." None of these six is `detailed: true`. They aren't linked from anywhere on the site today and aren't in the sitemap, so discovery risk is low right now — but the moment any of them gets a backlink, a social share, or an internal link from future blog content, it becomes an indexed thin/duplicate-template page for a project that was never meant to be public. (§2, §22, §26)
3. **No Open Graph image anywhere.** `openGraph` metadata is configured on every page (title, description, type) but `images` is never set. Every link shared to LinkedIn, X, Slack, or iMessage renders with no preview image. This directly undercuts the click-through the content strategy is being built to earn. (§11)

None of these three block crawling or indexing outright — robots.txt, sitemap.xml, and per-page indexability are all clean — which is why this is a short, fixable punch list rather than a structural rebuild. All three are low complexity.

---

## 2. Critical Findings

| Priority | Issue | Impact | Affected Area | Fix | Before Publishing? |
|---|---|---|---|---|---|
| P1 | Canonical/sitemap/OG host is apex (`unchainedbusiness.com`) but production serves from `www.unchainedbusiness.com`, which the apex 308-redirects to | Canonical URLs, sitemap URLs and `og:url` all require a redirect hop to resolve; wastes crawl signal clarity and is inconsistent with the domain Vercel actually serves | `lib/site.ts` (`siteConfig.url`), every canonical tag, `sitemap.xml`, `robots.txt`'s `Sitemap:` line, all `og:url` values | Change `siteConfig.url` to `https://www.unchainedbusiness.com` (or make apex the primary domain in Vercel and redirect `www`→apex instead — either is fine, but the two must agree) | Yes |
| P1 | `/work/<slug>` renders a full public page for **any** project in `lib/projects.ts`, not just ones with `detailed: true` | 6 pages (one for a `dismissed` project) are live, HTTP 200, individually titled/described/canonicalized, with near-empty bodies (no challenge/solution/capabilities/outcome — those fields are `undefined`) | `app/work/[slug]/page.tsx`, `lib/projects.ts` (`getProject`) | Gate the page on `project.detailed`; call `notFound()` (and skip `generateMetadata`'s success path) when it's falsy | Yes |
| P1 | No `og:image` / Twitter image on any page | Social shares (LinkedIn, X, Slack, iMessage) render with no preview image, hurting click-through the moment content is promoted | `app/layout.tsx` metadata, `app/work/[slug]/page.tsx` metadata | Add a static `app/opengraph-image.png` (1200×630) via Next's file convention, or set `openGraph.images` explicitly; add a per-project variant later if volume justifies it | Yes |
| P2 | No structured data (JSON-LD) anywhere on the site | Missing eligibility for Organization/Sitelinks-searchbox treatment and FAQ rich results despite a real, substantial 7-item FAQ already on the homepage | `app/layout.tsx`, `components/FAQ.tsx` | Add `Organization`+`WebSite` JSON-LD once (layout), `FAQPage` JSON-LD sourced from the existing `faqs` array | Should, not blocking |
| P2 | i18n is entirely client-side (localStorage/cookie); no locale URLs, no hreflang, `html lang` always server-renders `en` | Six full language dictionaries (es/it/fr/de/ru) exist but are **never crawlable** — Google only ever sees English. Fine for a single global site today; becomes a real cost the moment non-English organic content is wanted | `lib/i18n/*`, all page routes | Decide now whether non-English organic traffic is a goal. If yes, this needs a `[locale]` routing layer + hreflang before translated content is worth publishing; do not bolt on hreflang without real per-locale URLs | Decision needed, not a code fix |
| P2 | `next.config.ts` sets `images.unoptimized: true`, a holdover from the retired GitHub Pages static export | No responsive `srcset`/AVIF from Next's Image Optimization API (which Vercel now provides natively); `/public/work/*.webp` assets serve `Cache-Control: max-age=0, must-revalidate` instead of long-lived caching | `next.config.ts` | Remove `images.unoptimized: true` now that hosting is Vercel; verify output visually after the change | Should, not blocking |
| P3 | Sitemap `lastmod` is `new Date()` computed at build/request time for every URL alike | Every deploy resets every URL's `lastmod` to "now," including pages that didn't change — the field carries no real recrawl-priority signal | `app/sitemap.ts` | Track a real last-modified date per route/content item, or drop `lastmod` entirely (omitting it is better than a fake one) | No |
| P4 | No security headers beyond HSTS (no CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) | Not an SEO factor directly; general hardening gap | Vercel headers / `next.config.ts` `headers()` | Add baseline headers | No |

---

## 3. Technical SEO Scorecard

| Area | Score /10 | Notes |
|---|---:|---|
| Crawlability | 8 | robots.txt clean and permissive; no JS-only navigation; no blocked resources; only gap is the 6 orphaned thin pages (§2) |
| Indexability | 7 | No accidental `noindex`, no stray `X-Robots-Tag`; docked for the canonical-host mismatch and the un-gated `/work/[slug]` pages |
| URL architecture | 8 | Clean, lowercase, no query-param cruft, consistent trailing-slash redirect (308→no slash); metadata-driven route generation scales well |
| Metadata (titles/descriptions) | 9 | Every checked page: unique, relevant, correctly templated (`%s — Unchained Business`), no truncation risk observed |
| Canonicals | 5 | Present and self-referencing on every page, but every one points to a host that 308-redirects — see P1 in §2 |
| Internal linking | 7 | Small, shallow, coherent nav+footer today; the only structural flaw is that 6 project pages exist with zero internal links pointing at them |
| XML sitemap | 7 | Valid, correctly namespaced, HTTPS, matches real routes 1:1, but hostname mismatches canonical/production host, and `lastmod` is not meaningful (§2 P3) |
| Robots.txt | 9 | Valid, `Allow: /`, declares sitemap, no dev-environment leakage; only ding is the sitemap URL uses the non-serving host |
| Structured data | 2 | None present anywhere; real, low-effort opportunities exist (Organization, WebSite, FAQPage) and are unclaimed |
| JavaScript rendering | 9 | True SSG; raw HTML from `curl` contains full title/description/H1/body text for every page with zero JS execution required |
| Performance (lab/architectural) | 7 | Self-hosted preloaded font, single CSS bundle, async JS chunks, no heavy LCP image, Brotli on documents, immutable caching on hashed assets — but `images.unoptimized: true` and non-immutable image caching leave real gains on the table. No field CWV data available (§11) |
| Images | 6 | 0 of 21 sampled `<img>` missing `alt`; dimensions present where needed (no obvious CLS source); but unoptimized delivery and short-lived cache headers |
| Mobile SEO | 8 | Correct viewport meta, responsive layout via Tailwind, no separate mobile content — not independently verified in a real mobile browser (§11) |
| Accessibility/semantics (SEO-relevant) | 8 | Single H1 per page, proper landmark/`nav`/`aria-label` usage observed in Navbar/Footer, skip link present in layout |
| HTTP/headers | 6 | HTTPS enforced with strong HSTS; Brotli compression present; no CSP/X-Content-Type-Options/Referrer-Policy (§2 P4) |
| Error handling (404) | 9 | Real HTTP 404 for unknown routes and unknown `/work/[slug]` values; no SPA fallback-to-200 problem |
| Redirects | 6 | All redirects are single-hop and correct (apex→www, HTTP→HTTPS, trailing-slash→canonical); docked because the *canonical* host chosen in code is the one that requires the redirect, not the one that serves |
| International SEO | 4 | No hreflang is present, which is *correct* given there's no real per-locale URL architecture yet — but the six fully-translated dictionaries sitting behind client-side-only rendering represent a large content investment with zero current SEO value |
| Content architecture readiness | 7 | No `/blog` yet (expected pre-launch), but the existing pattern (`lib/projects.ts`, `lib/pillar-content.ts` → `sitemap.ts`/`generateStaticParams`) is a genuinely good, reusable model for adding content types later |
| Deployment safety | 6 | No CI runs tests/typecheck/lint before deploy (per `docs/hosting.md`); Vercel preview-deployment indexing exposure not verifiable from the repo (§11) |

---

## 4. URL Inventory

Crawled by following robots.txt → sitemap.xml → internal links (nav, footer, page bodies) from `https://www.unchainedbusiness.com`. This is the entire discoverable, linked surface of the site today.

| URL | Status | In Sitemap | Canonical (as served) | Internal Links In | Notes |
|---|---:|:---:|---|---:|---|
| `/` | 200 | Yes | `https://unchainedbusiness.com` | many (nav logo, footer, every page) | Home |
| `/work` | 200 | Yes | `https://unchainedbusiness.com/work` | nav, footer, home | |
| `/journey` | 200 | Yes | `https://unchainedbusiness.com/journey` | nav, footer | |
| `/software-development` | 200 | Yes | `https://unchainedbusiness.com/software-development` | footer, home pillars section | |
| `/business-automation` | 200 | Yes | `https://unchainedbusiness.com/business-automation` | footer, home pillars section | |
| `/growth-systems` | 200 | Yes | `https://unchainedbusiness.com/growth-systems` | footer, home pillars section | |
| `/work/tancerca` | 200 | Yes | `https://unchainedbusiness.com/work/tancerca` | `/work` page card | Only project with real detail content |
| `/work/frito` | 200 | **No** | `https://unchainedbusiness.com/work/frito` | **0 (orphan)** | `detailed` not set — should 404, see §2 |
| `/work/lanna-kamilina` | 200 | **No** | self | **0 (orphan)** | Same bug |
| `/work/lazara-sersa` | 200 | **No** | self | **0 (orphan)** | Same bug |
| `/work/mensalere` | 200 | **No** | self | **0 (orphan)** | Same bug |
| `/work/unchained-os` | 200 | **No** | self | **0 (orphan)** | Same bug |
| `/work/klassisches-ballet` | 200 | **No** | self | **0 (orphan)** | Same bug — project status is `dismissed` |
| `/robots.txt` | 200 | — | — | — | Valid |
| `/sitemap.xml` | 200 | — | — | — | Valid XML, 7 URLs |
| any unknown path | 404 | — | — | — | Real HTTP 404, confirmed on multiple paths |
| `http://` (either host) | 308 → https | — | — | — | Correct |
| `unchainedbusiness.com` (apex) | 308 → `www.` | — | — | — | Site's real host is `www` |
| `/work/` (trailing slash) | 308 → `/work` | — | — | — | Consistent site-wide |

**Total real content pages: 7. Total live-but-unintended pages: 6.**

---

## 5. SEO Metadata Audit

All values below were read from the live production HTML (`curl`), not from source, so they reflect what Google actually receives.

| Page | Title | Meta Description | Canonical | Robots meta | H1 | OG image |
|---|---|---|---|---|---|---|
| `/` | "Unchained Business — Digital Infrastructure for Businesses Ready to Grow" | Present, unique, on-topic | `https://unchainedbusiness.com` | none (defaults to index,follow — correct) | 1, matches title intent | **missing** |
| `/work` | "Our Work — Unchained Business" | Present, unique | self | none | 1 | missing |
| `/journey` | "Building Unchained — The Journey — Unchained Business" | Present, unique | self | none | 1 | missing |
| `/software-development` | "Software Development — Unchained Business" | Present, unique, keyword-relevant | self | none | 1 | missing |
| `/business-automation` | "Business Automation — Unchained Business" | Present, unique | self | none | 1 | missing |
| `/growth-systems` | "Growth Systems — Unchained Business" | Present, unique | self | none | 1 | missing |
| `/work/tancerca` | "TanCerca — Unchained Business" | Present, unique, has dedicated `openGraph.title/description` | self | none | 1 | missing |
| `/work/frito` (and the other 5) | "Frito — Unchained Business" | Present but derived from a one-line `description` field never meant to carry a full page | self | none | 1, but page body is ~4 short lines | missing |

No duplicate titles, no duplicate descriptions, no missing titles observed among the 7 intended pages. Title lengths and description lengths all fall within normal SERP display limits; no truncation risk flagged.

---

## 6. Indexing Architecture — How Google Discovers, Crawls, Renders, Indexes This Site Today

1. **Discovery.** Google finds `robots.txt` at `www.unchainedbusiness.com/robots.txt` (valid, permissive), which points to `sitemap.xml`. The sitemap lists the 7 intended URLs — but under the apex host, which then redirects. Google also discovers URLs by following links from the homepage nav/footer, which correctly reach all 6 real content pages plus the one real project detail page.
2. **Crawling.** Every URL resolves after at most one redirect (apex→www, or trailing-slash→canonical). No redirect chains longer than one hop were found. No robots.txt rule or `X-Robots-Tag` header blocks any real content page or its assets.
3. **Rendering.** Not a JS-SEO risk: every page is prerendered static HTML (`X-Nextjs-Prerender: 1`), and `curl`-level fetches (no JS execution) already contain the final title, meta description, H1, and body copy. Google's rendering step is not load-bearing here for English content.
4. **Indexing.** Nothing prevents indexing of the 7 real pages: no `noindex`, no canonical-to-elsewhere, no thin content (pillar pages in particular carry substantial original text). The **weak point** is that the canonical URL Google is told to index (`unchainedbusiness.com/...`) is not the URL that was actually crawled and served (`www.unchainedbusiness.com/...`) — Google will very likely resolve this correctly given the clean 308, but it is an unforced, easily-removed ambiguity, and it means Search Console property/URL-inspection data could end up split or confusing across the two hosts if both are ever added as separate properties (§11 — verify GSC domain property is used, which sidesteps this).
5. **The orphan pages** (§2) sit outside this pipeline entirely today — no path in the discovery step leads to them, so despite being indexable in principle, they are not realistically going to be crawled unless something external links to them.

---

## 7. Content-Publishing Readiness

### MUST FIX BEFORE PUBLISHING
- Canonical/sitemap/OG host mismatch — align `siteConfig.url` with the domain Vercel actually serves (§2 P1, §10).
- Gate `/work/[slug]` on `project.detailed` so undocumented projects can't be crawled/shared as live pages (§2 P1, §22).
- Add an Open Graph image (§2 P1) — every future blog/article share depends on this working.

### SHOULD FIX BEFORE PUBLISHING IF PRACTICAL
- Add `Organization` + `WebSite` JSON-LD (once, in the layout) and `FAQPage` JSON-LD for the existing FAQ (§2 P2, §12).
- Re-enable Next.js image optimization (`images.unoptimized: true` → remove) now that hosting is Vercel, not GitHub Pages (§2 P2).
- Decide the i18n/hreflang question explicitly before any translated content marketing is planned (§2 P2, §21) — this is a scope decision, not a bug.
- Install an actual analytics provider (GA4/GTM/Plausible) — the dispatcher in `lib/analytics.ts` currently has nothing listening (§24).

### CAN FIX AFTER CONTENT PUBLICATION
- Real per-route `lastmod` in the sitemap, or omit the field (§2 P3).
- Baseline security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`) (§2 P4).
- Per-project OG images once more case studies are public.
- CI running `tsc`/`vitest`/lint before deploy (currently absent per `docs/hosting.md`) — good hygiene, not an SEO blocker.

---

## 8. Exact Implementation Plan

### Phase 1 — SEO Foundation (P0/P1)

| Task | File/Component | Current Problem | Required Change | Expected Result |
|---|---|---|---|---|
| Fix canonical host | `lib/site.ts` | `siteConfig.url` is `https://unchainedbusiness.com` (apex), which 308-redirects to the host that actually serves the page | Change to `https://www.unchainedbusiness.com` (confirm this matches Vercel's assigned primary domain first) | Canonical, sitemap `<loc>`, `og:url`, and `robots.txt`'s `Sitemap:` line all resolve with zero redirects |
| Gate project detail pages | `app/work/[slug]/page.tsx`, `lib/projects.ts` | `getProject(slug)` returns any project regardless of `detailed`; the route renders it fully | In the page component and `generateMetadata`, treat a project with `detailed !== true` the same as "not found" (call `notFound()` / return a not-found metadata response) | `/work/frito` and the other 5 return real 404s until `detailed: true` is set on them |
| Add Open Graph image | `app/layout.tsx` (site-wide) and `app/work/[slug]/page.tsx` (per-project, optional) | No `openGraph.images` / `app/opengraph-image.*` anywhere | Add a 1200×630 static image via Next's `opengraph-image` file convention at the root; project pages can inherit it until dedicated art exists | Every shared link renders a preview image |

### Phase 2 — SEO Infrastructure (P2)

| Task | File/Component | Current Problem | Required Change | Expected Result |
|---|---|---|---|---|
| Organization + WebSite JSON-LD | `app/layout.tsx` | No structured data anywhere | Add one `<script type="application/ld+json">` with `Organization` (name, url, logo) and `WebSite` types, sourced from `siteConfig` | Eligibility for richer SERP presentation; no invented fields |
| FAQPage JSON-LD | `components/FAQ.tsx` or a wrapper in `app/page.tsx` | 7 real Q&As exist but carry no schema | Emit `FAQPage` JSON-LD from the same `faqs` array already driving the UI (single source of truth, no duplication) | FAQ rich-result eligibility |
| Re-enable image optimization | `next.config.ts` | `images.unoptimized: true` is a GitHub Pages leftover; Vercel supports the Image Optimization API natively | Remove the flag; visually verify all `next/image` usages after the change | Responsive `srcset`, AVIF/WebP negotiation, proper long-lived caching on optimized image URLs |
| Install analytics | `app/layout.tsx` (script) | `lib/analytics.ts` dispatches events to `dataLayer`/`gtag`/`plausible`/`umami`, but no provider script is loaded in production | Add the chosen provider's snippet (GA4 via `next/script`, or Plausible/Umami's script tag) | Existing event instrumentation starts actually recording; GSC/CWV monitoring has a data source alongside it |
| Decide i18n/hreflang strategy | `lib/i18n/*`, routing | Six languages exist client-side only; no crawlable non-English URL exists | Either (a) explicitly scope non-English organic SEO out for now and leave as-is, or (b) design a `[locale]`-prefixed routing layer with hreflang before writing translated content | No wasted translation effort; no hreflang pointing at nothing |

### Phase 3 — Optimization (P3/P4)

| Task | File/Component | Current Problem | Required Change | Expected Result |
|---|---|---|---|---|
| Meaningful `lastmod` | `app/sitemap.ts` | Every URL gets `new Date()` at generation time | Track real per-content-item modification dates (or drop `lastmod`) | Sitemap signal Google can actually use for recrawl prioritization |
| Security headers | `next.config.ts` `headers()` | Only HSTS is set | Add `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a baseline `Permissions-Policy` | General hardening; no SEO downside |
| CI before deploy | repo-level (no `.github/workflows` currently run `vitest`/`tsc`) | Nothing blocks a broken build/metadata regression from reaching production | Add a CI check running `pnpm test`, `tsc --noEmit`, and `pnpm lint` on PRs | Fewer accidental metadata/sitemap regressions as the site grows |

---

## 9. Content Architecture Recommendation

The business has three fixed capability pillars (Software Development, Business Automation, Growth Systems), a portfolio, and an already-running public "journey" changelog. The existing pattern — a typed content array (`lib/pillar-content.ts`, `lib/projects.ts`) feeding both the page component and `sitemap.ts`/`generateStaticParams` — is the right model to extend, not replace. Recommended minimum before a content push, sized to what this business actually needs rather than a generic blog scaffold:

```text
/
├── software-development/        (exists)
├── business-automation/         (exists)
├── growth-systems/               (exists)
├── work/                         (exists — fix the detailed-gate bug first)
│   └── [slug]/                   (exists)
├── journey/                       (exists — single-page changelog; keep as one page unless volume changes that calculus)
└── insights/                      (new — the actual SEO content vehicle)
    └── [slug]/                    (article pages, same typed-array pattern as lib/projects.ts)
```

Notes:
- **No categories/tags/author pages are needed yet.** With a three-pillar business, `insights` articles can simply carry a `pillar` field (reusing the existing `pillars` array from `lib/site.ts`) for lightweight filtering later — don't build a taxonomy system for content volume that doesn't exist yet.
- **Breadcrumbs** become worth adding once `/insights/[slug]` exists (`Home → Insights → Article`) — cheap, and pairs naturally with `BreadcrumbList` JSON-LD.
- **Article schema** (`Article`/`BlogPosting`) should be added alongside the `/insights` route from day one, not retrofitted — it's the one schema type genuinely tied to content that doesn't exist yet.
- **Pagination**: not needed until `/insights` or `/work` exceeds roughly 20–30 entries; premature pagination infrastructure would be over-building for a site with 7 real pages today.
- **RSS**: reasonable to add once `/insights` exists and has a real cadence — low effort, not urgent.

---

## 10. Technical Debt That Will Hurt SEO Later

- **The canonical-host mismatch (§2) compounds with scale.** Fixing it today touches one constant and 7 pages. Left in place while `/insights` grows to 50–500 URLs, it's the same one-line fix but with far more indexed, wrongly-canonicalized URLs to get Google to re-resolve.
- **The `detailed`-gate bug (§2) is a pattern risk, not just a one-off bug.** If `/insights/[slug]` is built with the same "any array entry is a live route" assumption without an explicit publish/draft gate, every future draft article becomes a live indexable URL the moment it's added to the content array — well before anyone intends it to be public.
- **Client-side-only i18n (§21) becomes expensive to unwind after content exists.** If non-English organic content is ever wanted, retrofitting locale-prefixed routing onto an already-indexed English-only site is materially harder than deciding the URL strategy now, before hundreds of translated articles exist that would need re-platforming.
- **No content "draft" state.** `lib/journey.ts` and `lib/projects.ts` both publish the instant an entry is added to the array — there's no unpublished/scheduled state. Fine at today's volume; worth a `status: 'draft' | 'published'` field before an editorial workflow with multiple contributors exists, so a work-in-progress array edit can't accidentally go live mid-review.
- **No CI gate (§8, `docs/hosting.md`)** means a metadata typo, a broken `generateStaticParams`, or a sitemap regression can reach production undetected. Cheap to add now; more valuable the more pages depend on the pattern being correct.

---

## 11. External Verification Required

**VERIFIED** (via direct HTTP inspection or repository evidence in this session):
- robots.txt content and status (200, valid)
- sitemap.xml content, validity, and status (200, valid XML)
- Canonical, title, meta description, H1, Open Graph, Twitter Card tags on all 7 intended pages plus the 6 orphan pages (via raw HTML fetch)
- Redirect behavior: HTTP→HTTPS, apex→www, trailing-slash→canonical, all single-hop
- 404 status codes for unknown routes and unknown `/work/[slug]` values (real 404, not soft-404)
- Presence/absence of JSON-LD, security headers, compression, image `alt` attributes, font-loading strategy, script-loading strategy (all via raw HTML/header inspection)
- A Google Search Console HTML-verification file (`/google4d74007345fda3a4.html`) is live at 200 — confirms verification **capability** was used at some point

**NOT VERIFIABLE FROM CURRENT ENVIRONMENT:**
- Actual Google Search Console property configuration, ownership, or which property (domain vs. URL-prefix, and which host) is set up — the live verification file only proves a file was uploaded, not that a property exists or is configured correctly today
- Actual index status of any URL (whether Google has crawled/indexed it, and under which canonical)
- Historical indexing problems or manual actions
- Real Core Web Vitals / CrUX field data (PageSpeed Insights API returned HTTP 429, quota exhausted, during this audit) — the performance scoring in §3 is architectural/lab-reasoning only, not measured
- Real-device mobile usability testing (viewport/responsiveness was verified via source inspection, not an actual mobile browser or Google's Mobile-Friendly Test)
- Backlink profile / referring domains
- GA4/GTM property ownership or configuration (repository evidence shows no provider script is currently loaded in production at all — see §2 P2/§24)
- Vercel project domain configuration (which of apex/`www` is set as "primary" inside the Vercel dashboard) — inferred from redirect behavior (apex→www) but not confirmed from repository files, since domain assignment lives outside the repo
- Whether Vercel preview deployments are inadvertently indexable (no `vercel.json` or preview-specific headers exist in the repo to check; this is a dashboard/project setting)

---

## 12. Final Go / No-Go Decision

```text
CONTENT PUBLICATION STATUS: NO-GO
```

Must be resolved first (all Low complexity, expected combined effort: well under a day):

1. Align `siteConfig.url` with the host Vercel actually serves (`www.unchainedbusiness.com`), so canonical/sitemap/OG URLs stop requiring a redirect hop. (§2, §8 Phase 1)
2. Gate `/work/[slug]` on `project.detailed` so the 6 unfinished/dismissed project pages 404 instead of serving live, indexable thin content. (§2, §8 Phase 1)
3. Add a site-wide Open Graph image. (§2, §8 Phase 1)

Once those three land, this flips to **GO**. The remaining items are real but do not block starting content production in parallel:

- Organization/WebSite/FAQPage JSON-LD (§8 Phase 2) — do alongside the first few published pieces.
- Remove `images.unoptimized: true` now that hosting is Vercel (§8 Phase 2).
- Decide the i18n/hreflang scope before any translated content is written, not before English content starts (§2 P2, §9).
- Install an actual analytics provider so the existing event instrumentation has somewhere to go (§8 Phase 2).
- Everything in §8 Phase 3 (sitemap `lastmod` accuracy, security headers, CI gate) can proceed entirely in parallel with content production.
