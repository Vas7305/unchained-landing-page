# a11y: five places use an ARIA role where the HTML element already means it

**Rule** `react-doctor/prefer-tag-over-role`
**Confidence** High — each site was read and confirmed.
**Severity** Low. Nothing is broken for users today; this is about the markup
carrying its meaning itself instead of asserting it.

Found while vendoring the Convert screen into the Unchained Business site's
interactive demo, so the line numbers are `src/`-relative against
VectorForge-V-1.0 as of that copy.

## Sites

| file | line | current | should be |
|---|---|---|---|
| `src/components/composites/AssetBrowser.tsx` | 55 | `<div className={styles.browser} role="list">` | `<ul>` |
| `src/components/composites/AssetBrowser.tsx` | 71 | `<div className={styles.item} role="listitem">` | `<li>` |
| `src/components/composites/DropZone.tsx` | 51 | `<div className={styles.zone} role="button" tabIndex={0} onKeyDown={…}>` | `<button type="button">` |
| `src/components/layout/SidebarProjectsSection.tsx` | 56 | `<div className={styles.list} role="list">` | `<ul>` |
| `src/components/layout/SidebarProjectsSection.tsx` | 66 | `<div className={styles.row} role="listitem">` | `<li>` |

## Why it is worth doing

The computed accessibility tree is already correct — an explicit `role` is
exactly as good as an implicit one to a screen reader — so this is not an
accessibility bug. The value is elsewhere:

- **`DropZone` is the one with teeth.** It hand-rolls a button: `role="button"`,
  `tabIndex={0}`, and an `onKeyDown` that special-cases `Enter` and `Space`. A
  real `<button type="button">` gives all three for free, and also gets the
  things the hand-rolled version misses — the active state, the disabled
  semantics, form participation, and the click-on-Space-*keyup* behaviour that
  matches the platform rather than approximating it. That handler is ~8 lines
  that can be deleted.
- **The list pairs** are cheap and make the markup self-describing.

## What to watch when fixing

Both changes bring user-agent styles with them, and the app's reset does not
cover all of them:

- `globals.css` zeroes `margin` and `padding` via `*`, but **not**
  `list-style`. Converting the two `role="list"` divs to `<ul>` needs
  `list-style: none` on `.browser` and `.list`, or the rows grow bullets.
- `<button>` brings its own `border`, `background`, `font` and `text-align`.
  `.zone` sets its own border and background but inherits font from the body
  today, so it needs `font: inherit` (and `text-align: inherit` if the content
  is not centred) to look unchanged.

Worth verifying visually rather than by eye on the diff — that is why this was
not applied blind in the vendored copy.

## Status in the demo

Not patched there. The vendored tree is kept as a verbatim copy so that
re-copying from this repository is an overwrite rather than a merge, and this
change would alter both the product's JSX and its CSS modules for no
user-visible gain. Recorded in `docs/upstream-findings.md` §11.
