import { ImageOff, Trash2, FolderOpen } from 'lucide-react';
import type { AssetItem } from '../types';
import { getThumbnailSrc } from '../services/thumbnails';
import { assetSrc } from '../services/fs';
import { formatBytes } from '../services/format';
import { IconButton } from '../primitives/IconButton';
import { Skeleton } from '../primitives/Skeleton';
import styles from './AssetBrowser.module.css';

interface AssetBrowserProps {
  assets: AssetItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

function AssetThumb({ asset }: { asset: AssetItem }) {
  if (asset.status === 'pending' || asset.status === 'probing') {
    return <Skeleton width="100%" height="100%" radius={6} />;
  }
  if (asset.status === 'error') {
    return (
      <div className={styles.thumbError} aria-label="Import failed">
        <ImageOff size={20} strokeWidth={1.5} />
      </div>
    );
  }

  const src = asset.thumbnail
    ? getThumbnailSrc(asset.thumbnail.thumbPath)
    : asset.file
    ? assetSrc(asset.file.path)
    : '';

  return src ? (
    <img
      src={src}
      alt={asset.ref.name}
      className={styles.thumbImg}
      draggable={false}
      loading="lazy"
    />
  ) : (
    <div className={styles.thumbError} aria-label="No preview">
      <ImageOff size={20} strokeWidth={1.5} />
    </div>
  );
}

export function AssetBrowser({ assets, activeId, onSelect, onOpen, onRemove }: AssetBrowserProps) {
  if (assets.length === 0) return null;

  return (
    <div className={styles.browser} role="list" aria-label="Imported assets">
      {assets.map((asset) => {
        const isActive = asset.id === activeId;
        const dimLabel = asset.file
          ? `${asset.file.width}×${asset.file.height}`
          : null;
        const sizeLabel = asset.metadata
          ? formatBytes(asset.metadata.sizeBytes)
          : asset.ref.sizeBytes
          ? formatBytes(asset.ref.sizeBytes)
          : null;
        const fmt = asset.file?.format?.toUpperCase() ?? null;

        return (
          <div
            key={asset.id}
            role="listitem"
            className={`${styles.item} ${isActive ? styles.active : ''}`}
            tabIndex={0}
            aria-label={`${asset.ref.name}${isActive ? ', selected' : ''}`}
            // DEMO DIVERGENCE — the product marks the open asset with
            // `aria-selected`, which `role="listitem"` does not support, so a
            // screen reader announces the rows without ever saying which one is
            // open. `aria-current` carries the same meaning and is valid on any
            // element, so this fixes the announcement without touching the
            // widget's role or its keyboard contract. The thorough fix is
            // listbox/option; that is a product decision and is filed upstream.
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(asset.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(asset.id);
              }
            }}
          >
            <div className={styles.thumb}>
              <AssetThumb asset={asset} />
            </div>

            <div className={styles.info}>
              <span className={styles.name} title={asset.ref.name}>
                {asset.ref.name}
              </span>
              <div className={styles.meta}>
                {fmt && <span className={styles.metaTag}>{fmt}</span>}
                {dimLabel && <span className={styles.metaDim}>{dimLabel}</span>}
                {sizeLabel && <span className={styles.metaSize}>{sizeLabel}</span>}
              </div>
            </div>

            <div
              className={styles.actions}
              onClick={(e) => e.stopPropagation()}
            >
              <IconButton
                icon={<FolderOpen size={14} strokeWidth={1.5} />}
                title="Open asset"
                onClick={() => onOpen(asset.id)}
              />
              <IconButton
                icon={<Trash2 size={14} strokeWidth={1.5} />}
                title="Remove asset"
                onClick={() => onRemove(asset.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
