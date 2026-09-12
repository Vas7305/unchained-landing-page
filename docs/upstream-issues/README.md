# Issue drafts for the product repositories

Static analysis over this repository also analyses the **vendored product
frontends** under `components/demo/apps/<slug>/vendor/`, because that code is
the products' code. Findings that belong to a product rather than to this site
are analysed in [../upstream-findings.md](../upstream-findings.md); the ones
that are confirmed and were deliberately **not** patched here are written out
below as issue bodies, ready to file.

They are files rather than filed issues because the GitHub CLI is not installed
on this machine (`gh: command not found`). To file them:

```bash
gh issue create --repo Vas7305/VectorForge-V-1.0 \
  --title "$(head -1 vectorforge-prefer-tag-over-role.md | sed 's/^# //')" \
  --body-file vectorforge-prefer-tag-over-role.md
```

| draft | rule | confidence | why it was not fixed here |
|---|---|---|---|
| [prefer-tag-over-role](./vectorforge-prefer-tag-over-role.md) | `react-doctor/prefer-tag-over-role` ×5 | high | The computed accessibility tree is already correct — this is a maintainability improvement, and patching it would mean editing the product's markup and CSS modules. |
| [convert-screen-size](./vectorforge-convert-screen-size.md) | `no-giant-component`, `no-high-complexity-react-function` | high | Restructuring the file would turn every future re-copy from VectorForge into a manual merge. |

## Assessed and rejected, so not filed

- **`nextjs-no-img-element` ×3** (`AssetBrowser.tsx:37`,
  `ConvertScreen.tsx:582,615`). Not applicable. VectorForge is a Tauri/Vite
  application where `<img>` is the correct element; in *this* repository
  `next.config.ts` sets `images: { unoptimized: true }`, so `next/image` would
  add a wrapper and optimise nothing. The two in `ConvertScreen` sit inside a
  `zoom`-scaled preview canvas, where that wrapper would actively break the
  zoom control.
- **`no-noninteractive-element-interactions`** (`Modal.tsx:45`). Not a defect.
  The element is a native `<dialog>`, which *is* interactive; the handler
  implements click-outside-to-close by comparing `event.target` against the
  dialog itself — the backdrop. The rule targets `<div onClick>`. The same
  pattern in Lazara Sersa's `InquiryModal` was assessed the same way.
