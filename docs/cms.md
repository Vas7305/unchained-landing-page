# The Unchained Business CMS

How the public website's content is stored, edited, translated and published.

This is a reference for somebody who has to change it. It does not repeat what
the code says — every migration and module carries its own reasoning — and it
is deliberately short.

---

## 1. What the CMS is, and what it is not

It is a content system for **this** website: projects, articles, images, in six
languages, with SEO metadata and a draft/publish workflow.

It is **not** a general CMS. There is no page builder, no layout editor, no
plugin system, no revision history and no comment system. Adding a content type
means writing a table, an RPC and a screen — see §10 — which is roughly a day's
work and is the right cost for something that happens twice a year.

Two applications are involved and neither is new:

| | |
|---|---|
| **Admin panel** | `D:\Tancerca\admin-panel` → https://www.admin.unchainedbusiness.com |
| **Public website** | `D:\unchained-landing-page` → https://www.unchainedbusiness.com |
| **Database** | Unchained Business's own Supabase project |

The panel is the shared command centre for every web property. It holds one
Supabase client per property (`src/lib/supabase.ts`), so the **databases** are
isolated even though the application is one. See `docs/database-isolation.md`.

---

## 2. Architecture, and why this one

The website was already ISR-prerendered on Vercel, reading its portfolio from
the database through one RPC, with a compiled-in fallback. The CMS extends that
shape rather than replacing it.

```
  panel  ──write──▶  Postgres  ◀──read──  website (server, at build/revalidate)
    │                                            │
    │                                       prerendered HTML
    └──publish──▶ edge function ──▶ /api/revalidate
                  (holds secret)
```

**Rendering is unchanged.** Every content page is still statically prerendered
with `export const revalidate = 600`. No route became client-rendered, and
`next build` still reports `/`, `/work`, `/work/[slug]`, `/insights`,
`/insights/[slug]` and `/sitemap.xml` as static. The only dynamic routes added
are the two preview pages and the revalidation endpoint, all three of which
must be dynamic.

**Publishing is on-demand.** `lib/portfolio.ts` explained for months why
revalidation was still time-based: the panel is a Vite SPA, every `VITE_*`
variable ships in its bundle, and a secret there is public. The fix is a
Supabase edge function that holds the secret server-side and checks the caller
first. Ten-minute ISR remains underneath as the floor — if the webhook is
missed, the site is at most ten minutes stale, which is what it was before.

**Why not a rebuild on publish.** `revalidatePath` marks a route stale so the
next request regenerates it: seconds, and only the pages named. A redeploy per
publish would turn a typo fix into a several-minute wait.

---

## 3. Schema

Five migrations, `supabase/migrations/20260912000001` … `000005`. They are
applied by pasting into the Studio SQL editor — **never** `supabase db push`,
which would replay history against live production. Every object is idempotent
and every file ends in assertions that fail the migration if the schema does
not behave as its comments claim.

```
unchained_locales                  the six languages, as DATA not as a CHECK
unchained_projects                 (existed) + SEO block, alt text,
                                   published_at, archived_at, created_by
unchained_project_translations     one row per (project, locale)
unchained_insights                 articles; body is validated JSONB
unchained_insight_translations     one row per (insight, locale)
unchained_media                    the library's metadata
unchained_preview_tokens           hashed preview links
```

### The three states

`published boolean` and `archived_at timestamptz` are the two stored facts;
**draft is the absence of both**. A third column would be one that can disagree
with them. `CHECK (archived_at IS NULL OR NOT published)` makes the ambiguous
combination unstorable, and a trigger unpublishes on archive so archiving is
one operation rather than two in a required order.

Archive is the delete button. Real deletion exists but is only offered on
something already archived.

### Why the slug is not translated

The website has **one URL per page**. `lib/i18n/LanguageProvider.tsx`: *"There
is no server-side locale negotiation: every page ships prerendered in
defaultLocale and switches on the client."* A localized slug would have nowhere
to be used, and creating one would mean inventing a second URL for the same
project.

If the site ever adopts per-locale routing, `slug` is added to the translation
tables and the public functions start returning it. Nothing else changes.

---

## 4. Authorization

Two predicates, and no third:

| | |
|---|---|
| `has_product_access('unchained')` | **read** — anybody in the module, drafts included |
| `unchained_manages_content()` | **write** — super_admin, `unchained_admin`, `commercial_manager` |

