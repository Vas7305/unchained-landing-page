# Upstream findings — vendored product frontends

Three demos run their product's own frontend, copied into
`components/demo/apps/<slug>/vendor/`. Static analysis over this repository
therefore also analyses **the products' code**, and reports findings that belong
to the product repositories rather than to this one.

They are recorded here rather than patched, because the value of the vendored
copy is that it is *the product* — a re-copy should be an overwrite, not a
merge. The exceptions are the five under "Fixed locally" below. Each is
behaviour-preserving, each sits in a path a visitor actually exercises, and
each carries a `DEMO DIVERGENCE` comment in the file saying what changed and
why. Everything else is left exactly as the product wrote it.

Sources:

- **Lazara Sersa** — `/d/Sersa Sarria`
- **Mensalere** — `/d/Mensalere`
- **VectorForge** — `/d/VectorForge-V-1.0` (`Vas7305/VectorForge-V-1.0`)

The findings that are confirmed, belong to a product, and were deliberately not
patched here are also written out as ready-to-file issue bodies in
[upstream-issues/](./upstream-issues/).

---

## Fixed locally (and still worth fixing upstream)

### 1. `Intl.DateTimeFormat` rebuilt per calendar cell — HIGH

- **Rule** `react-doctor/js-hoist-intl`
- **File** `src/lib/date.ts:20, 29, 38, 50` (Mensalere)
- **Confidence** High — read and traced to the call site.
- **Impact** `AvailabilityCalendar` calls `formatDateLong(cell)` once per cell
  (`availability-calendar.tsx:98`). A month grid is 35–42 cells, so a single
  render constructs 35–42 `Intl.DateTimeFormat` objects, and the calendar
  re-renders every time a visitor picks a day. Constructing a `DateTimeFormat`
  is among the most expensive operations available to a render loop.
- **Fix** Hoist the four formatters to module constants. Same locale, same
  options, identical output.
- **Status here** Applied in `vendor/lib/date.ts` with a comment explaining the
  divergence.

### 2. Refs written during render — HIGH

- **Rule** `react-hooks/refs`
- **File** `src/components/composites/DropZone.tsx:30–33` (VectorForge)
- **Confidence** High — read and traced.
- **Impact** `DropZone` holds `onFiles` and `showToast` in refs that it assigns
  during render (`onFilesRef.current = onFiles`). The reason is real — the
  Tauri drag-drop listener is registered once with `[]` deps and must still see
  the latest props — but writing a ref during render is unsafe under concurrent
  rendering: React may render a component without committing it, and the ref
  then holds props from a render that never happened.
- **Fix upstream** Keep the listener registration in an effect, but read the
  props through a ref that is *written in an effect* rather than during render,
  or re-register the listener when the handlers change. The second is cheaper
  than it looks: `onDragDropEvent` returns its own unlisten.
- **Status here** Not applicable in the same form. The Tauri listener has no
  browser equivalent and was removed, which left the click handler as the only
  consumer — so the refs went with it and the props are in the dependency
  array. Commented in place.

### 3. Form state filled from an effect — MEDIUM

- **Rule** `react-hooks/set-state-in-effect`
- **Files** `src/components/dashboard/NewProjectModal.tsx:19`,
  `src/components/dashboard/EditProjectModal.tsx:27`
- **Confidence** High.
- **Impact** Both modals clear or fill their form from a `useEffect` keyed on
  `open`. The effect runs *after* the render that opened the dialog has
  painted, so Edit shows an empty name field for one frame before the project's
  name appears, and New can show the previous project's values on reopen. It
  also costs a second render pass every time either dialog is opened or closed.
- **Fix** React's documented remedy for state that has to follow a prop:
  compare the prop to a stored copy during render and set state there. The
  component re-renders immediately, before anything is painted.
- **Status here** Applied in both vendored modals with a comment. This one is
  worth taking upstream unchanged — it is a visible flash in the product.

### 4. Modal dialog with no accessible name — MEDIUM

