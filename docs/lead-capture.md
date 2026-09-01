# Lead capture — the public write surface

Companion to [`commercial-routing.md`](./commercial-routing.md), which documents
how the website decides **who** receives an inquiry. This document covers what
Phase 7 added: how that inquiry becomes a **record**, and what the website is —
and is not — allowed to do to the database in the process.

Phase 6 gave the visitor a person to talk to. Phase 7 makes the company able to
answer: how many prospects contacted us, from where, in which language, through
which channel, who received them, and what happened next.

---

## 1. The flow

```text
Visitor clicks "Start a Project"
        │
        ▼
Country detected  ──┐
Language (locale) ──┤──► resolve_commercial_contact(country, language)
        │           │
        ▼           │
  ONE commercial ◄──┘        the panel shows their name and channels
        │
        ├──► [ WhatsApp ] [ Telegram ] [ Schedule a Call ] [ Email ]   ← live immediately
        │
        └──► "Prefer to write? Tell us about your project"             ← optional, collapsed
                     │
                     ▼
              create_public_lead(...)
                     │
                     ├── validates every field, server-side
                     ├── calls resolve_commercial_contact AGAIN  ← the assignment
                     ├── writes unchained_leads (status = new)
                     └── writes unchained_lead_events (lead_created)
                     │
                     ▼
              { "success": true }
```

Nothing in that diagram blocks anything above it. The channels resolve first,
work without the form, and stay usable after it has been submitted.

---

## 2. Friction — what the form is not allowed to be

Phase 7 §11 is the constraint the whole panel is built around: a visitor must
never have to complete a form before reaching WhatsApp.

So:

- the channels are rendered as soon as routing answers, above everything else;
- the inquiry form is a **collapsed disclosure** underneath them;
- it is never shown as a step, a gate, an interstitial or a required field;
- submitting is optional and skipping it costs the visitor nothing.

Six fields, one required:

| Field | Required | Why it is asked |
|---|---|---|
| Name | yes | So the reply can address somebody |
| Email | one of the two | So there can be a reply |
| Phone | one of the two | Some markets answer a phone and not an inbox |
| Company | no | Changes how the first reply is written |
| Service | no | Routes the conversation to the right conversation |
| Message | no | The single most useful thing a first reply can respond to |

Deliberately **not** asked: budget, timeline, company size, industry, headcount,
how they heard of us. Every one of those is a question the commercial can ask in
the conversation this form exists to start, and every one of them costs
submissions to ask here.

---

## 3. Attribution (§12)

Captured at creation, never inferred afterwards.

| Column | Source | Example |
|---|---|---|
| `country_code` | The same detection that chose the commercial | `RU` |
| `language` | The active site locale | `ru` |
| `source` | Set by the server, not accepted from the client | `website` |
| `source_page` | `window.location.pathname`, path only | `/` |
| `source_cta` | Which button opened the panel | `hero_start_project` |

`source_page` drops the query string and the fragment before sending. That is
not tidiness — a query string is where campaign identifiers, session tokens and
occasionally somebody's email address ride along, and none of that answers
"which page produced this inquiry" (§20).

An undetermined country is sent as `null`. A guessed country would route and
report the lead to the wrong market for as long as the row exists.

---

## 4. What is never collected

No IP address, no user agent, no fingerprint, no coordinates, no city, no
referrer chain, no third-party identifier, no Geolocation API prompt. Country at
the two-letter level is the finest location this website records, and the same
value it already used for routing.

The analytics event fired on a successful submission carries the language, a
`country_known` boolean, the CTA label and whether a service was chosen — and
nothing the visitor typed. No name, address, company, phone number or message
reaches an analytics provider. Those exist in exactly one place, behind RLS.

---

## 5. The backend contract

### `create_public_lead(...)` — the only write

```jsonc
POST /rest/v1/rpc/create_public_lead
{
  "p_name": "Anna Petrova",
  "p_email": "anna@example.com",
  "p_phone": null,
  "p_company_name": "Petrova Ltd",
  "p_country_code": "RU",
  "p_language": "ru",
  "p_service_interest": "software-development",
  "p_message": "We need a booking system.",
  "p_source_page": "/",
  "p_source_cta": "hero_start_project",
  "p_client_token": "3f2a…",
  "p_honeypot": null
}
```

There is **no `assigned_commercial_id` parameter**. The browser knows who was
displayed — the name is on screen — and sending that id would hand an anonymous
caller the ability to assign every lead in the business to one person. The
function re-resolves instead, through the same
`resolve_commercial_contact(country, language)` the panel called moments
earlier. §14's "one assignment decision" is therefore a property of the
database, not a convention this repository follows.

The response, and everything it can be:

```jsonc
{ "success": true }                            // recorded, or a duplicate, or a honeypot hit
{ "success": false, "reason": "invalid" }      // a field the visitor can fix
{ "success": false, "reason": "rate_limited" } // too many in a short window
```

