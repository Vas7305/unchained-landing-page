/**
 * The image prober, adapted for the demo.
 *
 * The product invokes a Rust command that opens the file and reads its header.
 * The demo already knows every source it will ever be handed, so the answer is
 * a lookup — but it is still a *slow* lookup, because the product's import
 * flow shows a probing state and hiding it would flatten a real part of the
 * interface into nothing.
 */

import { DEMO_LATENCY, ok, simulate } from '@/lib/demo/service';
import { demoSources } from '@/lib/demo/apps/vector-forge/data';

import type { AssetMetadata, ImageFile, ImageRef } from '../types';

import { getExtension, getFileInfo } from './fs';

export async function probeAsset(
  ref: ImageRef,
): Promise<{ file: ImageFile; metadata: AssetMetadata }> {
  const source = demoSources.find((candidate) => candidate.path === ref.path);

  // The product's probe throws when the file cannot be read, and the asset
  // store turns that into the row's error state. Keeping the throw keeps that
  // path reachable rather than decorative.
  if (!source) {
    throw new Error(`Unreadable image: ${ref.name}`);
  }

  await simulate(() => ok(null), DEMO_LATENCY.quick);

  const fileInfo = await getFileInfo(ref.path);
  const format = getExtension(ref.name) as ImageFile['format'];

  const file: ImageFile = {
    ...ref,
    format,
    width: source.width,
    height: source.height,
  };

  const metadata: AssetMetadata = {
    width: source.width,
    height: source.height,
    format,
    sizeBytes: ref.sizeBytes > 0 ? ref.sizeBytes : fileInfo.sizeBytes,
    createdAt: fileInfo.createdAt,
    modifiedAt: fileInfo.modifiedAt,
    // Fixed rather than `Date.now()`: the metadata panel prints it, and a demo
    // whose numbers move between two screenshots is a demo nobody trusts.
    importedAt: Date.UTC(2026, 1, 3, 16, 12),
  };

  return { file, metadata };
}
