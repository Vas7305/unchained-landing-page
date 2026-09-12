/**
 * Putting the workstation back the way it was found.
 *
 * ─── Why this file has to exist ───────────────────────────────────────────
 * Every other demo in this repository resets by remounting: the shell changes
 * the React `key` and the whole tree is rebuilt from its initial state. That
 * works because those demos hold their state in a `useReducer` inside the tree
 * being rebuilt.
 *
 * VectorForge does not. It is a Zustand application, and a Zustand store is a
 * module-level singleton — it is created once when the chunk is evaluated and
 * it survives unmounting, remounting and every key change the shell can think
 * of. Pressing Reset would rebuild the components around state that never
 * moved: the same assets still imported, the same trace still on the canvas.
 *
 * So the remount calls this, synchronously, before the first render of the new
 * tree. Each store contributes its own reset next to its own definition, which
 * is the only place that knows what "initial" means for it; this module is the
 * list, and the list is short enough to read.
 *
 * It also runs on first mount, which is not redundant: the chunk is evaluated
 * once per page load but the demo can be opened, left and reopened within that
 * page, and the second visit must look like the first.
 */

import { resetAssetStore } from './stores/assetStore';
import { resetConvertStore } from './stores/convertStore';
import { resetProjectStore } from './stores/projectStore';
import { useHistoryStore } from './stores/historyStore';
import { useSystemStore } from './stores/systemStore';
import { useToastStore } from './stores/toastStore';
import { useUiStore } from './stores/uiStore';

/**
 * The engine readout in the Convert screen's left rail.
 *
 * In the product these come from a Tauri event the Rust core emits while it
 * works. There is no core here and nothing to measure, so the demo seeds a
 * fixed, plausible idle load rather than animating a number that would be
 * pure invention. `engineActive` stays false for the same reason.
 */
const IDLE_ENGINE = {
  vramUsedGb: 0,
  vramTotalGb: 0,
  cudaCores: 0,
  engineActive: false,
  cpuPct: 6,
  gpuPct: 0,
} as const;

export function resetDemoStores(): void {
  resetConvertStore();
  resetAssetStore();
  resetProjectStore();

  useUiStore.setState({ screen: 'convert', panelWidths: { sidebar: 280, right: 340 } });
  useHistoryStore.getState().clear();
  useToastStore.setState({ toasts: [] });
  useSystemStore.setState(IDLE_ENGINE);
}
