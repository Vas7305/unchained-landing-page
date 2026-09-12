# Decision: `nextjs-no-img-element` does not apply to vendored product code

**Rule** `react-doctor/nextjs-no-img-element` — Category: Bugs, default
severity `warn`, framework `nextjs`, tagged `test-noise`. It is opt-in by
default and auto-enabled here because the repository is detected as a Next.js
app; nothing in this repository had configured it on.

**Status: disabled.** `doctor.config.json` now sets it to `off`, on the
maintainer's instruction, after the analysis below. That file did not exist
before — `npx react-doctor rules disable react-doctor/nextjs-no-img-element`
created it:

```json
{
  "$schema": "https://react.doctor/schema/config.json",
  "rules": {
    "react-doctor/nextjs-no-img-element": "off"
  }
}
```

This document is the reasoning behind that one line, and is the thing to read
before re-enabling it. **The rule should come back on if this repository ever
grows a first-party `<img>`** — everything below argues only that it does not
apply to *vendored copies of non-Next applications*, not that `next/image` is
unnecessary in code this project actually writes.

**Where it fires**

| file | line |
|---|---|
| `components/demo/apps/vector-forge/vendor/composites/AssetBrowser.tsx` | 37 |
| `components/demo/apps/vector-forge/vendor/screens/ConvertScreen.tsx` | 582, 615 |
| `components/demo/apps/mensalere/vendor/ui/avatar.tsx` | 34 |
| `components/demo/apps/mensalere/vendor/ui/portrait.tsx` | 48 |

Every one is inside a `vendor/` directory — a verbatim copy of a product's own
frontend. None is in code this repository wrote.

## Why it cannot be fixed in the vendored copy

**The products are not Next.js applications.** VectorForge is Tauri + Vite;
Mensalere is a Vite SPA. `<img>` is the correct element in both, and neither can
import `next/image` without taking on Next as a dependency. Changing the
vendored copies would also break the property the vendoring exists for — that a
re-copy from the product repository is an overwrite rather than a merge. That
property was exercised in this very pass: five accessibility findings were fixed
in `Vas7305/VectorForge-V-1.0` and the vendored files overwritten from it, and
three of them went back to being byte-for-byte the product's. A `next/image`
edit would put a permanent manual reconciliation in the middle of that.

**And it would optimise nothing.** `next.config.ts` sets:

```ts
images: {
  unoptimized: true,
}
```

With that set, `next/image` performs no format conversion, no resizing and no
responsive `srcset` — the three things the rule's rationale names. What it would
add is wrapper markup. For the two in `ConvertScreen` that wrapper is actively
harmful: both `<img>`s sit inside a `PreviewCanvas` scaled by the CSS `zoom`
property, driven by the product's zoom control, and an extra positioned wrapper
between the canvas and the image changes what that control scales.

**The lazy loading is already there.** `AssetBrowser.tsx:37` carries
`loading="lazy"` in the product's own source. The demo's three source rasters
total 92 KB and are served from `public/demo/vector-forge/`, on demo routes
only — measured, not assumed.

## Verdict

False positive for this codebase, at high confidence, on evidence from the files
and from `next.config.ts`. **No GitHub issue was filed**, in either repository:
the product repositories are correct as they stand, so an issue there would be
noise in someone else's tracker, and there is nothing for this repository to fix
either.

## The alternative, if the trade-off ever changes

Turning the rule off everywhere is the blunt instrument. The narrower option
keeps it reporting locally and only stops it gating:

```jsonc
{
  "surfaces": {
    "ciFailure": { "excludeRules": ["react-doctor/nextjs-no-img-element"] }
  }
}
```

That is the better shape the moment this repository has a first-party `<img>`
of its own — the rule would then be catching something real, and silencing it
outright would hide it. Until then, `"off"` and this document say the same
thing with less ceremony.

Worth knowing either way: the Stop hook scans **uncommitted** changes
(`--scope changed --include-untracked`), so these warnings leave it once the
vendored trees are committed. That is why Mensalere's two never blocked
anything, and it means the configuration matters mainly for the *next*
vendoring pass rather than for this one.
