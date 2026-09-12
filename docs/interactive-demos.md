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
| TanCerca | phone | es | browse merchants → basket → checkout → live order tracking | new / returning customer |
| Lanna Kamilina | browser | ru | **the product's own frontend** — service → master → date and time → contact → confirmed | one |
| Lazara Sersa | browser | en | **the product's own frontend** — filter, gallery, inquiry dialog | one |
| Klassisches Ballett | browser | de | programme → seat categories → reservation | pre-sale / final seats |
| Mensalere | browser | en | **the product's own frontend** — directory, profile, availability, booking | one |
| Frito | phone | es | onboarding → discovery → match → conversation | new user / with matches |
| Unchained OS | desktop | en | pipeline → compare → allocate capital → commit | pipeline / allocation |
| VectorForge | desktop | en | **the product's own frontend** — import, mode, sliders, trace, split preview, node overlay, SVG export | one |

### Why each demo is in its product's own language

A Cuban marketplace is in Spanish, a Moscow salon in Russian, a German gala in
German — because that is what the product *is*. Translating a product's
interface into six languages it does not have would be showing something we did
not build. The **shell** around each demo is fully translated into all six site
locales (16 new keys × 6 files), and `demo.langNote` tells the visitor why the
product inside reads differently. The demo surface carries its own `lang`
attribute so screen readers switch voice at the boundary.

### Deterministic failure paths

Every demo can be made to fail, on purpose and repeatably (§20) — never randomly:

- **TanCerca** — card `4000 0000 0000 0002` is always declined; orders below a
  merchant's stated minimum are refused.
- **Mensalere** — one fixed slot is taken *while the form is open*, and is then
  genuinely removed from the diary so the retry succeeds.
- **Lanna Kamilina** — the refusal is the product's own. Book every master who
  performs a service at the same hour and the next attempt raises
  `SlotUnavailableError` from `recordAppointment`, which is exactly what happens
  in the real application when a colleague takes the slot mid-form. The
  appointment book is real, so this is reachable by doing it rather than by a
  flag: `lib/demo/apps/lanna-kamilina/booking.test.ts` reaches it that way.
- **Klassisches Ballett** — sold-out categories, the six-seat house limit, and
  inventory re-checked at the moment of reserving rather than only in the stepper.
- **Lazara Sersa** — committed dates are refused, with the next free date offered.
- **Unchained OS** — cheques below the fund minimum, deals not yet at investment
  committee, and allocations exceeding dry powder.
- **VectorForge** — a source the tracer has no input for throws out of the
  adapter, which is the product's own error path: the red message under the
  sliders is written by the product's store, not by the demo. Cancel is real
  too — the trace is an `AbortController` the product created.
- **Frito** — under-18 registration is refused.

### Fixtures

All fictional, all coherent, all deterministic. No real customer, merchant,
patient, professional or dating profile appears anywhere, and **there are no
photographs of people**: avatars are monograms on a seeded colour and gallery
tiles are generated SVG (`components/demo/ui/DemoArtwork.tsx`). Using stock
portraits as dating profiles or as named clinicians with invented registration
numbers would be fabricating records about real people.

No demo shows a photograph of a person. Two carry real imagery of other kinds,
fetched only on the route that needs it: Lazara Sersa's 25 portfolio
photographs, and VectorForge's three source rasters (92 KB total), which are
the product's own brand artwork rendered to PNG — see §"Vendored product
frontends".

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
- VectorForge's raster-to-vector tracing *as such*. The tracer is a Rust core
  in a desktop application. What the demo does instead is the half that can be
  done honestly: every sample source is a rasterised copy of a vector this
  repository still holds, so the perfect trace is known, and Detail, Colors,
  Smoothing, node simplification and the four modes then perform real
  operations on it — resampling the outline, snapping to a grid, clustering the
  palette by luminance. The preview responds, the numbers are measured from the
  SVG that was produced, and the same recipe gives the same file. See
  `lib/demo/apps/vector-forge/trace.ts`.
- VectorForge's other seven screens. Convert is vendored in full; Enhance,
  Optimize, Web Assets, Batch, Export, Settings and the Dashboard each sit on
  their own stack of Tauri commands. The navigation still lists them and says
  so, through the product's own `EmptyState`.

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

Assessed and **not** changed, with reasons:

- **`no-prevent-default` ×3** — these forms have no endpoint. `preventDefault`
  is what stops a demo form from navigating; removing it breaks the demo, and
  moving to a click handler would lose Enter-to-submit.
- **`no-array-index-as-key`** (Frito chat) — the message list is append-only:
  nothing is inserted, removed or reordered, which is exactly the condition
  under which index keys are correct.
- **`async-await-in-loop`** (VectorForge batch) — the queue is deliberately
  sequential and reports per-item status. Parallelising it would destroy what
  it demonstrates.
- **`js-set-map-lookups` ×6** — `.includes()` over arrays of at most ten items,
  inside loops of at most ten. Converting these to `Set`s would add allocation
  and indirection for no measurable gain.

- **`async-await-in-loop`** (VectorForge batch) — no longer present. The
  hand-written batch queue was deleted when the product's own Convert screen
  was vendored.

**Outstanding, recipe proven, awaiting sign-off:** `no-giant-component` and
`no-high-complexity-react-function` still fire on the demo `App.tsx` files that
are still hand-written — Frito, Klassisches Ballett and Unchained OS. The fix is
the one applied to Lazara Sersa and already present in TanCerca — extract each
screen or panel into a sibling component in the same file, taking
`{ state, dispatch }`. It is mechanical and behaviour-preserving, but it touches
large files with no rendering tests behind them, so it was left for a deliberate
pass.

Three files left that list by being vendored instead: Mensalere's, VectorForge's
and Lanna Kamilina's approximations no longer exist.

The same rules then fired on the products' own large components. `BookingFlow`
was fixed **upstream** — two step bodies extracted, 351 lines down to 266 — and
the vendored copy overwritten from it. What still fires there is control-flow
complexity rather than size, and unpicking that means deciding where the flow's
state should live, so it is carried as the product wrote it. `ConvertScreen` is
untouched for the same reason it always was. Both are written up in
[upstream-issues/](./upstream-issues/).

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

---

## Vendored product frontends

Four demos no longer approximate their product — they run the product's own
frontend. The recipe is the same each time and is worth following exactly.

### What gets copied, and what gets adapted

| | Lazara Sersa | Mensalere | VectorForge | Lanna Kamilina |
|---|---|---|---|---|
| source | `/d/Sersa Sarria` | `/d/Mensalere` | `/d/VectorForge-V-1.0` | `/d/Lanna-Kamilina` |
| stack | Next 16 / React 19 / CSS modules | Vite 8 / React 19 / Tailwind v4 | Tauri 2 / Vite / React 19 / CSS modules + Zustand | Vite 6 / React 19 / Tailwind v4 / react-router 7 |
| files vendored | 44 + 25 photographs | 44 | 84 + 3 source rasters | 41 |
| styling strategy | rescoped stylesheet | namespaced tokens | rescoped stylesheet | namespaced tokens **and** rescoped base layer |
| what had to be replaced | one outbound call | nothing — already mock-backed | the Tauri IPC layer | one outbound call and the document head |
| adaptations | 3 | 3 | 4 modules + 10 in-place divergences | 7 in-place divergences |
| fixed upstream instead | — | — | 4 findings | 15 findings |

**Lazara Sersa.** Its `tokens.css` and `base.css` were mechanically rewritten
from `:root`/`html`/`body` onto one class in `vendor/styles/surface.module.css`,
so the product's design system applies inside the demo and cannot escape it.

**VectorForge.** Same mechanical rewrite as Lazara Sersa: `tokens.css` and
`globals.css` concatenated into `vendor/styles/surface.module.css` with every
global selector — `:root`, `html, body, #root`, `body`, `:focus-visible`,
`::-webkit-scrollbar`, the universal reset — scoped under one class. This one
mattered more than usual: the product and this site both define `--surface`,
`--border`, `--radius-md` and `--font-mono` with different values, and both
zero every margin and padding with `*`. Unscoped, opening the demo would have
restyled the page around it. Its CSS modules then needed no edit at all —
29 of the product's 78 came across, and all 29 verbatim — because custom
properties declared on the surface class are inherited by everything inside it
and by nothing outside it.

**Mensalere.** Tailwind tokens cannot be scoped that way — `@theme` is global —
and the product and this site both define `--color-primary`, `--color-border`
and `--radius-md` with *different values*. Registering them unprefixed would
have silently restyled the whole website. So every token was prefixed `ms-` in
`app/globals.css` and the same prefix applied to 298 utility class names across
28 vendored files by script. Verified in the production CSS: the site keeps
`--color-primary: var(--primary)` and `--radius-md: calc(var(--radius) - 2px)`
while the product gets `--color-ms-primary: #73877a` and `--radius-ms-md: 8px`.

