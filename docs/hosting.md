# Hosting, and how the visitor's country reaches the page

_Changed 2026-08-31. Supersedes the GitHub Pages arrangement described in
earlier revisions of `docs/commercial-routing.md` §2._

## 1. What this replaced

The site was a Next.js **static export** (`output: 'export'`) published to
GitHub Pages by `.github/workflows/nextjs.yml`. A static export has no request
phase: no server, no middleware, no edge function. Every country header a CDN
attaches — `x-vercel-ip-country`, `CF-IPCountry` — arrives on the wire and is
discarded before a line of our code runs.

Country detection therefore fell to its third rung, the region subtag of a
browser locale, for **every visitor**.

## 2. Why that was a correctness problem, not a performance one

Commercial routing is a two-field question: country and language. If the
country is wrong, the routing is wrong, and nothing downstream can detect it —
the resolver answers the question it was asked.

`regionFromLocaleTags` returns the first locale tag that carries a region. A
Chrome profile sending `es,en-US;q=0.9,en;q=0.8` — Spanish preferred, US
English second — yields **`US`**, because `es` has no region and `en-US` does.
A Spanish-speaking visitor anywhere in the world was liable to be routed as
American.

Because `US` had no assignment, that produced the global fallback panel:

> We couldn't determine a regional contact right now.

Which is indistinguishable, on screen, from a database that answered correctly
and honestly (`§22`/`§30` require all fallback reasons to render identically).
The wrong-country bug and the not-configured bug and the no-assignment case all
looked the same, which is why the symptom appeared to be "routing never works".

## 3. What runs now

| | Before | After |
| --- | --- | --- |
| `next.config.ts` | `output: 'export'` | removed |
| Host | GitHub Pages | Vercel |
| Request phase | none | `proxy.ts` |
| Deploy workflow | `.github/workflows/nextjs.yml` | Vercel's own Git integration |
| Country rung reached | 3 (browser locale) | 1 (edge header) |

`proxy.ts` reads `x-vercel-ip-country` (falling back to `cf-ipcountry` and
`x-country` should the site ever sit behind a different edge) and writes it to
the `unchained.country` cookie that
`lib/i18n/languageDetection/countrySignal.ts` **already** read. No application
code changed: rung 1 was written, tested and wired long before anything fed it.

Next 16 deprecates the `middleware.ts` filename in favour of `proxy.ts`, and
the file must export a function named `proxy` or a default. Both were confirmed
against the installed Next source rather than assumed.

### Why a cookie rather than `headers()` in the layout

Reading `headers()` in the root layout would opt every route into dynamic
rendering and give up the CDN cache for a landing page that is otherwise wholly
static. The proxy runs on every request whether or not the document itself came
from cache, so writing a cookie there keeps all 12 routes prerendered and still
gives each visitor a per-request answer. The `Set-Cookie` rides on the response
carrying the document, so the value is readable on first load — there is no
second-visit warm-up.

### What it deliberately does not do

An absent or unusable header writes **no cookie**. `XX` (conventional unknown)
and `T1` (Cloudflare's Tor marker) are rejected, as is anything that is not two
ASCII letters. A cookie holding a guess would outrank the locale rung; keeping
"we do not know" intact is `§23`, and `null` is a valid inquiry.

## 4. Verified

Against a production build served by `next start`:

| Request header | Result |
| --- | --- |
| `x-vercel-ip-country: RU` | `set-cookie: unchained.country=RU; Path=/; Max-Age=3600; Secure; SameSite=lax` |
| `x-vercel-ip-country: XX` | no cookie — falls through to the locale rung |
| _(absent)_ | no cookie |

Build succeeds, `ƒ Proxy (Middleware)` is registered, all 12 routes remain
prerendered static, and the 137-test suite passes.

The resolver itself was confirmed live against the Supabase project over
PostgREST before any of this was written — it was never the broken part:

| Request | Answer |
| --- | --- |
| `RU` / `ru`, `RU` / `en` | a contact |
| `CU` / `es` | a contact |
| `ES`, `US`, `IT`, `null` | no row → global fallback |

## 5. Consequences to know about

- **The two Supabase values are build inputs.** `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are inlined at build time and must be set on
  the **landing-page** Vercel project — not on the Supabase project's own
  environment. Setting them without redeploying changes nothing. Unset, the
  site builds and every inquiry takes the global fallback path, which is
  correct for a preview deploy.
- **There is no CI.** The removed workflow only ran `pnpm install` and
  `next build`; it never ran `vitest`, `tsc` or lint. Deleting it lost no test
  coverage because there was none to lose, but the 137 tests now run only
  locally.
- **GitHub Pages is dead.** `next build` no longer emits `out/`, so any
  workflow expecting that directory will fail.
- **Routing quality is now a data question.** With rung 1 answering, an
  unrouted visitor means an unassigned country, not a detection failure. See
  the country-coverage note under Remaining work in `docs/commercial-routing.md`.
