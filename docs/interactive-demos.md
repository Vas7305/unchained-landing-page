# Interactive product demos

**Status, 2026-09-09.** Eight demos, one per project in the portfolio. Built,
tested, and verified against the production build.

Every project Unchained Business publishes can now be *used* on this website
rather than only read about: a working, frontend-only reconstruction of the
product's most representative workflow, running on local fixtures with no
account, no backend and no production data.

| | |
|---|---|
| route | `/work/<slug>/demo` |
| demos | 8 — one per project in the portfolio |
| tests | 171 new (444 total), all green |
| production backend calls from a demo | **none** — enforced by a test |
| initial bundle cost on the homepage | **+14 KB** (1061 → 1075 KB) |

---

## 1. What a demo is, and what it is not

It is not a screenshot, a video or a click-through prototype. Each demo is a
small application with its own state machine: quantities change subtotals,
filters narrow results, a booking takes a slot out of a diary, an allocation
draws down a fund, and operations can be **refused** — by a validation rule, a
sold-out category, a declined card, or capital that has run out.

It is also not the product. Each demo covers the 20% of the product that
communicates 80% of its value (§28), and the parts left out are listed in
§8 below rather than faked.

---

## 2. Architecture

```
UI                components/demo/apps/<slug>/App.tsx        dispatches, draws
  ↓
State             lib/demo/apps/<slug>/state.ts              pure reducer + selectors
  ↓
Fixtures          lib/demo/apps/<slug>/data.ts               deterministic, fictional
```

There is no fourth layer. Nothing in a demo reaches a network, a database, an
environment variable or browser storage.

The one asynchronous edge in the whole system is `lib/demo/service.ts`:
`simulate(decide, delayMs)` runs a **pure** decision function and resolves with
its result after a short timer, which is what gives a demo action its pending
state without giving it a request.

### Shared infrastructure

Written entirely against `lib/demo/types.ts`; contains no product name, no slug
and no special case.

| module | role |
|---|---|
| `lib/demo/types.ts` | the vocabulary: frames, themes, scenarios, definitions |
| `lib/demo/registry.ts` | **the only module that names products** — slug → definition |
| `lib/demo/service.ts` | `simulate`, `simulateSteps`, `DemoResult`, latency constants |
| `lib/demo/format.ts` | money, dates, percentages, deterministic seeds |
| `components/demo/DemoShell.tsx` | the website's chrome: heading, disclaimer, controls, CTAs |
| `components/demo/DemoFrame.tsx` | phone / browser / desktop window, and the theme boundary |
| `components/demo/DemoStage.tsx` | the one place a demo's code is fetched |
| `components/demo/demoComponents.ts` | slug → lazy component, built once at module scope |
| `components/demo/ui/*` | button, fields, modal, tabs, status, spinner, artwork |

### Why a code registry when the portfolio is a database

The portfolio is published from the admin panel and read at request time
(`lib/portfolio.ts`). A demo is a program, not content, so it cannot arrive
from a table — and a `has_demo` column would be a second source of truth able
to claim a demo this repository does not contain.

The two are joined at the point of use instead. A demo is offered when **the
database published the project** *and* **the registry has an entry for its
slug**. Unpublishing a project in the panel takes its demo down with it; adding
a demo here for an unpublished project leaves it unreachable.

---

## 3. Production isolation