### The adaptations, and only these

Each vendored tree has a short, documented list of changes. Everything else is
the product's code verbatim, so re-copying it later is an overwrite rather than
a merge.

- **Routing.** Both products navigate — Lazara Sersa through a `DirectionalLink`
  that calls `useRouter().push()`, Mensalere through react-router-dom in nine
  files. A real navigation would carry the visitor off this site, so each has an
  adapter (`vendor/navigation/DirectionalLink.tsx`, `vendor/router.tsx`) that
  keeps the props and the class contract and reports the destination to the demo
  instead. Both render `<button>`, because an anchor that does not navigate is a
  lie to assistive technology.
- **One severed outbound call.** Lazara Sersa's inquiry dialog ended at
  `window.open('wa.me/…')` — the only request either tree could make. Removed;
  the validation and the composed brief still run.
- **One real phone number.** `content/site.ts` carried the studio's actual
  WhatsApp number. Replaced with a reserved fictional one.
- **Dependencies.** Mensalere imports ten Radix primitives individually; this
  site ships the unified `radix-ui` package that re-exports all of them, so the
  imports were repointed rather than adding dependencies. Its messaging feature
  needs `@tanstack/react-query`, which this site does not have and the booking
  journey does not use — those three files were dropped rather than pulling in
  a query client.

### VectorForge: a desktop application in a browser tab

This is the one where the boundary is not a detail. VectorForge is a Tauri
application: its tracer, optimiser, thumbnailer, file dialogs and project
storage are Rust commands reached through `invoke`, and twelve of its modules
import `@tauri-apps/api`. None of that can exist in a browser tab.

What made it vendorable anyway is that the coupling is *concentrated*. The
components are pure, and the Zustand stores that matter — `convertStore`,
`uiStore`, `historyStore`, `toastStore`, `systemStore`, `preferencesStore`,
`assetStore` — reach the operating system only through `services/`. So the
whole frontend is the product's, and the isolation work is four modules:

- **`vendor/services/`** — `fs`, `probe`, `thumbnails`, `preferences`, `tauri`
  and `vectorize`, each keeping the product's export names and signatures and
  answering from fixtures. `convertStore.startVectorization` is untouched: it
  still builds an `AbortController`, still dynamically imports `./vectorize`,
  still reports progress by the product's own stage names. It simply reaches an
  adapter. The pure functions in `services/fs.ts` — `validateRef`,
  `isSupportedFormat`, `pathsToRefs`, the 100 MB limit — are copied verbatim,
  so the import validation a visitor sees is the product's.
- **`vendor/stores/projectStore.ts`** — 595 lines of directory creation,
  `project.json` repair, workspace scanning and migration, replaced by the read
  surface the vendored screens actually use. Projects created in the demo live
  in memory and nowhere else.
- **`vendor/stores/enhanceStore.ts`** — reduced to the empty map Convert reads
  before anybody visits the Enhance screen.
- **`vendor/demo-reset.ts`** — see below.

Ten further divergences are marked in place across eight otherwise-untouched
product files. Seven remove a call into the operating system: the OS drag-drop
listener in `DropZone` and in `ConvertScreen`, the `project.json` write in
`assetStore`, the SVG rehydrate in `convertStore` and in `ConvertScreen`, the
last-screen write in `uiStore`, and the import dialog's new argument.

The other three are defects whose fix depends on something that is true here and
not in the product: a ref written during render in `DropZone` (upstream still
needs that ref, because upstream still has the listener it was written for), and
form state filled from an effect in both project modals.

Grep for `DEMO DIVERGENCE` to find all ten; every one is written up in
[upstream-findings.md](./upstream-findings.md).

### What is left, and why

Four demos still run approximations. The audited reason for each — including a
correction to an earlier claim about Frito, which does target the web and is
blocked by its Babel/Metro toolchain rather than by React Native — is in
[upstream-issues/vendoring-queue.md](./upstream-issues/vendoring-queue.md).

### Four findings went the other way

Four accessibility findings in the vendored tree were fixed **in the VectorForge
repository** and the vendored files overwritten from it — `prefer-tag-over-role`
in three components, `aria-selected` on a `listitem`, the hand-rolled
click/keydown control that the first fix exposed underneath it, and two
redundant ARIA roles.