- **Rule** `react-doctor/dialog-has-accessible-name`
- **File** `src/components/primitives/Modal.tsx:38` (VectorForge)
- **Confidence** High — read and confirmed.
- **Impact** `Modal` renders its `title` in a `<span>` inside the panel but
  never connects it to the `<dialog>`. A screen reader announces "dialog" and
  stops: the one piece of information a blind user needs at that moment — which
  dialog — is on screen and unreachable. Every modal in the application
  inherits this, including the destructive-confirm variant.
- **Fix** A `useId`, `id` on the title span, `aria-labelledby` on the dialog.
  Three lines, no behaviour change.
- **Status here** Applied with a comment. This is the one finding in the
  vendored trees that a real user of the demo would hit, which is why it was
  fixed rather than only recorded.

### 5. Context value rebuilt every render — MEDIUM

- **Rule** `react-doctor/context-provider-value-from-unmemoized-local-literal`
- **File** `src/components/ui/field.tsx:61`
- **Confidence** High.
- **Impact** `Field` passes a fresh object literal to `FieldContext.Provider`,
  so the context identity changes on every render and every consumer — label,
  control, description, error — re-renders even when nothing about the field
  changed. Multiplied by the number of fields in a form.
- **Fix** `useMemo` over `[id, description, error, required]`; the value is
  derived entirely from those.
- **Status here** Applied in `vendor/ui/field.tsx` with a comment.

---

## Reported, not fixed — real but low impact

### 6. Chained `filter().map()` over small arrays — LOW

- **Rule** `react-doctor/js-combine-iterations`
- **Files** `src/services/availabilityService.ts:47`,
  `src/services/psychologistService.ts:84`
- **Confidence** High that the pattern is present; low that it matters.
- **Impact** Both arrays are small — the appointment store and a handful of
  professionals — so the intermediate array is negligible. Worth collapsing to
  `flatMap` if either collection grows.

### 7. `Array.includes` inside a filter — LOW

- **Rule** `react-doctor/js-set-map-lookups`
- **File** `src/services/psychologistService.ts:89`
- **Confidence** High / negligible impact. Both `specialties` and
  `answers.concerns` hold at most a handful of entries, so a `Set` would cost
  more to build than it saves.

### 8. One-off `Intl` construction — LOW

- **Rule** `react-doctor/js-hoist-intl`
- **File** `lib/inquiry-message.ts:66` (Lazara Sersa)
- **Impact** Constructed once per inquiry submission, not in a loop. Hoisting
  would be tidy, not consequential.

### 9. Mixed exports in component files — LOW

- **Rule** `react-doctor/only-export-components`
- **Files** `src/components/ui/button.tsx:129,136,142`,
  `src/components/ui/input.tsx:33`
- **Impact** `buttonVariants` / `inputVariants` exported beside the component.
  This is the conventional shadcn/cva layout; the only cost is that React Fast
  Refresh reloads the module instead of hot-swapping the component. A product
  decision, not a defect.

---

### 10. `aria-selected` on a `listitem`, and the widget under it — MEDIUM

- **Rule** `jsx-a11y/role-supports-aria-props`
- **File** `src/components/composites/AssetBrowser.tsx:69` (VectorForge)
- **Confidence** High that it is wrong; low that anyone is harmed by it.
- **Impact** The asset rows are `role="listitem"` inside a `role="list"`, and
  carry `aria-selected`. `listitem` does not support that state, so a screen
  reader announces the rows without ever saying which one is open — the single
  most important fact about that list.
- **Fix** `role="listbox"` on the container and `role="option"` on the rows,
  which supports `aria-selected` and gives the widget its keyboard contract for
  free. The rows already carry `tabIndex`, `onClick` and an Enter/Space
  `onKeyDown`, so most of the behaviour is there — it is the roles that are
  wrong, not the interaction.
- **Status here** Reported, not fixed. Unlike the dialog name above, this one
  changes a widget's whole accessibility contract — roving tabindex,
  `aria-activedescendant`, arrow-key navigation — and choosing that from
  outside the product is how a demo starts drifting from the application it is
  supposed to be showing. It belongs to whoever owns the asset browser.

