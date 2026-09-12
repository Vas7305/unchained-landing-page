# Upstream findings — vendored product frontends

Two demos run their product's own frontend, copied into
`components/demo/apps/<slug>/vendor/`. Static analysis over this repository
therefore also analyses **the products' code**, and reports findings that belong
to the product repositories rather than to this one.

They are recorded here rather than patched, because the value of the vendored
copy is that it is *the product* — a re-copy should be an overwrite, not a
merge. The two exceptions are marked below: both are pure, behaviour-preserving
optimisations in the demo's interactive hot path, and both carry a comment in
the file saying so.

Sources:

- **Lazara Sersa** — `/d/Sersa Sarria`
- **Mensalere** — `/d/Mensalere`

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

### 2. Context value rebuilt every render — MEDIUM

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

### 3. Chained `filter().map()` over small arrays — LOW

- **Rule** `react-doctor/js-combine-iterations`
- **Files** `src/services/availabilityService.ts:47`,
  `src/services/psychologistService.ts:84`
- **Confidence** High that the pattern is present; low that it matters.
- **Impact** Both arrays are small — the appointment store and a handful of
  professionals — so the intermediate array is negligible. Worth collapsing to
  `flatMap` if either collection grows.

### 4. `Array.includes` inside a filter — LOW

- **Rule** `react-doctor/js-set-map-lookups`
- **File** `src/services/psychologistService.ts:89`
- **Confidence** High / negligible impact. Both `specialties` and
  `answers.concerns` hold at most a handful of entries, so a `Set` would cost
  more to build than it saves.

### 5. One-off `Intl` construction — LOW

- **Rule** `react-doctor/js-hoist-intl`
- **File** `lib/inquiry-message.ts:66` (Lazara Sersa)
- **Impact** Constructed once per inquiry submission, not in a loop. Hoisting
  would be tidy, not consequential.

### 6. Mixed exports in component files — LOW

- **Rule** `react-doctor/only-export-components`
- **Files** `src/components/ui/button.tsx:129,136,142`,
  `src/components/ui/input.tsx:33`
- **Impact** `buttonVariants` / `inputVariants` exported beside the component.
  This is the conventional shadcn/cva layout; the only cost is that React Fast
  Refresh reloads the module instead of hot-swapping the component. A product
  decision, not a defect.

---

## Assessed and rejected — false positives

### 7. Index used as a key

- **Rule** `react-doctor/no-array-index-as-key`
- **File** `components/foundations/TypographyBlock.tsx:64` (Lazara Sersa)
- **Verdict** Not a defect. The paragraphs come from a static `body` prop and
  are never inserted, removed or reordered, so the index is a stable identity.

### 8. Click handler without a keyboard handler / handler on a non-interactive element

- **Rules** `react-doctor/click-events-have-key-events`,
  `react-doctor/no-noninteractive-element-interactions`
- **File** `components/inquiry/InquiryModal.tsx:167` (Lazara Sersa)
- **Verdict** Not a defect. The element is a native `<dialog>`, which *is*
  interactive and closes on Escape without any handler. The click handler
  implements click-outside-to-close by comparing `event.target` against the
  dialog element itself — the backdrop. The rules target `<div onClick>`.

### 9. Plain `<img>` instead of `next/image`

- **Rule** `react-doctor/nextjs-no-img-element`
- **Files** `src/components/ui/avatar.tsx:34`, `src/components/ui/portrait.tsx:48`
- **Verdict** Not applicable. Mensalere is a Vite SPA, where `<img>` is the
  correct element. In *this* repository `next.config.ts` sets
  `images: { unoptimized: true }`, so `next/image` would add wrapper markup and
  optimise nothing.
