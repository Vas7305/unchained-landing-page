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
    <ul className={styles.browser} aria-label="Imported assets">
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
          <li key={asset.id} className={`${styles.item} ${isActive ? styles.active : ''}`}>
            {/* Selecting the asset is a button, not a row with a tabIndex and a
                hand-written Enter/Space handler. It cannot wrap the whole row,
                because the row's own actions are buttons and nesting them would
                be invalid — so it wraps the part that selects, and the actions
                sit beside it. `aria-current` rather than `aria-selected`:
                `aria-selected` belongs to option/tab/row/gridcell, and a screen
                reader ignored it here, so the open asset was never announced. */}
            <button
              type="button"
              className={styles.select}
              aria-label={`${asset.ref.name}${isActive ? ', selected' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(asset.id)}
            >
              <span className={styles.thumb}>
                <AssetThumb asset={asset} />
              </span>

              <span className={styles.info}>
                <span className={styles.name} title={asset.ref.name}>
                  {asset.ref.name}
                </span>
                <span className={styles.meta}>
                  {fmt && <span className={styles.metaTag}>{fmt}</span>}
                  {dimLabel && <span className={styles.metaDim}>{dimLabel}</span>}
                  {sizeLabel && <span className={styles.metaSize}>{sizeLabel}</span>}
                </span>
              </span>
            </button>

            {/* No stopPropagation any more: these are siblings of the select
                button rather than children of a clickable row, so activating
                one cannot also select the asset. */}
            <div className={styles.actions}>
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
          </li>
        );
      })}
    </ul>
  );
}