### 11. ARIA roles where an HTML element would do — LOW

- **Rule** `react-doctor/prefer-tag-over-role`
- **Files** `src/components/composites/AssetBrowser.tsx:55,71`,
  `src/components/composites/DropZone.tsx:51`,
  `src/components/layout/SidebarProjectsSection.tsx:56,66`
- **Impact** `<div role="list">`, `<div role="listitem">`, `<div role="button">`
  where `<ul>`, `<li>` and `<button>` carry the same semantics natively, for
  free, with keyboard behaviour included. `DropZone`'s is the one with teeth:
  a real `<button>` would not need the hand-written Enter/Space handler it has.
- **Status here** Reported. Same reasoning as #10 — these are the product's
  markup decisions.

### 12. Redundant ARIA roles — LOW

- **Rule** `react-doctor/no-redundant-roles`
- **Files** `src/components/layout/RightPanel.tsx:10`,
  `src/components/layout/TopBar.tsx:60`
- **Impact** None, beyond noise: `role="complementary"` on `<aside>` and
  `role="banner"` on `<header>` restate what the element already means. Worth
  deleting on the next pass through those files.

---

## Assessed and rejected — false positives

### 13. Index used as a key

- **Rule** `react-doctor/no-array-index-as-key`
- **File** `components/foundations/TypographyBlock.tsx:64` (Lazara Sersa)
- **Verdict** Not a defect. The paragraphs come from a static `body` prop and
  are never inserted, removed or reordered, so the index is a stable identity.

### 14. Click handler without a keyboard handler / handler on a non-interactive element

- **Rules** `react-doctor/click-events-have-key-events`,
  `react-doctor/no-noninteractive-element-interactions`
- **File** `components/inquiry/InquiryModal.tsx:167` (Lazara Sersa)
- **Verdict** Not a defect. The element is a native `<dialog>`, which *is*
  interactive and closes on Escape without any handler. The click handler
  implements click-outside-to-close by comparing `event.target` against the
  dialog element itself — the backdrop. The rules target `<div onClick>`.

### 15. Plain `<img>` instead of `next/image`

- **Rule** `react-doctor/nextjs-no-img-element`
- **Files** `src/components/ui/avatar.tsx:34`, `src/components/ui/portrait.tsx:48`
- **Verdict** Not applicable. Mensalere is a Vite SPA, where `<img>` is the
  correct element. In *this* repository `next.config.ts` sets
  `images: { unoptimized: true }`, so `next/image` would add wrapper markup and
  optimise nothing.

### 16. `dangerouslySetInnerHTML` on the SVG preview

- **Rule** `react/no-danger` (via the product's own inline disable)
- **File** `src/screens/ConvertScreen.tsx:598, 630` (VectorForge)
- **Verdict** Not a defect, and the disable comments are now redundant — this
  repository's config does not enable the rule, which is why it reports them as
  unused directives. The markup being injected is the tracer's own output. In
  the product that comes from its Rust core; in the demo it is a string
  literal in `lib/demo/apps/vector-forge/data.ts` transformed by pure functions
  that only move numbers and rewrite hex colours. There is no path by which
  visitor input reaches it.

---

## Real, but belongs upstream by construction

### 17. Convert screen size and complexity

- **Rules** `react-doctor/no-giant-component`,
  `react-doctor/no-high-complexity-react-function`
- **Files** `src/screens/ConvertScreen.tsx:107`, `src/screens/ConvertPanel.tsx:21`
- **Verdict** Real, and out of scope to fix here. `ConvertScreen` is ~690 lines
  holding a toolbar, an asset rail, a control panel, three preview layouts and a
  drop overlay; the recipe that worked on the demos' own `App.tsx` files —
  extract each region into a sibling component taking the props it needs —
  applies unchanged.
  It is not applied here for the reason the whole vendoring exists: this file is
  the product, and a re-copy from the VectorForge repository should be an
  overwrite rather than a merge. Restructuring it would make every future
  re-copy a manual reconciliation. Worth doing **upstream**, where the benefit
  is permanent.