That is the arrangement doing what it was built for. A vendored tree that is a
verbatim copy makes "fix it upstream and re-copy" a mechanical operation rather
than a negotiation: three files went back to being byte-for-byte the product's,
the demo got the fix, and the product keeps it. See
[upstream-issues/](./upstream-issues/) for what changed and what it cost in
CSS.

**Export is real.** `tauriExportSvgFile` opened a save dialog and wrote a file
through Rust. The browser equivalent needs no backend — a Blob and an anchor —
so the visitor gets the actual SVG the trace produced, byte for byte, and
nothing leaves the machine to make that happen.

### Lanna Kamilina: the one that was almost already isolated

Its `features/booking/api.ts` opens with a comment headed **BOOKING
INTEGRATION BOUNDARY**, declaring two interfaces and noting that connecting a
real booking system means writing new implementations and swapping the two
exported instances at the bottom of the file. The product ships both a
`mockBookingApi` and a live `messengerBookingApi`, and documents the mock as
"kept for local UI work; never wire it up as `bookingApi` on a live site".

So the central isolation step was one line — point `bookingApi` at the mock the
product already wrote. No adapter, no reimplementation. It is the clearest
demonstration so far of what this brief's §12 is actually asking of an
application, in a codebase that had done it before anyone asked.

**The `window.open` still had to go.** Swapping the export changed behaviour but
left `messengerBookingApi` — and its `window.open('https://wa.me/…?text=')`
carrying a visitor's name, telephone number and chosen time — sitting in the
shipped bundle as dead code. "Unreferenced" is a weaker guarantee than
"absent", so the implementation was deleted outright. That removed the only
`window.open` and the only clipboard write in the tree.

**The head was the bigger find.** `hooks/useSeo.ts` writes `document.title`, the
meta description, Open Graph tags, a `<link rel="canonical">` and JSON-LD into
the document, correctly, on every page. There is one document here and it
belongs to this website: left running, opening the demo would have retitled the
browser tab, pointed this page's canonical URL at `lannakamilina.ru`, and
injected `HairSalon` structured data into an Unchained Business page. The first
is visible; the other two are instructions to a search engine, and a canonical
pointing off-site is an instruction to deindex the page carrying it. The hook is
a no-op in the demo.

**MemoryRouter is the whole router adapter.** Mensalere needed a hand-written
`Link`; this one needed nothing. The product keeps the entire booking flow in
the query string — which is how a half-filled booking survives a refresh and how
a campaign deep-links into it — and `MemoryRouter` keeps that history in memory,
so `useNavigate`, `useSearchParams` and `Link` all work unmodified and the
address bar is never touched.

**The styling needed both treatments.** The tokens are Tailwind v4 `@theme`, so
they had to be namespaced like Mensalere's — `lk-`, across 22 tokens, 21 custom
`@utility` definitions and 379 class occurrences, rewritten only inside string
literals so the words `shell`, `rail`, `grain` and `reveal` could not be
rewritten where they appear in prose or in an identifier. But the product also
has an `@layer base` that styles `html`, `body`, `h1`–`h4`, `img`, `button` and
`::selection` outright, and those cannot travel with the tokens into a global
stylesheet — they became `vendor/styles/surface.module.css`, scoped to the
panel.

**No photograph is involved.** The salon's real client photography sits in
`public/`, 9.1 MB of it, and shipping pictures of identifiable clients into a
marketing demo is a consent question rather than a technical one. It did not
have to be answered: the specialists carry `portrait: { seed }` rather than a
path, and the product's own `Figure` component draws deterministic, on-brand
SVG art for any image without a `src`. The booking flow needs none of the
photography, and what it shows instead is the product's own placeholder, not an
approximation of one.

### Reset, when the state is not in the tree

Every other demo resets by remount: `DemoStage` changes the React `key` and the
`useReducer` inside is rebuilt. VectorForge is a Zustand application, and a
Zustand store is a module singleton — it survives every key change the shell can
think of. Pressing Reset would have rebuilt the components around state that
never moved.

Lanna Kamilina has the same problem in a different shape: its appointment book
is a module-level cache over a module-level store — the product's own design,
and the reason a booking made on one screen disappears from the calendar on
another.