No lead id, no commercial id, no commercial name, no routing metadata, no
status, no internal error text (§42). The two failure reasons exist because the
form has a concrete requirement for them: it must be able to say which box is
wrong, or ask the visitor to wait a moment.

### `record_public_lead_channel_click(token, channel)`

Called when a visitor who has **already submitted an inquiry** presses a contact
channel. It records `contact_channel_clicked` — a click, not a conversation
(§19, §47). It does not advance the lead, does not set `first_contact_at`, and
does not claim anybody replied.

A visitor who never submitted the form holds no token, and nothing is written.
Their click is counted anonymously by the website's analytics provider, which is
where it belongs: there is nobody to attach it to, and this function will not
invent one.

An unknown token is a silent no-op that returns exactly what a known one
returns, so the endpoint cannot be used to test whether a token exists.

---

## 6. Why the anon key is still safe

Unchanged from Phase 6 in kind, wider by exactly two functions in extent.

Both Supabase values are `NEXT_PUBLIC_*`, inlined into the client bundle at
build time, so anything here is readable by anyone who opens it. The Supabase
anon key is designed for that, and it is safe here because of what the database
does with it:

| Table | anon grants | anon policies |
|---|---|---|
| `unchained_leads` | none — `REVOKE ALL` | none (SELECT-only, for authenticated) |
| `unchained_lead_events` | none — `REVOKE ALL` | none (SELECT-only, for authenticated) |
| `unchained_lead_throttle` | none — `REVOKE ALL` | **none at all**, for anybody |
| `unchained_services` | none — `REVOKE ALL` | authenticated read only |
| `commercial_*` (Phase 4) | none | none for anon |

The complete set of operations this key can perform against the lead system:

1. `resolve_commercial_contact(country, language)` → at most one row
2. `create_public_lead(...)` → `{ success }`
3. `record_public_lead_channel_click(token, channel)` → `{ success }`

It cannot select a lead, cannot list leads, cannot read a note, cannot learn who
a lead was assigned to, cannot discover whether an address is already in the
table (the duplicate path returns the same `success` as a new lead), and cannot
choose who receives an inquiry.

The migration asserts several of those at apply time and fails rather than
deploying if any becomes untrue.

---

## 7. Spam and duplicate protection (§22, §43)

Reasonable protections using what this architecture already has. Not an
enterprise anti-spam system.

| Layer | What it does |
|---|---|
| Honeypot | A field hidden three independent ways — off screen, out of the tab order, `aria-hidden`. Anything that fills it gets a cheerful `success` and no row. |
| Validation | Every rule the form applies is applied again server-side, against a caller that never loaded the form (§23). |
| Rate limit | Five submissions per fifteen minutes, per forwarded IP and per email address, in a sliding window. |
| Idempotency | A `client_token` the browser generates once per inquiry, reused by every retry. A double-click, a retried POST and a resubmitted form are one lead. |
| Content window | The same address from the same page inside ten minutes is the same inquiry, for a client that lost its token. |

The rate-limit table stores `md5(salt : subject)`. That is a **pseudonym**, not
anonymisation — an md5 of an IPv4 address is brute-forceable in seconds — so it
is treated as personal data: no lead reference, no name, no message, pruned an
hour after its window opens, and reachable only through the `SECURITY DEFINER`
helper that maintains it.

---

## 8. Internationalisation

The form ships in all six languages — Spanish, English, Italian, French, German
and Russian — added to the existing `lib/i18n/dictionaries/*.ts`. Every locale
file is typed against the English key set, so a missing translation is a build
error rather than an English string appearing in a Russian panel.

The service names reuse the existing `pillar.*` keys. There is no second
taxonomy and no second translation of the same three words.

---

## 9. What the visitor never sees (§52)

Not in any language: *lead*, *pipeline*, *CRM*, *routing*, *status*, *assigned*,
*commercial id*, *stage*. As far as the visitor is concerned they wrote to a
company and a person will write back — which is also exactly what happened.

---

## 10. Configuration

No new environment variables. The two RPC endpoints are derived from the
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` the resolver
already uses.

Leave them unset and the site still works: routing takes the global fallback
path, and the inquiry form reports that it could not send while the contact
channels stay live — which is the correct behaviour for a preview build with no
database behind it.

---

## 11. Remaining limitations

- **Country detection is still the Phase 6 signal.** A statically hosted site
  has no request headers, so a meaningful share of leads will carry
  `country_code IS NULL`. Those are reported as "Not determined" rather than
  guessed. Moving the site behind an edge runtime fixes it for both routing and
  attribution at once.
- **A channel click is only attached to a lead when the visitor submitted the
  form first.** Clicks by everyone else are anonymous analytics events. This is
  deliberate (§44) and is not a gap to be closed by fingerprinting.
- **Cal.com bookings are not confirmed.** Pressing "Schedule a Call" records a
  click. Whether an appointment was booked or attended is unknown until an
  actual Cal.com integration exists (§45), and nothing here pretends otherwise.
- **Email replies are not tracked.** No open, delivery or reply state is
  recorded, because no email integration provides it (§46).
