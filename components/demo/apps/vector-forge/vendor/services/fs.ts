/**
 * The filesystem service, adapted for the demo.
 *
 * ─── Why this file is not the product's ───────────────────────────────────
 * VectorForge is a Tauri desktop application. Its `services/fs.ts` opens an
 * OS file dialog, copies files into the project directory and turns absolute
 * disk paths into webview URLs through `convertFileSrc`. None of that exists
 * in a browser tab, and none of it may exist in a demo.
 *
 * So the module keeps its exported surface exactly — every function below has
 * the product's name, signature and return type, and the pure ones
 * (`getExtension`, `isSupportedFormat`, `validateRef`, `filesToRefs`,
 * `pathsToRefs`, `MAX_FILE_SIZE`, `SUPPORTED_EXTENSIONS`) are the product's
 * code, copied unchanged. Only the three that reach the operating system are
 * reimplemented against the fixtures, which is the whole of the isolation
 * boundary for this part of the app.
 *
 * `assetSrc` is the one worth reading twice: in the product it hands a disk
 * path to the webview, here the "path" already *is* a public URL under
 * `/demo/vector-forge/`, so it returns it untouched.
 */

import { demoSources } from '@/lib/demo/apps/vector-forge/data';
import { DEMO_LATENCY, ok, simulate } from '@/lib/demo/service';

import type { ImageRef } from '../types';

export const SUPPORTED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'bmp',
  'tiff',
  'tif',
  'svg',
] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

// 100 MB per blueprint §10
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function isSupportedFormat(name: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(getExtension(name));
}

export function validateRef(ref: ImageRef): string | null {
  if (!isSupportedFormat(ref.name)) {
    return `Unsupported format: .${getExtension(ref.name)}`;
  }
  if (ref.sizeBytes > MAX_FILE_SIZE) {
    return `File too large (max 100 MB): ${ref.name}`;
  }
  return null;
}

export function filesToRefs(files: FileList | File[]): ImageRef[] {
  return Array.from(files).map((f) => ({
    id: crypto.randomUUID(),
    name: f.name,
    path: (f as File & { path?: string }).path ?? f.name,
    sizeBytes: f.size,
  }));
}

export function pathsToRefs(paths: string[]): ImageRef[] {
  return paths.map((p) => {
    const name = p.replace(/\\/g, '/').split('/').pop() ?? p;
    return { id: crypto.randomUUID(), name, path: p, sizeBytes: 0 };
  });
}

/**
 * What the visitor is offered when they press Import.
 *
 * The product opens an OS picker. A picker here would either reach the
 * visitor's disk — which this demo does not do — or hand back a file the
 * tracer has no vector for, and a trace that returns someone else's artwork
 * would be worse than no trace at all. So the "dialog" offers the rest of the
 * sample project: the sources that are not on the canvas yet.
 *
 * `already` is not in the product's signature. It is the demo's, and it is
 * why the dialog can be pressed repeatedly without stacking duplicates.
 */
export async function openImportDialog(already: readonly string[] = []): Promise<ImageRef[]> {
  const imported = new Set(already);
  const remaining = demoSources.filter((source) => !imported.has(source.id));

  // The pause is the picker the visitor would have been looking at.
  await simulate(() => ok(null), DEMO_LATENCY.normal);

  return remaining.map((source) => ({
    id: source.id,
    name: source.name,
    path: source.path,
    sizeBytes: source.bytes,
  }));
}

/** No project directory exists to copy into, so the reference stands as it is. */
export async function copyAssetToProject(ref: ImageRef, _projectDir: string): Promise<string> {
  void _projectDir;
  return ref.path;
}

export async function getFileInfo(
  path: string,
): Promise<{ sizeBytes: number; createdAt: number; modifiedAt: number }> {
  const source = demoSources.find((candidate) => candidate.path === path);
  return {
    sizeBytes: source?.bytes ?? 0,
    // Fixed, so two runs of the demo report the same file dates.
    createdAt: Date.UTC(2026, 0, 19, 9, 30),
    modifiedAt: Date.UTC(2026, 1, 3, 16, 12),
  };
}

export function assetSrc(path: string): string {
  return path;
}