So each vendored store exports its own reset beside its own definition, and
`vendor/demo-reset.ts` calls them from a `useState` initialiser in the demo's
`App.tsx`. That runs during the first render of the new tree and before its
children's, so the previous visitor's assets never paint for a frame. It is a
lifecycle hook used for its timing, deliberately; a module-level flag would not
re-run on a remount, which is the whole point.

### Why Mensalere needed almost no isolation work

Its `services/` layer is already backed by a mock store with simulated latency,
and has no `fetch`, no environment variable and no database anywhere in it. The
application was already built the way §12 describes, so the demo imports that
layer rather than reimplementing it. `psychologistService.list()` and
`availabilityService.getDays()` in the demo are the product's own functions.

### What this removed

Every vendored demo's hand-written approximation is deleted — 403 lines for
Lazara Sersa, a directory-and-diary reimplementation for Mensalere, for
VectorForge a 665-line `App.tsx` plus a reducer that modelled a trace, a
version history, an icon package and a batch queue with invented numbers, and
for Lanna Kamilina an `App.tsx`, a fixtures module and a 12-test reducer that
modelled a salon calendar which the product already had.

Lanna Kamilina's replacement tests are worth the contrast: the demo's
`booking.test.ts` drives the salon's **own** availability and booking layer, and
checks the things the demo claims rather than re-deriving them — that a long
service genuinely gets fewer windows than a short one, that "any specialist"
pools capacity, that a booked slot leaves that master's column, that the hour is
refused once the whole pool is taken, and that Reset empties the book. Eleven
tests, none of which describe a calendar this repository wrote.

For Lazara Sersa and Mensalere what remains in `lib/demo/apps/<slug>/state.ts`
is only the selection each product keeps in its URL. VectorForge has no
`state.ts` at all: its state is the product's own stores. What replaced the
reducer is `trace.ts` — the real geometric and colour operations behind the
sliders — and its 21 tests check the two claims the demo makes to a prospect:
that the same recipe gives the same file, and that every control moves the
output in the direction its label promises.

Their tests shrank accordingly, because the product's own components, services
and stores are tested in the product's own repository.

### What it cost, measured

Every figure below is from a real build, measured the same way — the sum of
every JS and CSS file the prerendered HTML references. The VectorForge column
was measured against a clean build of the preceding commit.

| route | before VectorForge | after VectorForge | after Lanna Kamilina |
|---|---|---|---|
| `/` | 1167 KB raw / 359 gzip | 1167 / 359 | 1183 / 362 |
| `/work` | 1094 KB | 1094 KB | 1110 KB |
| any `/work/*/demo` | 1361 KB raw / 407 gzip | 1475 / 433 | 1611 / 473 |

VectorForge's entire desktop frontend — 84 files, the design system, Zustand
and two self-hosted font families — cost **26 KB gzipped on demo routes and
nothing anywhere else**. Lanna Kamilina cost **40 KB gzipped on demo routes**,
plus react-router and two more font families.

Plus 92 KB of PNG for VectorForge's source images, requested only when the
Convert screen shows an asset. Lanna Kamilina requests no image at all: its
placeholder art is inline SVG drawn from a seed.

The demo-route figure lands on *every* demo route rather than only the one
concerned, because Turbopack still groups all eight demo chunks together
(documented in §7).

#### The one regression, and where it comes from

`/` went up **16 KB raw, 3 KB gzip**, and `/work` with it. That is not a demo
chunk leaking — a marker scan of every JavaScript file the homepage loads finds
no product code, only the demo registry, which is 15 KB of route metadata and
`() => import(…)` thunks and is meant to be there.

It is CSS, and it is structural. Tailwind v4 registers `@theme` tokens and
`@utility` definitions **globally**: there is no mechanism to scope either to a
subtree, so the namespaced `ms-` and `lk-` tokens and the utilities generated
from them live in `app/globals.css` and therefore in the stylesheet every route
loads. Mensalere's share was already in the baseline; Lanna Kamilina added
these 16 KB.

It only applies to the two products that use Tailwind. Lazara Sersa and
VectorForge ship CSS modules, which Next scopes to the route that imports them,
and neither adds a byte to a non-demo page.

The remedy, if 3 KB gzipped ever matters: stop generating those utilities with
Tailwind and emit the ~40 distinct rules the vendored files actually use into
the demo's own scoped stylesheet. That trades a global 3 KB for a build step
and a hand-maintained list, which is not obviously the better deal at this
size — so it is recorded here rather than done.
