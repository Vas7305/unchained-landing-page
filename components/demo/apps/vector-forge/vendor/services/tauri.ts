/**
 * The Tauri IPC bridge, adapted for the demo.
 *
 * ─── What this replaces ───────────────────────────────────────────────────
 * The product's `services/tauri.ts` is 292 lines of `invoke(...)` calls into
 * its Rust core — the tracer, the optimiser, the exporter, the file dialogs.
 * There is no Rust core in a browser tab, so the only honest translation of
 * that module is: reproduce the one command this screen actually calls, and
 * let the absence of the rest be enforced by the fact that nothing imports it.
 *
 * `export_svg_file` opens a save dialog and writes the file. The browser has
 * an equivalent that needs no backend at all — a Blob and an anchor — so the
 * export here is real: the visitor gets the actual SVG the tracer produced,
 * byte for byte, and nothing leaves the machine to make that happen.
 */

export async function tauriExportSvgFile(
  defaultName: string,
  contents: string,
): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const blob = new Blob([contents], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = defaultName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Freed on the next turn: revoking synchronously can beat the navigation
  // the click started, and the download then arrives empty.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return defaultName;
}