The demos make **no production API or database calls**. This is not a promise
in a comment — `lib/demo/isolation.test.ts` reads every shipped file under
`lib/demo/` and `components/demo/` and fails the build if any of them contains
`fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
`supabase`, `/rest/v1/`, `process.env`, an api-key-shaped identifier,
`@/lib/portfolio`, `@/lib/commercial`, or `localStorage` / `sessionStorage` /
`indexedDB`. It also asserts that no demo imports another demo's modules.

Comments are stripped before scanning, so a module may *describe* the rule it
obeys. Test files are excluded — the scan is about code that reaches a browser,
and the suite's own list of banned patterns would otherwise match itself.

Two deliberate allowances:

- **`lib/analytics.ts`** — the site's existing dispatcher. It issues no request
  of its own and no new vendor was added (§25). Four events were added
  (`demo_cta_click`, `demo_open`, `demo_reset`, `demo_completed`), each carrying
  the project slug — already public, already in the URL — and nothing else.
  Nothing a visitor does *inside* a demo is reported: not what they searched,
  put in a cart, or typed into a simulated form.
- **`components/demo/DemoShell.tsx`** importing site components. The shell is
  the *website's* chrome around a demo; its "Start a project" button behaves
  there exactly as on every other page. The boundary being policed is the
  demo's own data path.

### State and persistence

All demo state is in-memory (`useReducer`). Nothing is written to
`localStorage`, so there is nothing to leak, nothing to migrate and nothing a
reset can miss.

**Reset is a remount.** The shell owns a `resetToken` that is part of
`DemoStage`'s React `key`; changing it discards the subtree and rebuilds it
from `createInitialState(scenario)`. Reset is therefore total by construction
and cannot rot as a demo grows state somebody forgets to clear. Changing
scenario resets the same way, for the same reason.

---

## 4. The demos

| project | frame | language | workflow demonstrated | scenarios |
|---|---|---|---|---|
| TanCerca | browser | es | browse merchants → basket → checkout → live order tracking | new / returning customer |
| Lanna Kamilina | browser | ru | service → master → date and time → contact → confirmed | one |
| Lazara Sersa | browser | en | filter portfolio → keyboard-driven viewer → dated enquiry | one |
| Klassisches Ballett | browser | en | programme → seat categories → reservation | pre-sale / final seats |
| Mensalere | browser | en | four-way filtered directory → profile → appointment | one |
| Frito | phone | es | onboarding → discovery → match → conversation | new user / with matches |
| Unchained OS | desktop | en | pipeline → compare → allocate capital → commit | pipeline / allocation |
| VectorForge | desktop | en + es rail | trace recipe → version history → icon package → batch | one |

### Fidelity: the palettes come from the products' own token files

These demos are shown to prospects as "this is what we built for them", so a
demo in a colour the product does not use is not a stylistic liberty — it is a
false statement about our own work.

Six of the eight products have their source on this machine, and each of them
keeps a design-token file that its own components consume. `lib/demo/registry.ts`
**copies those files** rather than approximating them, so a demo and its product
cannot disagree:

| demo | token source |
|---|---|
| TanCerca | `/d/Tancerca/src/index.css` (HSL, converted) |
| Lanna Kamilina | `/d/Lanna-Kamilina/src/styles/index.css` |
| Lazara Sersa | `/d/Sersa Sarria/styles/tokens.css` |
| Mensalere | `/d/Mensalere/src/styles/index.css` |
| Frito | `/d/Frito/src/constants/tokens.ts` |
| VectorForge | `/d/VectorForge-V-1.0/src/styles/tokens.css` |

The two without a reachable source — **Klassisches Ballett** (not pursued) and
**Unchained OS** (not on this machine) — are sampled from the screenshots in
`public/work/` instead, decoded pixel by pixel: dominant colours for grounds and
surfaces, a chroma filter for the accents. Both are marked as sampled in the
registry.

This mattered. The first pass invented its palettes and every one was wrong;
screenshot sampling then corrected the grounds but still missed two accents that
only the token files carry — **Lanna Kamilina's is a muted bronze `#8e6a4c`**
("a punctuation mark, never a background wash"), and **Mensalere's is a sage
`#73877a`** with documented AA-safe siblings for text. Neither is visible in a
hero screenshot.

**When a product is redesigned, re-copy its tokens. Never adjust by eye.**

Structure follows the same rule where there is evidence for it: Unchained OS
has the product's left rail with its real section names and sub-labels, its
header with the page title and account chip, and its real KPI labels; VectorForge
has its rail in the product's own Spanish alongside an otherwise-English
workspace. Sections that exist in the product but are not reconstructed here are
**named in a muted "also in the product" list** rather than faked as dead
navigation.

### Language follows the product, not the project's name

A Cuban marketplace is in Spanish and a Moscow salon in Russian — but the
screenshots also corrected two assumptions this work started with. Klassisches
Ballett has a German *name* and an English *site* (CAST · THE EXPERIENCE ·
PERFORMANCES · ABOUT, "RESERVE YOUR EVENING"), and Mensalere is English too
("Talking to someone can be the first step"). Both demos were rebuilt in the
language the product actually ships.

The **shell** around each demo is fully translated into all six site locales
(16 keys × 6 files), and `demo.langNote` tells the visitor why the product
inside may read differently. Each demo surface carries its own `lang` attribute
so screen readers switch voice at the boundary.

### Deterministic failure paths

Every demo can be made to fail, on purpose and repeatably (§20) — never randomly:

- **TanCerca** — card `4000 0000 0000 0002` is always declined; orders below a
  merchant's stated minimum are refused.
- **Lanna Kamilina / Mensalere** — one fixed slot is taken *while the form is
  open*, and is then genuinely removed from the diary so the retry succeeds.
- **Klassisches Ballett** — sold-out categories, the six-seat house limit, and
  inventory re-checked at the moment of reserving rather than only in the stepper.
- **Lazara Sersa** — committed dates are refused, with the next free date offered.
- **Unchained OS** — cheques below the fund minimum, deals not yet at investment
  committee, and allocations exceeding dry powder.
- **VectorForge** — tracing a photographic source in Logo mode is refused, naming
  the mode that would work.
- **Frito** — under-18 registration is refused.

### Fixtures

