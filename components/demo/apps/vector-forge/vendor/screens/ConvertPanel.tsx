import { useAssetStore } from '../stores/assetStore';
import { useConvertStore } from '../stores/convertStore';
import { formatBytes } from '../services/format';
import { computeSvgComplexity } from '../services/vectorize';
import styles from './ConvertPanel.module.css';

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

export function ConvertPanel() {
  const assets = useAssetStore((s) => s.assets);
  const activeAssetId = useAssetStore((s) => s.activeAssetId);
  const result = useConvertStore((s) => s.result);
  const isVectorizing = useConvertStore((s) => s.isVectorizing);

  const asset = assets.find((a) => a.id === activeAssetId);

  if (!asset) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyText}>No asset selected</span>
      </div>
    );
  }

  const { file, metadata } = asset;

  const svgSizeBytes = result ? new Blob([result.svg]).size : 0;
  const complexity = result
    ? computeSvgComplexity(result.pathCount, result.nodeCount)
    : null;

  return (
    <div className={styles.panel}>
      {/* Source Metadata */}
      <section aria-label="Source metadata">
        <span className={styles.sectionLabel}>Source</span>
        <div className={styles.rows}>
          <Row label="Filename" value={asset.ref.name} />
          {file && (
            <>
              <Row label="Format" value={file.format.toUpperCase()} />
              <Row label="Dimensions" value={`${file.width} × ${file.height}`} />
            </>
          )}
          {metadata && (
            <Row label="Size" value={formatBytes(metadata.sizeBytes)} />
          )}
          {!file && (asset.status === 'pending' || asset.status === 'probing') && (
            <div className={styles.loading} aria-live="polite" aria-label="Loading asset">
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
            </div>
          )}
          {asset.status === 'error' && (
            <p className={styles.errorText} role="alert">
              {asset.error ?? 'Import failed'}
            </p>
          )}
        </div>
      </section>

      <div className={styles.divider} />

      {/* SVG Metadata */}
      <section aria-label="SVG output metadata">
        <span className={styles.sectionLabel}>SVG Output</span>
        <div className={styles.rows}>
          {isVectorizing && !result && (
            <div className={styles.loading} aria-live="polite" aria-label="Generating SVG">
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
            </div>
          )}
          {!result && !isVectorizing && (
            <p className={styles.placeholder}>Run conversion to see output metrics.</p>
          )}
          {result && (
            <>
              <Row label="Paths" value={String(result.pathCount)} />
              <Row label="Nodes" value={String(result.nodeCount)} />
              <Row
                label="Complexity"
                value={
                  complexity
                    ? complexity.charAt(0).toUpperCase() + complexity.slice(1)
                    : '—'
                }
              />
              <Row label="SVG Size" value={svgSizeBytes > 0 ? formatBytes(svgSizeBytes) : '—'} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
