# Commercial routing — the public interface

How a visitor who presses **Start a Project** reaches the right person.

The one rule this whole document is an elaboration of:

> The public website asks who should receive the inquiry.
> The Admin Platform and the database decide who that is.

This repository contains no contact list, no routing rule, no priority, no
country-to-person mapping and no representative's name, number, handle or
address. If you are looking for where a country is assigned to a person, it is
not here — it is the Commercial section of the Admin Platform.

---

## 1. The flow

```
Visitor presses "Start a Project"   (five CTAs, one component)
        ↓
Contact panel opens immediately, in its resolving state
        ↓
Country detected          →  lib/commercial/countryDetection.ts
Language read from i18n   →  lib/i18n/LanguageProvider (the active locale)
        ↓
POST { country_code, language }
        ↓
public.resolve_commercial_contact(country, language)     ← the only algorithm
        ↓
One representative, or nothing
        ↓
Panel shows: WhatsApp · Telegram · Schedule a Call · Email
             (only the channels that actually exist)
```

There is no step where the visitor chooses a representative, and no step where
this website decides which one is right.

---

## 2. Country detection

The site is `output: 'export'` and deploys to GitHub Pages. **There is no
server, middleware or edge function**, so no request header ever reaches our
code: `x-vercel-ip-country` and `CF-IPCountry` exist on the wire and are gone
before React runs. That is the documented limitation §6 asks for, and it is a
property of the hosting, not a choice about detection.

What remains is the platform signal that can reach a *static document*, and the
chain in `lib/commercial/countryDetection.ts` takes them in order of trust:

| Order | Signal | Where it comes from |
| --- | --- | --- |
| 1 | Edge country on the document | `window.__UNCHAINED_COUNTRY__`, a `<meta>` an edge layer rewrote in (`x-vercel-ip-country`, `cf-ipcountry`, `x-country`), or an `unchained.country` cookie |
| 2 | Platform country endpoint | Cloudflare's same-origin `/cdn-cgi/trace`, memoised, no third party, no key |
| 3 | Browser locale **region** | The region subtag of a tag that has one: `en-GB` → `GB` |
| 4 | No country | `country_code: null` — still a valid inquiry |

Reading 1 and 2 is `lib/i18n/languageDetection/countrySignal.ts`, which already
existed for language selection and is **reused rather than reimplemented**, so
the language chooser and the router can never disagree about where a visitor is.

Deliberately **not** used, per §7: timezone, currency, and bare browser language.
`en` is a language, not the United States. `es-419` is a macro-region, not a
country. Neither is sent.

No third-party IP-geolocation API is contacted. The browser Geolocation API is
never touched, so **no permission prompt is ever shown**. Nothing finer than a
two-letter country code is read, and the code is not stored, not persisted and
not sent to analytics (§25).

**When the site moves behind an edge runtime**, nothing in the application has
to change: have the edge stamp `<meta name="x-vercel-ip-country">` (or set the
`unchained.country` cookie) and step 1 starts answering.

---

## 3. Language detection

There is no second language detector. The routing request carries
`useLanguage().locale` — the same value that renders every string on the page,
whether it came from the visitor's stored choice, their browser, or the country
inference the i18n layer already does.

Switching English → Russian therefore changes the question, not just the UI.
The resolver is asked again in `ru`, because the database may well answer with
a different person (§16, §27), and the cache key includes the language so the
previous answer cannot be reused.

---

## 4. The backend contract (§41)

One RPC, over PostgREST, with the anon key.

```
POST {SUPABASE_URL}/rest/v1/rpc/resolve_commercial_contact
apikey: {ANON_KEY}
Authorization: Bearer {ANON_KEY}
Content-Type: application/json
```

### Request — exactly two fields, always

```json
{ "p_country_code": "RU", "p_language": "ru" }
```

`p_country_code` is `null` when the country could not be determined. Nothing
else is ever sent: no visitor identity, no `commercial_id`, no priority, no
preference. The function does not accept such a parameter, so the visitor has
nothing to select a representative with.

### Success — at most one row

```json
[
  {
    "commercial_id": "…",
    "name": "Alexander Ivanov",
    "role": "Business Development",
    "email": "alex@example.com",
    "whatsapp_number": "+79991234567",
    "telegram_username": "alex_unchained",
    "calcom_url": "https://cal.com/…",
    "avatar_url": null
  }
]
```

### No regional representative

```json
[]
```

An unknown country, a deactivated region, a country with no assignment and a
country whose representatives are all inactive **all** produce `[]`, and the
function does not distinguish them. Neither does this website.

### What is never returned

`priority`, `active`, `notes`, `timezone`, `languages`, routing rules, region
identifiers, membership data, or any second representative. The function selects
eight fixed columns with `LIMIT 1`. See
`supabase/migrations/20260901000002_resolve_commercial_contact.sql`.

---

## 5. Why this cannot be used to enumerate contacts

The anon key is inlined into a static bundle and is therefore public. It is safe
here because of what it can reach, not because it is hidden:

- The four commercial tables — `commercial_contacts`, `commercial_regions`,
  `commercial_contact_regions`, `routing_rules` — carry an `is_super_admin()`
  RLS policy each and grant `anon` nothing. A direct `SELECT` returns nothing.
- `resolve_commercial_contact` is `SECURITY DEFINER` with `SET search_path = ''`
  and every object schema-qualified, per the hardening standard established in
  Phase 5 (§48).
