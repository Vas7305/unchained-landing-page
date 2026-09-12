# refactor: ConvertScreen is ~690 lines and holds six regions

**Rules** `react-doctor/no-giant-component`,
`react-doctor/no-high-complexity-react-function`
**Confidence** High — read in full while vendoring it.
**Severity** Maintainability. No user-facing defect.

Found while vendoring the Convert screen into the Unchained Business site's
interactive demo. Line numbers are `src/`-relative against VectorForge-V-1.0 as
of that copy.

## Where

- `src/screens/ConvertScreen.tsx:107` — `no-giant-component` **and**
  `no-high-complexity-react-function`
- `src/screens/ConvertPanel.tsx:21` — `no-high-complexity-react-function`

## What is in there

`ConvertScreen` is one function holding six regions that do not share state
with each other beyond what the stores already provide:

1. the toolbar — filename, output badge, import, preview-mode segmented
   control, six zoom buttons, node-overlay toggle;
2. the empty/onboarding state;
3. the full-bleed drop zone for a project with no assets;
4. the left rail — asset browser, four mode cards, three sliders, the
   simplification switch, the progress row, the error message, four action
   buttons, and the engine/CPU/GPU readout;
5. the centre canvas in three mutually exclusive layouts — source, vector,
   split — where the source and vector blocks are duplicated verbatim between
   the single and split views;
6. the drag overlay.

The duplication in (5) is the part most likely to drift: the `<PreviewCanvas>`
+ `<img>` block and the `<PreviewCanvas>` + SVG + `<NodeOverlay>` block each
appear twice, and a change to one is easy to forget in the other.

## Suggested shape

Extract each region into a sibling component in the same file, taking the props
it needs, rather than splitting into new files:

```tsx
function ConvertToolbar({ … }) { … }
function ConvertControls({ … }) { … }
function SourcePreview({ src, alt, zoom, state }) { … }   // kills the duplication
function VectorPreview({ result, zoom, state, nodeViz }) { … }
function ConvertCanvas({ previewMode, … }) { … }
```

The stores stay where they are — the extracted components read them through
props, so nothing about the data flow changes. This is the same treatment that
worked on the Unchained Business site's own large demo components, and it is
mechanical enough to do in one reviewed pass.

`ConvertPanel` is much smaller; its complexity is the chain of conditional
metadata rows, and pulling each row into a small `PanelRow` helper covers it.

## Status in the demo

Not applied there. The vendored tree is a verbatim copy so that a re-copy from
this repository is an overwrite rather than a merge; restructuring the file in
the demo would make every future sync a manual reconciliation. The benefit is
permanent only if it happens here. Recorded in `docs/upstream-findings.md` §17.
