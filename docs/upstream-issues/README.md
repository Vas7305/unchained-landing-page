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

## Still open upstream

| draft | rule | confidence | why not fixed |
|---|---|---|---|
| [convert-screen-size](./vectorforge-convert-screen-size.md) | `no-giant-component`, `no-high-complexity-react-function` | high | Restructuring `ConvertScreen` would turn every future re-copy into a manual merge. The benefit is only permanent if it happens upstream. |

The GitHub CLI is not installed on this machine (`gh: command not found`), so
this is a file rather than a filed issue. To file it:

```bash
gh issue create --repo Vas7305/VectorForge-V-1.0 \
  --title "refactor: ConvertScreen is ~690 lines and holds six regions" \
  --body-file docs/upstream-issues/vectorforge-convert-screen-size.md
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

- **`nextjs-no-img-element`** — written up in full, with the evidence and the
  two configuration options, in
  [nextjs-no-img-element-decision.md](./nextjs-no-img-element-decision.md).
  Short version: every occurrence is in a `vendor/` copy of a product that is
  not a Next.js application, and `next.config.ts` sets
  `images: { unoptimized: true }`, so `next/image` would add wrapper markup and
  optimise nothing.
- **`no-noninteractive-element-interactions`** (`Modal.tsx:45`). Not a defect.
  The element is a native `<dialog>`, which *is* interactive; the handler
  implements click-outside-to-close by comparing `event.target` against the
  dialog itself — the backdrop. The rule targets `<div onClick>`. The same
  pattern in Lazara Sersa's `InquiryModal` was assessed the same way.