- It takes **two scalars and no predicate**, so there is no filter to inject.
- It returns **eight fixed columns**, never a row's internal state.
- It returns **at most one row** (`LIMIT 1`), so it cannot be paged through.
- It is `STABLE`, so it cannot be used to write anything.

An anonymous caller can learn "who serves country X in language Y" — which is
precisely what the panel is about to display anyway — and nothing else. They
cannot list the roster, cannot see who is inactive, and cannot discover the
priorities that produced the answer.

The website never authenticates against the Admin Platform, and the inquiry flow
requires no account, login or registration (§45, §46).

### Rate limiting (§32) — evaluated, deliberately minimal

The resolver returns one row for a (country, language) pair and holds no
per-visitor state, so repeated calls disclose nothing a single call does not.
The exposure is a small, fixed set of facts, not a table that can be walked.

What is in place today: the client asks **once per (country, language) pair per
page**, memoised in `lib/commercial/resolver.ts`, so normal use generates at most
a handful of calls per visit; the function is `STABLE` and cannot write, so it
cannot be used to grow anything; and Supabase's platform-level API limits apply
to the endpoint as they do to every PostgREST route.

What is not in place: a per-IP limit on the function itself. Postgres cannot
implement one inside a `STABLE` function — counting calls requires a write, and
that write path would itself be the abusable surface — so it belongs at the
edge, which this project does not currently have. §32 explicitly rules out
building an API gateway for this phase. See **Remaining work**.

---

## 6. The contact panel

`components/CommercialContactPanel.tsx`, opened by
`components/StartProjectButton.tsx` through
`lib/commercial/RoutingProvider.tsx`.

Channel order is §17's, and only channels that exist are rendered — no dead
buttons. The first available channel is the primary action, which on a phone is
almost always WhatsApp, one tap from the panel opening (§44).

```
┌─────────────────────────────────────┐
│      Let's build something          │
│           together.                 │
│                                     │
│   YOUR REGIONAL BUSINESS CONTACT    │
│   Alexander Ivanov                  │
│   Business Development              │
│                                     │
│   [ WhatsApp ]  [ Telegram ]        │
│   [ Schedule a Call ]  [ Email ]    │
└─────────────────────────────────────┘
```

No routing vocabulary appears anywhere on this screen — no rule, priority,
assignment, region or identifier (§16). WhatsApp, Telegram and Cal.com open in a
new tab; `mailto:` does not, because it is handed to a mail client rather than
to a page.

Radix's `Dialog` supplies focus movement in and back out, the focus trap,
Escape-to-close, page inertness and the `aria-labelledby`/`aria-describedby`
wiring. Every channel is a real link with visible text; the card is not one
clickable region; the resolving state is announced through a live region.

Nothing here is prerendered — the panel mounts only on interaction — so no
representative appears in the static export, the sitemap or any crawlable page,
and no per-representative route exists (§39, §40).

### When there is no regional representative

Every failure resolves to the same screen (§22, §30):

> We couldn't determine a regional contact right now.
> Please contact Unchained Business directly.

…followed by the global fallback channels. An unrouted country, a region with
nobody active, a timeout, an HTTP error and an unconfigured build are
indistinguishable to the visitor, deliberately. "Commercial routing failed" is
not a sentence a prospective client should read; the difference reaches the team
through the `commercial_routing_fallback` event's `reason` instead.

The fallback contact is configured, never invented — `siteConfig.bookingUrl`
plus the optional `NEXT_PUBLIC_FALLBACK_*` variables in `.env.example`.

---

## 7. Analytics (§34)

| Event | Properties |
| --- | --- |
| `start_project_click` | `location` — pre-existing, unchanged, still counting |
| `project_cta_clicked` | `cta_source`, `detail?` |
| `commercial_routing_success` | `language`, `country_known`, `channels` |
| `commercial_routing_fallback` | `language`, `country_known`, `reason` |
| `contact_channel_clicked` | `channel`: `whatsapp` \| `telegram` \| `email` \| `calcom` |

`booking_cta_click` still fires when the Cal.com channel is used, so the booking
funnel survives the change.

No personal data is sent. `country_known` is a boolean rather than the country
itself: routing health is what the team needs to see, and the visitor's location
— even coarsened to a country — is not an analytics provider's business.

`cta_source` is attribution only. **No routing rule may ever depend on it** (§35):
every CTA asks the identical question.

---

## 8. Configuration

See `.env.example`. Both Supabase values are inlined at build time and are
therefore build inputs, not runtime settings — but the *routing* they feed is
entirely runtime. Changing a priority, a language, an assignment or an
active flag in the Admin Platform affects the very next inquiry, with **no
redeployment of this site** (§55).

---

## Remaining work

- **Edge country signal.** Steps 1 and 2 of the chain are wired and tested but
  currently answer nothing on GitHub Pages, so most visitors are routed on their
  browser's region subtag. Moving the site behind an edge runtime, or putting
  Cloudflare in front of it, upgrades detection with no application change.
- **Per-IP rate limiting** on the resolver, at whatever edge the site ends up
  behind. See §5 above for why it does not belong in the database function.
- **A configured global fallback.** `NEXT_PUBLIC_FALLBACK_*` is unset, so the
  fallback currently offers only `siteConfig.bookingUrl`, which is the
  placeholder `https://cal.com`. A real company inbox or booking page should be
  configured before this ships.