`unchained_manages_content()` delegates to `unchained_manages_leads()`, so the
answer is identical today. It has its own name because "may this person
reassign a lead" and "may this person publish a page on the company website"
are two questions that happen to agree, and the day they stop agreeing the
change should be one function body rather than a policy rewrite.

**A TanCerca administrator cannot reach any of this**, and not because a policy
says so: Unchained owns a separate Supabase project, so they have no
`auth.users` row here, no session and no JWT. The policies are written as
though that were not true, because a product boundary should not depend on a
deployment fact staying unchanged.

The route guard (`requireProductAccess('unchained')` in `src/router.tsx`) is
**routing, not enforcement**. Every CMS table has RLS; bypassing the guard
reaches screens that return nothing.

---

## 5. The public surface

Anonymous callers hold **no table access at all**. `REVOKE ALL … FROM anon` on
every CMS table, and the entire public surface is four SECURITY DEFINER
functions:

| Function | Returns |
|---|---|
| `list_public_projects()` | published, non-archived projects + published translations |
| `list_public_insights()` | published, non-archived articles + published translations |
| `preview_project(token)` | one project, draft included, if the token is valid |
| `preview_insight(token)` | one article, draft included, if the token is valid |

Each takes no caller-supplied predicate (or only a token), filters on
`published` **inside** the function, returns a fixed column list, and withholds
`created_by`, `updated_by`, `display_order` and every other administrative
field. A draft is unreachable no matter what the caller does.

---

## 6. Multilingual content

Parent row + translation rows. The parent holds everything language-independent
— slug, images, dates, status, flags — and a translation row holds only prose.

**Fallback is per field, not per record.** `jsonb_strip_nulls` in the public
functions means an untranslated field arrives as an *absent key*, and
`lib/cms/localized.ts` overlays only what is present. A project with a
translated title and an untranslated case study reads in the visitor's language
as far as the translator got.

**A translation publishes independently** of its parent, in one direction: an
unpublished translation never reaches the site, and a published translation of
an unpublished project reaches nobody, because the public function joins
through `WHERE p.published`.

### The legacy dictionary layer

Project prose used to live in `lib/i18n/dictionaries/*.ts` under slug-built
keys — `project.tancerca.description`. That worked for the eight projects in
the repository and **could not work for a ninth**: `t()` returns the key when
it misses, so a project created in the panel would have rendered the literal
string `project.acme-corp.description` on the public site.

`lib/cms/projectCopy.ts` resolves per field:

1. the CMS translation for this locale;
2. the dictionary entry, if one exists;
3. the project row, which is the default locale.

(2) before (3) is what makes this safe to ship: the eight existing projects keep
their hand-written five-language copy with nothing to migrate. The dictionary is
now read and never written, and empties out on its own as projects are
translated in the panel.

### hreflang

There is none, correctly. hreflang annotates *alternate URLs*, and there is one
URL per page. Inventing localized URLs to have something to annotate would
create duplicate content for the same project — the opposite of what the site's
SEO work has been doing.

---

## 7. Media

Bucket `unchained-cms-media`, in Unchained's own project. Public, with a 10 MB
cap and an image-only MIME list.

**Public is deliberate.** A signed URL expires; an `og:image` is fetched by
Facebook, LinkedIn, Slack and Google months later with no session. The security
question is therefore *what may go in*, not *who may read*: only a content
manager may write (storage policy), only images (bucket MIME list), only under
10 MB. **Nothing private belongs in this bucket** — everything in it is
published by definition.

Image columns accept exactly two forms, enforced in three places that must stay
in step:

| | |
|---|---|
| `unchained_media_reference_ok()` | the database, on write |
| `lib/cms/sanitize.ts` → `mediaRef()` | the website, on read |
| `next.config.ts` → `remotePatterns` | the framework, on render |

A site-relative path (everything published before the library existed) or an
object in this bucket. A third-party image host is refused by all three.

**Alt text lives on the content, not on the file.** Alt text describes an image
*in context* — the same screenshot is "the TanCerca merchant dashboard" on a
project page and "an example of the dashboards we build" in an article. The
library holds a default that the picker copies in; the content owns the value
that reaches the page, and it is translated.

---

## 8. Preview

A manager mints a token for **one content item**. The database stores
`sha256(token)` and returns the plaintext exactly once; it is never cached, never
logged, and cannot be recovered. Losing one costs a click.