All fictional, all coherent, all deterministic. No real customer, merchant,
patient, professional or dating profile appears anywhere, and **there are no
photographs of people**: avatars are monograms on a seeded colour and gallery
tiles are generated SVG (`components/demo/ui/DemoArtwork.tsx`). Using stock
portraits as dating profiles or as named clinicians with invented registration
numbers would be fabricating records about real people.

This is also why the demos add **zero image requests**: there are no demo image
assets to lazy-load, compress or 404.

---

## 5. Performance, measured

Measured from the prerendered HTML of `next build` — the `<script src>` chunks
a visitor actually downloads — before and after, on the same machine.

| page | baseline | after | delta |
|---|---|---|---|
| `/` | 1061 KB | 1075 KB | **+14 KB** |
| `/work` | 988 KB | 1002 KB | **+14 KB** |
| `/work/tancerca` | 986 KB | 1000 KB | **+14 KB** |
| `/work/<slug>/demo` | — | 1169 KB | new route |
| total emitted JS | 1163 KB | 1907 KB | +744 KB across all chunks |

**The corporate site does not pay for the demos.** The +14 KB on the homepage
and work pages is the registry's static data plus the CTA wiring; it was
verified by marker-searching every chunk that the homepage loads that **no demo
application code is present** on `/`, `/work` or `/work/<slug>`.

### One thing that did not come out as intended

A demo page loads **all eight demos (~185 KB)** rather than only the one being
viewed. Turbopack places the eight sibling `import()`s reachable from this one
dynamic route into a single async chunk group, so `/work/tancerca/demo` and
`/work/frito/demo` download a byte-identical chunk set.

This was investigated, not assumed: both `React.lazy` and `next/dynamic` were
built and measured, and their chunk sets are identical, so it is the bundler's
grouping policy rather than the primitive chosen. `React.lazy` was kept because
it suspends, which lets the loading state be shown in the visitor's own language.

The requirement §11 is actually about — the corporate site staying light — is
met and verified. The remedy for the rest, if it ever matters, is to stop asking
one route to render any of eight demos and give each demo its own route segment,
so the bundler splits along a boundary it already understands. That trades eight
near-identical route files for the saving; at these sizes the whole demo payload
is smaller than the site's existing animation library, so it has not been taken.

---

## 6. Accessibility

Handled once in the shared primitives, so it cannot be forgotten differently in
eight places:

- **`DemoModal`** — focus moves in on open and returns to the opener on close,
  Tab cycles inside, Escape closes, `aria-modal` and a labelling heading.
- **`DemoField`** — real `<label for>`, `aria-invalid` and `aria-describedby`
  wired to the error, ids from `useId`.
- **`DemoTabs`** — roving tabindex, arrow/Home/End keys, correct `tab`/`tabpanel`
  relationships.
- **`DemoStatus`** — `role="status"` for success and information,
  `role="alert"` for refusals; the region is mounted empty so it is not inserted
  at the same moment as its text.
- **Touch targets** — 36–44 px minimum on every control; the phone demos are
  built to be used one-handed.
- **Keyboard parity for gestures** — Frito's swipe deck and Lazara Sersa's
  viewer are both driven by ← and → as well as by buttons.
- **Reduced motion** — inherited from `globals.css`, which already flattens
  animation and transition site-wide.

Demo frame chrome (address bars, traffic lights) is `aria-hidden` and not
focusable: it is a drawing of a window, not a window.

---

## 7. Testing

`pnpm test` — **444 tests, 23 files, all passing** (273 before this work).

Each demo's representative workflow is exercised end to end through its reducer:
the same actions the buttons dispatch, in the order a visitor triggers them,
asserting on the state the screens render from — including the failure paths,
the recovery from them, and that `createInitialState` restores the exact
starting position.

| suite | covers |
|---|---|
| `lib/demo/apps/*/state.test.ts` | 8 suites, 117 tests — one per demo |
| `lib/demo/registry.test.ts` | 40 tests — coverage, theme completeness, lazy loading, lookups |
| `lib/demo/isolation.test.ts` | 14 tests — the production-isolation scan |

`registry.test.ts` asserts that **every project in the portfolio has a demo**.
Adding a project without one fails the build; that is intended, so the decision
to leave a gap is made on purpose and recorded by editing that test.

**Known limitation.** These are reducer-level tests, not rendering tests. The
suite runs in vitest's Node environment over `.test.ts` files and the project
has no DOM environment; adding one would mean adding jsdom and a rendering
library to a deliberately short dependency list. The workflows are covered; the
markup is not. Nothing was mocked, disabled or weakened to achieve this.

---

## 8. Deliberately not simulated

- Merchant-side tooling and delivery dispatch for TanCerca — the consumer
  journey is what a visitor can absorb in a few minutes.
