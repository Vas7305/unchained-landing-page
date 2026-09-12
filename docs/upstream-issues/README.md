# Findings that belong to the product repositories

Static analysis over this repository also analyses the **vendored product
frontends** under `components/demo/apps/<slug>/vendor/`, because that code is
the products' code. Every finding is analysed in
[../upstream-findings.md](../upstream-findings.md); this directory is about what
happened to the ones that belong upstream.

## Fixed in `Vas7305/VectorForge-V-1.0`, then re-copied

These were fixed **in the product repository** and the vendored copies were
overwritten from it — which is the property the whole vendoring arrangement
exists for. The changes are in the VectorForge working tree, uncommitted, on
`main`; branch and commit them there.

| rule | files | what changed |
|---|---|---|
| `prefer-tag-over-role` ×5 | `AssetBrowser.tsx`, `DropZone.tsx`, `SidebarProjectsSection.tsx` | `<div role="list">` → `<ul>`, `<div role="listitem">` → `<li>`, `<div role="button">` → `<button type="button">` |
| `role-supports-aria-props` | `AssetBrowser.tsx` | `aria-selected` on a `listitem` — which screen readers ignore — replaced by `aria-current` |
| `no-noninteractive-element-interactions` | `AssetBrowser.tsx` | the row's hand-rolled click/keydown control replaced by a real `<button>` |
| `no-redundant-roles` ×2 | `RightPanel.tsx`, `TopBar.tsx` | `role="complementary"` off `<aside>`, `role="banner"` off `<header>` |

Verified in the VectorForge repo after the change: `tsc --noEmit` clean,
**773 tests across 55 files passing**.

### What `prefer-tag-over-role` turned out to be hiding

Converting `AssetBrowser`'s row from `<div role="listitem">` to `<li>` made a
second rule fire that the role attribute had been masking: the row was a
hand-rolled interactive control — `tabIndex={0}`, `onClick`, and an `onKeyDown`
special-casing Enter and Space.

It could not simply become a `<button>`, because it contains two `<button>`s of
its own and nesting them is invalid. The structure that fits is the one the
codebase already uses one file over, in `SidebarProjectsSection`: a list item
holding a button for the selectable part, with the action buttons as siblings.
That is what was applied. It also deleted the `onClick={(e) =>
e.stopPropagation()}` wrapper around the actions — with the actions outside the
clickable region, there is no longer a click to stop.

The `<div>`s inside the new button became `<span>`s, since a `<button>` may only
contain phrasing content. Every one of them already carried an explicit
`display` in the stylesheet, so nothing moved.

### Stylesheet changes that had to come with it

User-agent styles do not disappear on their own, and the app's `*` reset only
zeroes margin and padding:

- `.browser`, `.list` — `list-style: none`. Needed outright in
  `SidebarProjectsSection`, where the empty-state `<li>` is a plain block and
  would otherwise draw a bullet.
- `.zone`, `.select` — `appearance: none`, `font: inherit`, `color: inherit`,
  `text-align: inherit`, because both are now `<button>`s.
- `.item` dropped a grid column and `.select` picked it up; focus moved from
  `.item:focus-visible` to `.select:focus-visible`, since the button is what
  receives focus now.

## Fixed in `Vas7305/Lanna-Kamilina`, then re-copied

Same pass, same arrangement. Changes are in the Lanna Kamilina working tree,
uncommitted, on `main`.

| rule | files | what changed |
|---|---|---|
| `set-state-in-effect` ×3 | `Header.tsx`, `BookingFlow.tsx`, `useAvailability.ts` | state that follows a prop now adjusts during render instead of from an effect |
| `no-impure-call-at-module-scope` | `data/business.ts` | `yearsInBusiness` was a module-scope `new Date()`; now a function |
| `rerender-lazy-state-init` ×2 | `BookingFlow.tsx` | `useState(params.get(…))` → lazy initialisers |
| `prefer-module-scope-static-value` | `ContactLinks.tsx` | a constant array hoisted out of the component |
| `js-combine-iterations` ×4, `js-set-map-lookups` ×5 | `data/index.ts`, `BookingFlow.tsx`, `lib/seo.ts` | list walks collapsed to one pass; repeated `includes` scans replaced by a `Set` built once |

Verified after the change: `tsc --noEmit` clean, `vite build` green. The
repository has no test suite.

### The iteration fixes, judged one at a time

The data is small — 28 services, 6 specialists, 18 portfolio items, 14 reviews —
so none of these was a measurable cost. They were taken because each reads
better as a single pass and two sit in paths that run on a keystroke, not
because a benchmark demanded it:

- **`getRelatedServices`** and **`getPortfolioByTags`** scored every candidate
  by re-scanning a reference tag array that never changes during the scan. The
  reference is now a `Set` built once, and the map/filter/map chain is one loop.
