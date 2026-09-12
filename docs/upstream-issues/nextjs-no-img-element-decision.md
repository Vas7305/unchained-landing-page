# Decision: `nextjs-no-img-element` does not apply to vendored product code

**Rule** `react-doctor/nextjs-no-img-element` — Category: Bugs, default
severity `warn`, framework `nextjs`, tagged `test-noise`. It is opt-in by
default and auto-enables here because the repository is detected as a Next.js
app. There is no `doctor.config.*` in this repository and no `reactDoctor` key
in `package.json`; nothing was configured to turn it on.

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

## If the warning should stop firing

The rule is on by framework detection, not by choice, and it is the only
diagnostic left in the changed-file scan. Two options, neither applied here —
suppressing a rule is a maintainer's decision, not one to take silently:

```bash
# Narrowest control that matches the intent: the rule does not apply to this
# codebase, because the code it flags is not Next.js code.
npx react-doctor@latest rules disable react-doctor/nextjs-no-img-element
```

or keep it enabled for any first-party Next code added later and exclude it from
the blocking surface only, by adding to `doctor.config.json`:

```jsonc
{
  "surfaces": {
    "ciFailure": { "excludeRules": ["react-doctor/nextjs-no-img-element"] }
  }
}
```

The second is better if this repository ever grows a first-party `<img>`: the
rule keeps reporting locally and stops gating.

Note that the Stop hook scans **uncommitted** changes
(`--scope changed --include-untracked`), so these warnings disappear from it
once the vendored trees are committed — which is why Mensalere's two have not
been blocking anything. That makes this a question about the next vendoring
pass, not about the current one.