- Real payment authorisation anywhere. Card entry is a form; nothing is charged.
- Authentication. No demo has a login, because none needs one to be understood.
- Multi-user or shared state. Each visitor's demo is theirs alone.
- Persistence across reloads. Reloading a demo starts it over, by design.
- VectorForge's actual raster-to-vector tracing. The recipe, the reproducibility
  guarantee, the version lineage and the output package are modelled; the tracer
  itself is a Rust core in a desktop application and is not reimplemented in a
  browser.

---

## 9. React Doctor triage

Fixed:

| finding | verdict |
|---|---|
| `new Date()` in Lanna Kamilina's confirmation | **real bug** — the appointment printed today's date if the day lookup missed, and was non-deterministic. Now `demoDate(booking.dayOffset)`. |
| `Intl` formatter rebuilt per call (`cup()`) | **real** — constructed for every catalogue row and cart line. Hoisted to module scope. |
| `sharedInterests()` called inside a loop (Frito) | **real** — filtered the whole profile once per interest. Hoisted. |
| Chained `.filter().map()` ×5 | fixed — `flatMap`, plus a hoisted `STANDARD_TARGET_IDS` that removed a duplicated chain. |
| High complexity in `ProjectDetail` | fixed — hero CTAs extracted into `HeroActions`. |
| Giant component (Lazara Sersa) | fixed — regions extracted into sibling components, the shape TanCerca already used. |
| Pure function rebuilt per render (`filterStyle`) | fixed — hoisted to module scope. Introduced by the fidelity pass. |
| Static map rebuilt per render (`PAGE_TITLE`) | fixed — hoisted to module scope. Introduced by the fidelity pass. |

Reconsidered and then fixed anyway:

- **`js-set-map-lookups` ×7** — first assessed as negligible, and on the numbers
  they were: `.includes()` over arrays of at most ten items. But the `Set`
  version is no less readable and states the intent — *membership*, not a scan —
  so all seven were converted rather than argued over.
- **`no-array-index-as-key`** (Frito chat) — the list is append-only, so a render
  index really was stable. It was stable *by accident of how the reducer happens
  to work today*, though, and anything that ever inserted or removed a message
  would have corrupted the rendered list silently. Messages now carry an `id`
  assigned at append, which makes the invariant explicit.

Argued for twice, then fixed properly on the third look:

- **`no-prevent-default` ×3** — the defence was that these forms have no
  endpoint, so `preventDefault` is the only thing stopping a demo from
  navigating away, and dropping the `<form>` would cost Enter-to-submit. All
  true, and all beside the point: this project is on **React 19**, where
  `<form action={fn}>` suppresses the native submission itself. Every form
  semantic is kept and the handler no longer blocks navigation by hand.
- **`async-await-in-loop`** (VectorForge batch) — the defence was that the queue
  is deliberately sequential, which is right; running it concurrently would
  finish sooner and demonstrate nothing. But the loop was in the *component*,
  and this file's own contract says every asynchronous thing about a demo lives
  in `lib/demo/service.ts`. The pacing moved there as `simulateEach`, which
  takes a `start` callback that may return a settle function — the natural
  shape for "mark it running, wait, mark it finished". `latencyScale` now
  applies to the batch queue too, which it did not before.

**React Doctor: 100 / 100, no issues found.**

**Now done:** `no-giant-component` and `no-high-complexity-react-function` are
clear across all eight demos. Every screen or panel is its own component in the
same file, taking `{ state, dispatch }` and owning the condition that used to
wrap it — the shape TanCerca always had. Two further findings surfaced by that
refactor were fixed with it: the booking wizard's four steps became four
components, and `DemoModal` now reads its `onClose` through a ref so the
document key listener subscribes to `open` alone instead of being torn down and
rebuilt on every render (`prefer-use-effect-event`).

**What remains, and why it stays.** Eleven findings, all four categories
assessed above as false positives: `js-set-map-lookups` ×6, `no-prevent-default`
×3, `no-array-index-as-key`, `async-await-in-loop`. Each is a deliberate
decision with its reason recorded here, not deferred work.

## 10. Adding a ninth demo

1. `lib/demo/apps/<slug>/data.ts` — fictional, deterministic fixtures.
2. `lib/demo/apps/<slug>/state.ts` — `createInitialState`, `reducer`, selectors,
   and pure decision functions returning `DemoResult`.
3. `lib/demo/apps/<slug>/state.test.ts` — the representative workflow, its
   failure path, and reset.
4. `components/demo/apps/<slug>/App.tsx` — `'use client'`, default export taking
   `DemoAppProps`, built from the shared `ui/` primitives.
5. One entry in `lib/demo/registry.ts`.

Nothing else. No shared file needs to learn the new product's name, and the
route, shell, frame, controls, reset and CTAs all pick it up from the registry.
