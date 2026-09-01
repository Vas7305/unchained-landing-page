# SEO Canonical Host Fix

## 1. Root Cause

Every SEO-relevant absolute URL in this codebase is already derived from a single source: `siteConfig.url`, exported from [lib/site.ts](lib/site.ts). There was no duplication and no second hardcoded-domain constant anywhere in the app — the entire mismatch was one line:

```ts
// lib/site.ts, before
url: 'https://unchainedbusiness.com',
```

That apex value fed `metadataBase` in [app/layout.tsx](app/layout.tsx), which is what Next.js resolves every route's *relative* `alternates.canonical` (`'/work'`, `'/journey'`, etc.) against, and it fed the sitemap and robots.txt generators directly. Since `https://unchainedbusiness.com` 308-redirects to `https://www.unchainedbusiness.com` in production, every canonical tag, `og:url`, and sitemap `<loc>` pointed one redirect hop away from the page that actually served the content.

No `siteConfig.url` needed to be created — it already existed and was already the single source of truth. The fix was changing its value, not its architecture.

## 2. Files Changed

| File | Change |
| --- | --- |
| [lib/site.ts](lib/site.ts) | `siteConfig.url`: `'https://unchainedbusiness.com'` → `'https://www.unchainedbusiness.com'` |

That is the only code change. No other file references a hardcoded production hostname.

## 3. Architecture

`siteConfig.url` (lib/site.ts) is the sole source of truth for the production origin. Consumers:

- **[app/layout.tsx](app/layout.tsx)** — `metadataBase: new URL(siteConfig.url)`, root `openGraph.url: siteConfig.url`.
- **Every route's `alternates.canonical`** ([app/journey/page.tsx](app/journey/page.tsx), [app/work/page.tsx](app/work/page.tsx), [app/work/[slug]/page.tsx](app/work/[slug]/page.tsx), the three pillar pages) is a *relative* path (`'/work'`, `/work/${slug}`, etc.). Next.js resolves these against `metadataBase` at render time, so they never needed their own hostname — fixing `metadataBase` fixed all of them simultaneously.
- **[app/sitemap.ts](app/sitemap.ts)** — every `<loc>` is `${siteConfig.url}${route}`.
- **[app/robots.ts](app/robots.ts)** — `Sitemap: ${siteConfig.url}/sitemap.xml`.

No environment variable represents the production origin anywhere in the codebase (`.env.example` has no `NEXT_PUBLIC_SITE_URL` or equivalent — the only `NEXT_PUBLIC_*` vars are Supabase config and optional contact-fallback values unrelated to SEO). `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` are not referenced anywhere. So there was nothing to consolidate — the existing constant simply had the wrong value.

## 4. SEO Elements Fixed

All of the following now resolve to `https://www.unchainedbusiness.com` because they all trace back to `siteConfig.url`:

- **Canonical** (`alternates.canonical`, all routes, via `metadataBase`)
- **`metadataBase`** ([app/layout.tsx:20](app/layout.tsx))
- **`og:url`** (root layout; per-route pages inherit it since they don't override `openGraph`)
- **Sitemap `<loc>`** ([app/sitemap.ts](app/sitemap.ts))
- **robots.txt `Sitemap:`** ([app/robots.ts](app/robots.ts))
- **JSON-LD** — not applicable. No structured data exists in the codebase today (confirmed by repo-wide search for `ld+json` / `@context` — the only hit is the historical audit doc's recommendation to add it in a future task). Per scope, no JSON-LD was added.

## 5. Validation

Run from the repo root with `pnpm`:

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS — no errors |
| `pnpm test` | PASS — 7 test files, 137 tests |
| `pnpm build` | PASS — Next.js 16.1.6 (Turbopack) build succeeded, including the TypeScript check that runs as part of `next build` (no separate `typecheck` script exists in `package.json`) |

Build output was inspected directly:

- `.next/server/app/sitemap.xml.body` — every `<loc>` is `https://www.unchainedbusiness.com/...`
- `.next/server/app/robots.txt.body` — `Sitemap: https://www.unchainedbusiness.com/sitemap.xml`
- `.next/server/app/index.html` — `<link rel="canonical" href="https://www.unchainedbusiness.com"/>`, `<meta property="og:url" content="https://www.unchainedbusiness.com"/>`
- `.next/server/app/work.html`, `.next/server/app/work/tancerca.html` — canonical correctly resolves to `https://www.unchainedbusiness.com/work` and `.../work/tancerca` respectively

## 6. Production Verification

**This fix has not been deployed yet.** The change exists only in the local working tree (`lib/site.ts`, uncommitted). Live production, checked at the time of this audit, still serves the pre-fix apex URLs:

```
$ curl -sI https://unchainedbusiness.com/
HTTP/1.1 308 Permanent Redirect
Location: https://www.unchainedbusiness.com/

$ curl -sI https://www.unchainedbusiness.com/
HTTP/1.1 200 OK

$ curl -s https://www.unchainedbusiness.com/ | grep canonical
<link rel="canonical" href="https://unchainedbusiness.com"/>   ← still apex, pre-fix

$ curl -s https://www.unchainedbusiness.com/sitemap.xml | head -4
<loc>https://unchainedbusiness.com</loc>                        ← still apex, pre-fix

$ curl -s https://www.unchainedbusiness.com/robots.txt
Sitemap: https://unchainedbusiness.com/sitemap.xml              ← still apex, pre-fix
```

The apex → www redirect behavior itself is already correct and was left untouched, per scope.

Once this change is committed, pushed, and deployed, the same checks against `https://www.unchainedbusiness.com/`, `/work`, `/software-development`, `/business-automation`, `/growth-systems`, `/work/tancerca`, `/sitemap.xml`, and `/robots.txt` should show `www` throughout with zero redirects — the local build output above is a direct preview of what production will serve, since it's produced by the identical `next build`.

## 7. Remaining Apex References

Repo-wide search for `https://unchainedbusiness.com` after the fix returns matches only in **[TECHNICAL-SEO-AUDIT.md](TECHNICAL-SEO-AUDIT.md)** — the pre-existing audit document that first identified this bug. Those references describe the *broken* pre-fix state as historical/diagnostic record and are correctly left unmodified.

No other apex references exist in application code, config, or `.env*` files. `.env.example` contains `NEXT_PUBLIC_FALLBACK_EMAIL=hello@unchainedbusiness.com` and `NEXT_PUBLIC_FALLBACK_TELEGRAM=unchainedbusiness` — these are optional contact-fallback identifiers (an email address and a Telegram handle), not SEO/canonical URLs, and were correctly left untouched.

---

```text
SEO CANONICAL HOST FIX
----------------------
Canonical host: https://www.unchainedbusiness.com
Apex redirects to www: YES
Canonical URLs direct: YES (verified in local build output)
Sitemap uses www: YES (verified in local build output)
Robots sitemap uses www: YES (verified in local build output)
OG URLs use www: YES (verified in local build output)
Build: PASS
Tests: PASS
STATUS: INCOMPLETE — code fix validated locally; not yet committed/deployed, so production still serves apex URLs
```