- 244 bits of entropy, from two `gen_random_uuid()` values.
- Expires (1 hour … 30 days), revocable, usage counted.
- `/preview/work?token=…` and `/preview/insights?token=…` — dynamic,
  `robots: { index: false, follow: false }`, `cache: 'no-store'`, absent from
  the sitemap, disallowed in `robots.txt`.
- The slug is **not** in the URL: the token already names the content, and a
  slug would leak the name of an unannounced project into a forwarded email.
- Every failure — unknown, expired, revoked, wrong content type, malformed —
  returns the same not-found page. Distinguishing them would confirm that a
  token had once been real.

This is deliberately **not** a site-wide "preview mode" cookie: one leaked
cookie would expose every draft at once.

---

## 9. Publishing

```
Draft ──▶ Preview ──▶ Publish ──▶ Unpublish
                          └────▶ Archive ──▶ Restore (as a draft)
```

Restoring returns something to **draft**, never straight onto the site — a
retired project reappearing without anybody reading it first is the failure this
avoids.

On publish the panel calls the `revalidate-site` edge function, which verifies
`unchained_manages_content()` for the caller and then presents
`REVALIDATE_SECRET` to `/api/revalidate`. The endpoint refuses everything when
the secret is unset (503, never open), compares it in constant time, and accepts
only a **scope** — `projects` or `insights` — mapping to a fixed route list it
owns. It never accepts a path, so it cannot be used to evict arbitrary pages.

Revalidation **never fails a publish**. The content is already written by the
time it runs; a failure means the site updates within ten minutes instead of
immediately, and the panel's toast says so rather than claiming an instant
update it did not achieve.

### Deploying it

```bash
openssl rand -hex 32                       # generate once
# Vercel  → REVALIDATE_SECRET=<value>
supabase secrets set REVALIDATE_SECRET=<value>
supabase secrets set SITE_URL=https://www.unchainedbusiness.com
supabase functions deploy revalidate-site
```

Unset is safe: publishing still works, the site is just time-based.

---

## 10. Adding another content type

The two existing types are the template. For a hypothetical "Services":

1. **Migration** — `unchained_services` and `unchained_service_translations`,
   copying the lifecycle columns (`published`, `archived_at`, `published_at`,
   `created_by`), the two triggers, the two RLS policies
   (`has_product_access` to read, `unchained_manages_content` to write), and
   `REVOKE ALL … FROM anon`.
2. **Public function** — `list_public_services()`, SECURITY DEFINER, STABLE,
   `SET search_path = ''`, filtering on `published AND archived_at IS NULL`,
   aggregating translations with `jsonb_strip_nulls`, granted to `anon`.
   End the file with assertions.
3. **Website** — a loader beside `lib/portfolio.ts` and `lib/editorial.ts`,
   reusing `lib/cms/sanitize.ts`, `localized.ts` and `seo.ts`. Add a fallback
   array so a build with no database still renders.
4. **Panel** — `validate.ts` and `queries.ts` under
   `src/features/unchained-cms/`, hooks in `hooks.ts`, a page under
   `src/pages/unchained/content/`, a route in `src/router.tsx` and an entry in
   `src/components/unchained/nav.ts`.
5. **Revalidation** — add the scope to `SCOPES` in
   `app/api/revalidate/route.ts` and to the set in the edge function.
6. **Translations** — pass a `TranslatableField[]` to the existing
   `TranslationsDialog`. Nothing there needs changing.

The shared pieces — locales, media, preview, translations, the dashboard — are
already generic. Step 6 is the one that would have been expensive and is not.

---

## 11. Things that will bite

- **Migrations are applied by hand.** The website may be running an older build
  when one lands, and a newer one before. Both public functions are written so
  either order is safe: an older reader ignores unknown columns, a newer one
  reads absent ones as unset. Keep it that way.
- **`CREATE OR REPLACE` cannot change a `RETURNS TABLE`.** Adding a column to a
  public function means `DROP FUNCTION` then `CREATE`, and re-granting `anon`.
- **The image rule is stated in three places** (§7). Changing one and not the
  others produces images that upload successfully and then fail to render.
- **`revalidate = 600` is a literal in each route.** Next requires a statically
  analysable value and will not follow an import, so
  `PORTFOLIO_REVALIDATE_SECONDS` and `EDITORIAL_REVALIDATE_SECONDS` are
  documentation. The routes to keep in step are listed in those files.
- **Never `supabase db push`** against production.
