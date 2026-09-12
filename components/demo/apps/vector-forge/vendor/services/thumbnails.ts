/**
 * The thumbnail service, adapted for the demo.
 *
 * The product asks Rust to write a 160px thumbnail into the project's cache
 * directory and hands back its path. There is no cache directory here, and the
 * sources are small enough that the browser scaling them in the asset browser
 * costs nothing — so the "thumbnail" is the source itself, which is exactly
 * the fallback the product already takes when the Rust side is unavailable.
 *
 * Everything else is the product's code: the same module-level cache, the same
 * `ThumbnailInfo` shape, the same invalidation functions.
 */

import type { ImageFile, ThumbnailInfo } from '../types';

import { assetSrc } from './fs';

const cache = new Map<string, ThumbnailInfo>();

export async function generateThumbnail(
  file: ImageFile,
  _projectDir: string,
): Promise<ThumbnailInfo> {
  void _projectDir;

  const cached = cache.get(file.id);
  if (cached) return cached;

  const info: ThumbnailInfo = {
    assetId: file.id,
    thumbPath: file.path,
    width: 160,
    height: 160,
  };
  cache.set(file.id, info);
  return info;
}

export function removeThumbnailCache(assetId: string): void {
  cache.delete(assetId);
}

export function clearThumbnailCache(): void {
  cache.clear();
}

export function getThumbnailSrc(thumbPath: string): string {
  return assetSrc(thumbPath);
}