- **`getPortfolioForService`** decided membership with `!direct.includes(item)`
  inside a filter — a linear search per item. `direct` is now a `Set`.
- **`getBeforeAfterItems`** walked the list three times and worked out the
  second group by searching the first. It now partitions in one pass, which is
  also simply what the function means.
- **`BookingFlow`'s service picker** mapped every category then filtered the
  empty ones back out, on every keystroke in the search box. One `flatMap`.
- **`lib/seo.ts`** filtered then mapped the opening hours. One `flatMap`.

**One was left alone deliberately.** `schedule.ts:157` is `prune(read())` — two
named functions, one validating the stored shape and one dropping yesterday's
appointments. The rule sees two passes; merging them would fuse two unrelated
concerns into one function to save a walk over a list that holds a handful of
entries. It is reported below rather than fixed.

### What each of the three effects was costing

All three were the same shape — state that has to follow something else,
written from an effect, which runs *after* the render it reacts to has painted:

- **`Header`** closed the mobile menu on navigation. The menu stayed open over
  the new page for a frame; most visible on a slow phone, which is the only
  place that menu exists.
- **`BookingFlow`** dropped a chosen time that had stopped being available. The
  slot the visitor had just lost was painted once more, still highlighted,
  before being cleared.
- **`useAvailability`** cleared the window when the service was deselected. The
  calendar kept the previous service's days on screen for a frame, which reads
  as the picker briefly offering the wrong thing.

## Still open upstream

| draft | rule | confidence | why not fixed |
|---|---|---|---|
| [convert-screen-size](./vectorforge-convert-screen-size.md) | `no-giant-component`, `no-high-complexity-react-function` | high | Restructuring `ConvertScreen` would turn every future re-copy into a manual merge. The benefit is only permanent if it happens upstream. |
| [booking-flow-size](./lanna-kamilina-booking-flow-size.md) | `no-giant-component` | high | Same reasoning, for Lanna Kamilina's 660-line `BookingFlow`. |

The GitHub CLI is not installed on this machine (`gh: command not found`), so
this is a file rather than a filed issue. To file it:

```bash
gh issue create --repo Vas7305/VectorForge-V-1.0 \
  --title "refactor: ConvertScreen is ~690 lines and holds six regions" \
  --body-file docs/upstream-issues/vectorforge-convert-screen-size.md

gh issue create --repo Vas7305/Lanna-Kamilina \
  --title "refactor: BookingFlow is ~660 lines and holds five steps plus the form" \
  --body-file docs/upstream-issues/lanna-kamilina-booking-flow-size.md
```

Three further defects are fixed **only** in the vendored copy, because the fix
depends on something that is true in the demo and not in the product. They are
described in [../upstream-findings.md](../upstream-findings.md) §2, §3 and §4,
and are worth taking upstream in their own right:

- a ref written during render in `DropZone` (§2) — upstream still needs the ref,
  because upstream still has the Tauri listener that motivated it;
- form state filled from an effect in both project modals (§3);
- a `<dialog>` with no accessible name in `Modal` (§4).

## Assessed and rejected, so not filed

- **`nextjs-no-img-element`** — **now disabled** in `doctor.config.json`, on
  the maintainer's instruction. Every occurrence is in a `vendor/` copy of a
  product that is not a Next.js application, and `next.config.ts` sets
  `images: { unoptimized: true }`, so `next/image` would add wrapper markup and
  optimise nothing. The full evidence, and the note that the rule should come
  back on if this repository ever grows a first-party `<img>`, is in
  [nextjs-no-img-element-decision.md](./nextjs-no-img-element-decision.md).
- **`js-combine-iterations`** (`features/booking/schedule.ts:157`). Real, and
  left as it is on purpose. The line is `prune(read())`: one function validates
  what came out of the store, the other drops appointments that are already in
  the past. Collapsing them would merge two unrelated concerns to save one walk
  over a list that holds a handful of entries. The other nine findings in this
  family were fixed upstream — see above.
- **`no-match-media-in-state-initializer`** (`hooks/useUi.ts:7`). Not
  applicable. The rule guards against a server/client hydration mismatch. Lanna
  Kamilina is a Vite SPA with no server render at all, and in this repository
  the demo tree is gated behind a client-only check in `DemoStage`, so the
  initializer never runs anywhere but the browser.
- **`no-noninteractive-element-interactions`** (`Modal.tsx:45`). Not a defect.
  The element is a native `<dialog>`, which *is* interactive; the handler
  implements click-outside-to-close by comparing `event.target` against the
  dialog itself — the backdrop. The rule targets `<div onClick>`. The same
  pattern in Lazara Sersa's `InquiryModal` was assessed the same way.
