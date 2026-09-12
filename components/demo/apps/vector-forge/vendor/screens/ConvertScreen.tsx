import { useRef, useCallback, useState, useEffect } from 'react';
import {
  FolderOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
  GitBranch,
  RotateCcw,
  Play,
  X,
  Download,
} from 'lucide-react';
import { useT } from '../hooks/useT';
import { useProjectStore } from '../stores/projectStore';
import { useAssetStore } from '../stores/assetStore';
import { useConvertStore } from '../stores/convertStore';
import { useEnhanceStore } from '../stores/enhanceStore';
import { useSystemStore } from '../stores/systemStore';
import { DropZone } from '../composites/DropZone';
import { AssetBrowser } from '../composites/AssetBrowser';
import { PreviewCanvas } from '../composites/PreviewCanvas';
import { ModeCard } from '../composites/ModeCard';
import { SliderRow } from '../composites/SliderRow';
import { NodeOverlay } from '../composites/NodeOverlay';
import { Segmented } from '../primitives/Segmented';
import { Button } from '../primitives/Button';
import { Switch } from '../primitives/Switch';
import { ProgressBar } from '../primitives/ProgressBar';
import { Resizer } from '../primitives/Resizer';
import { useResizableWidth } from '../hooks/useResizableWidth';
import { openImportDialog, validateRef, assetSrc } from '../services/fs';
import { useToastStore } from '../stores/toastStore';
import { tauriExportSvgFile } from '../services/tauri';
import type { ImageRef, ZoomLevel, ConvertMode, PreviewMode } from '../types';
import styles from './ConvertScreen.module.css';

const STAGE_LABELS: Record<string, string> = {
  loading:     'Loading image…',
  resizing:    'Resizing…',
  configuring: 'Configuring…',
  tracing:     'Tracing paths…',
  finalizing:  'Finalizing…',
};
function formatStage(stage: string): string {
  return STAGE_LABELS[stage] ?? `${stage}…`;
}

const ZOOM_OPTIONS = [
  { value: '25', label: '25%' },
  { value: '50', label: '50%' },
  { value: '100', label: '100%' },
  { value: '200', label: '200%' },
  { value: '400', label: '400%' },
];

const ZOOM_VALUES: ZoomLevel[] = [25, 50, 100, 200, 400];

const PREVIEW_OPTIONS = [
  { value: 'source', label: 'Source' },
  { value: 'split', label: 'Split' },
  { value: 'vector', label: 'Vector' },
];

const MODE_META: Record<
  ConvertMode,
  { icon: React.ReactNode; label: string; desc: string }
> = {
  logo: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12 L8 4 L14 12" /><path d="M5 9 L11 9" />
      </svg>
    ),
    label: 'Logo',
    desc: 'Clean edges for brand marks',
  },
  icon: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="3" />
      </svg>
    ),
    label: 'Icon',
    desc: 'Compact pixel-level accuracy',
  },
  illustration: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 14 C4 6 8 2 14 2" /><path d="M2 14 C6 10 12 8 14 2" />
      </svg>
    ),
    label: 'Illustration',
    desc: 'Rich detail and color depth',
  },
  precision: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="8" r="5" /><line x1="8" y1="1" x2="8" y2="4" /><line x1="8" y1="12" x2="8" y2="15" /><line x1="1" y1="8" x2="4" y2="8" /><line x1="12" y1="8" x2="15" y2="8" />
      </svg>
    ),
    label: 'Precision',
    desc: 'Maximum fidelity tracing',
  },
};

export function ConvertScreen() {
  const t = useT();
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [leftWidth, setLeftWidth] = useState(240);
  const { onPointerDown: onLeftResizePointerDown, onKeyDown: onLeftResizeKeyDown } = useResizableWidth({
    value: leftWidth,
    onChange: setLeftWidth,
    min: 220,
    max: 420,
  });

  const current = useProjectStore((s) => s.current);
  const showToast = useToastStore((s) => s.show);

  const {
    convertMode,
    nodeViz,
    zoom,
    detail,
    colors,
    smoothing,
    simplify,
    result,
    previewMode,
    isVectorizing,
    vectorizeProgress,
    vectorizeStage,
    vectorizeError,
    set: setConvert,
    setActiveAsset: setConvertActiveAsset,
    startVectorization,
    cancelVectorization,
    clearResult,
    setPreviewMode,
    toggleNodeOverlay,
    reset: resetConvert,
  } = useConvertStore();

  const cpuPct = useSystemStore((s) => s.cpuPct);
  const gpuPct = useSystemStore((s) => s.gpuPct);

  const assets = useAssetStore((s) => s.assets);
  const activeAssetId = useAssetStore((s) => s.activeAssetId);
  const addRefs = useAssetStore((s) => s.addRefs);
  const removeRef = useAssetStore((s) => s.removeRef);
  const setActiveAsset = useAssetStore((s) => s.setActiveAsset);

  const activeAsset = assets.find((a) => a.id === activeAssetId) ?? null;
  const enhancedByAssetId = useEnhanceStore((s) => s.enhancedByAssetId);

  // Sync active file into convertStore when asset changes — Enhanced ↓ Original priority (M11A)
  useEffect(() => {
    const file = activeAsset?.file ?? null;
    if (file) {
      const enhanced = enhancedByAssetId[file.id];
      if (enhanced) {
        setConvertActiveAsset({
          ...file,
          path: enhanced.path,
          width: enhanced.width || file.width,
          height: enhanced.height || file.height,
        });
        return;
      }
    }
    setConvertActiveAsset(file);
  }, [activeAsset?.file, enhancedByAssetId, setConvertActiveAsset]);

  // DEMO DIVERGENCE — the product reopens the SVG a previous session wrote
  // into the project directory here. Nothing is written and nothing survives
  // a reload in this demo, so the effect and the store method it called were
  // removed together. See vendor/stores/convertStore.ts.

  const handleFiles = useCallback(
    (refs: ImageRef[]) => {
      if (!current) {
        showToast('danger', 'Create or open a project before importing assets');
        return;
      }
      addRefs(refs, current.dir ?? '');
    },
    [current, addRefs, showToast]
  );

  const handleImportDialog = useCallback(async () => {
    if (!current) {
      showToast('danger', 'Create or open a project before importing assets');
      return;
    }
    // DEMO DIVERGENCE — the product's dialog is an OS file picker. This one
    // offers the rest of the sample project, so it needs to know what is
    // already imported. See vendor/services/fs.ts.
    const refs = await openImportDialog(assets.map((a) => a.id));
    const valid: ImageRef[] = [];
    for (const ref of refs) {
      const err = validateRef(ref);
      if (err) showToast('danger', err);
      else valid.push(ref);
    }
    if (valid.length > 0) addRefs(valid, current.dir ?? '');
  }, [current, assets, addRefs, showToast]);

  const handleOpen = useCallback((id: string) => setActiveAsset(id), [setActiveAsset]);
  const handleRemove = useCallback((id: string) => removeRef(id), [removeRef]);

  const zoomIn = () => {
    const idx = ZOOM_VALUES.indexOf(zoom);
    if (idx < ZOOM_VALUES.length - 1) setConvert('zoom', ZOOM_VALUES[idx + 1]);
  };
  const zoomOut = () => {
    const idx = ZOOM_VALUES.indexOf(zoom);
    if (idx > 0) setConvert('zoom', ZOOM_VALUES[idx - 1]);
  };
  const zoomFit = () => {
    const el = previewAreaRef.current;
    const file = activeAsset?.file;
    if (!el || !file || !file.width || !file.height) {
      setConvert('zoom', 100);
      return;
    }
    const fitRatio = Math.min(el.clientWidth / file.width, el.clientHeight / file.height);
    const snapped = (ZOOM_VALUES.filter((z) => z <= fitRatio * 100).pop() ?? ZOOM_VALUES[0]) as ZoomLevel;
    setConvert('zoom', snapped);
  };

  const handleStartVectorization = useCallback(() => {
    if (!current) return;
    void startVectorization(current.dir ?? '');
  }, [current, startVectorization]);

  const handleReset = useCallback(() => {
    clearResult();
    resetConvert();
  }, [clearResult, resetConvert]);

  const handleExportSvg = useCallback(async () => {
    if (!result) return;
    const baseName = (activeAsset?.ref.name ?? 'output').replace(/\.[^/.]+$/, '');
    try {
      const savedPath = await tauriExportSvgFile(`${baseName}.svg`, result.svg);
      if (savedPath) showToast('success', `SVG exported to ${savedPath}`);
    } catch (err) {
      showToast('danger', err instanceof Error ? err.message : 'Export failed');
    }
  }, [result, activeAsset, showToast]);

  // DEMO DIVERGENCE — the product also listens for Tauri's OS-level drag-drop,
  // the only event that carries a dropped file's real path. A browser tab has
  // no equivalent and this demo reads no local files, so the listener is gone.
  // The drag overlay below stays: it is what tells a visitor the canvas would
  // accept a drop in the real application.

  const hasAssets = assets.length > 0;
  const sourceSrc = activeAsset?.file ? assetSrc(activeAsset.file.path) : null;

  const sourceState =
    !hasAssets
      ? 'empty'
      : activeAsset?.status === 'pending' || activeAsset?.status === 'probing'
      ? 'loading'
      : activeAsset?.status === 'error'
      ? 'error'
      : sourceSrc
      ? 'loaded'
      : 'empty';

  const vectorState: 'empty' | 'loading' | 'loaded' | 'error' = isVectorizing
    ? 'loading'
    : vectorizeError
    ? 'error'
    : result
    ? 'loaded'
    : 'empty';

  const canVectorize =
    !!current &&
    !!activeAsset?.file &&
    !isVectorizing &&
    activeAsset.status === 'ready';

  const nodeOverlayPoints = result?.points ?? [];

  return (
    <div
      className={styles.screen}
      data-screen-label="Convert"
      onDragEnter={(e) => {
        if (current && hasAssets && e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
    >
      <h1 ref={h1Ref} tabIndex={-1} className={styles.srOnly}>
        {t('convert.title') ?? 'Convert'}
      </h1>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar} role="toolbar" aria-label="Convert toolbar">
        <span className={styles.filename}>
          {activeAsset?.ref.name ?? current?.name ?? 'No file'}
        </span>

        {result && (
          <span className={styles.badge} aria-label={`Output: ${convertMode.toUpperCase()}`}>
            OUTPUT · {convertMode.toUpperCase()} · {result.pathCount}P
          </span>
        )}

        <span className={styles.spacer} aria-hidden="true" />

        <Button
          variant="ghost"
          size="sm"
          label="Import"
          icon={<FolderOpen size={14} strokeWidth={1.5} />}
          disabled={!current}
          onClick={handleImportDialog}
        />

        {hasAssets && (
          <div className={styles.previewToggle} role="group" aria-label="Preview mode">
            <Segmented
              options={PREVIEW_OPTIONS}
              value={previewMode}
              onChange={(v) => setPreviewMode(v as PreviewMode)}
              size="sm"
            />
          </div>
        )}

        <div className={styles.zoomControls} role="group" aria-label="Zoom controls">
          <Segmented
            options={ZOOM_OPTIONS}
            value={String(zoom)}
            onChange={(v) => setConvert('zoom', Number(v) as ZoomLevel)}
            size="sm"
          />
          <button className={styles.zoomBtn} title="Zoom out" onClick={zoomOut} aria-label="Zoom out" type="button">
            <ZoomOut size={14} strokeWidth={1.5} />
          </button>
          <button className={styles.zoomBtn} title="Zoom in" onClick={zoomIn} aria-label="Zoom in" type="button">
            <ZoomIn size={14} strokeWidth={1.5} />
          </button>
          <button className={styles.zoomBtn} title="Fit" onClick={zoomFit} aria-label="Fit to view" type="button">
            <Maximize2 size={14} strokeWidth={1.5} />
          </button>
          <button className={styles.zoomBtn} title="100%" onClick={() => setConvert('zoom', 100)} aria-label="100% zoom" type="button">
            <Square size={14} strokeWidth={1.5} />
          </button>
          <button
            className={`${styles.zoomBtn} ${nodeViz ? styles.zoomBtnActive : ''}`}
            title="Toggle node overlay"
            onClick={toggleNodeOverlay}
            aria-label="Toggle node overlay"
            aria-pressed={nodeViz}
            type="button"
          >
            <GitBranch size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* No project */}
        {!current && (
          <div className={styles.onboarding}>
            <p className={styles.onboardingText}>
              Create or open a project to start importing assets.
            </p>
          </div>
        )}

        {/* Project, no assets: full drop zone */}
        {current && !hasAssets && (
          <div className={styles.dropArea}>
            <DropZone
              onFiles={handleFiles}
              dragOver={false}
              title={t('drop.title') ?? 'Drop images here'}
              hint={t('drop.hint') ?? 'PNG, JPG, WebP, BMP, TIFF up to 100 MB'}
            />
          </div>
        )}

        {/* Project with assets: 3-column layout */}
        {current && hasAssets && (
          <div className={styles.workspace} style={{ '--convert-left-w': `${leftWidth}px` } as React.CSSProperties}>
            {/* ── Left: asset browser + controls ── */}
            <aside className={styles.leftPanel} aria-label="Conversion controls">
              {/* Asset browser */}
              <div className={styles.assetSection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.eyebrow}>Assets ({assets.length})</span>
                  <button
                    className={styles.addBtn}
                    title="Import more"
                    aria-label="Import more files"
                    type="button"
                    onClick={handleImportDialog}
                  >
                    +
                  </button>
                </div>
                <AssetBrowser
                  assets={assets}
                  activeId={activeAssetId}
                  onSelect={setActiveAsset}
                  onOpen={handleOpen}
                  onRemove={handleRemove}
                />
              </div>

              {/* Vectorization controls */}
              <div className={styles.controlsSection}>
                <span className={styles.eyebrow}>Mode</span>
                <div className={styles.modeGrid}>
                  {(Object.entries(MODE_META) as [ConvertMode, typeof MODE_META[ConvertMode]][]).map(
                    ([mode, meta]) => (
                      <ModeCard
                        key={mode}
                        icon={meta.icon}
                        label={meta.label}
                        desc={meta.desc}
                        active={convertMode === mode}
                        onClick={() => setConvert('convertMode', mode)}
                      />
                    )
                  )}
                </div>

                <div className={styles.sliders}>
                  <SliderRow
                    label="Detail"
                    value={detail}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => setConvert('detail', v)}
                    disabled={isVectorizing}
                  />
                  <SliderRow
                    label="Colors"
                    value={colors}
                    min={2}
                    max={32}
                    step={1}
                    onChange={(v) => setConvert('colors', v)}
                    disabled={isVectorizing}
                  />
                  <SliderRow
                    label="Smoothing"
                    value={smoothing}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => setConvert('smoothing', v)}
                    disabled={isVectorizing}
                  />
                </div>

                <div className={styles.switchRow}>
                  <Switch
                    label="Node simplification"
                    checked={simplify}
                    onChange={(v) => setConvert('simplify', v)}
                    disabled={isVectorizing}
                  />
                </div>

                {isVectorizing && (
                  <div aria-live="polite">
                    <div className={styles.progressRow}>
                      <ProgressBar pct={vectorizeProgress} variant="accent" />
                      <span className={styles.progressLabel}>{vectorizeProgress}%</span>
                    </div>
                    {vectorizeStage && (
                      <span className={styles.stageLabel}>{formatStage(vectorizeStage)}</span>
                    )}
                  </div>
                )}

                {vectorizeError && (
                  <p className={styles.errorMsg} role="alert">
                    {vectorizeError}
                  </p>
                )}

                <div className={styles.actions}>
                  {isVectorizing ? (
                    <Button
                      variant="danger"
                      size="sm"
                      label="Cancel"
                      icon={<X size={14} strokeWidth={1.5} />}
                      onClick={cancelVectorization}
                      fullWidth
                    />
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      label="Start Conversion"
                      icon={<Play size={14} strokeWidth={1.5} />}
                      disabled={!canVectorize}
                      onClick={handleStartVectorization}
                      fullWidth
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    label="Export SVG"
                    icon={<Download size={14} strokeWidth={1.5} />}
                    disabled={!result || isVectorizing}
                    onClick={handleExportSvg}
                    fullWidth
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    label="Reset"
                    icon={<RotateCcw size={14} strokeWidth={1.5} />}
                    disabled={isVectorizing}
                    onClick={handleReset}
                    fullWidth
                  />
                </div>

                <div className={styles.engineStatus}>
                  <div className={styles.engineStatusRow}>
                    <span
                      className={`${styles.engineDot} ${isVectorizing ? styles.engineDotActive : ''}`}
                      aria-hidden="true"
                    />
                    <span className={styles.engineLabel}>
                      {isVectorizing ? 'Processing…' : result ? 'Ready' : 'Idle'}
                    </span>
                  </div>
                  <div className={styles.usageBars}>
                    <div className={styles.usageRow}>
                      <span className={styles.usageLabel}>CPU</span>
                      <div className={styles.usageBar} role="progressbar" aria-valuenow={Math.round(cpuPct)} aria-valuemin={0} aria-valuemax={100}>
                        <div className={styles.usageFill} style={{ width: `${Math.min(cpuPct, 100)}%` }} />
                      </div>
                      <span className={styles.usagePct}>{Math.round(cpuPct)}%</span>
                    </div>
                    {gpuPct > 0 && (
                      <div className={styles.usageRow}>
                        <span className={styles.usageLabel}>GPU</span>
                        <div className={styles.usageBar} role="progressbar" aria-valuenow={Math.round(gpuPct)} aria-valuemin={0} aria-valuemax={100}>
                          <div className={styles.usageFill} style={{ width: `${Math.min(gpuPct, 100)}%` }} />
                        </div>
                        <span className={styles.usagePct}>{Math.round(gpuPct)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <Resizer
              ariaLabel="Resize conversion controls panel"
              onPointerDown={onLeftResizePointerDown}
              onKeyDown={onLeftResizeKeyDown}
            />

            {/* ── Center: preview workspace ── */}
            <main ref={previewAreaRef} className={styles.centerPanel} aria-label="Preview workspace">
              {previewMode === 'source' && (
                <PreviewCanvas kind="source" zoom={zoom} state={sourceState} label="SOURCE · RASTER">
                  {sourceSrc && sourceState === 'loaded' && (
                    <img
                      src={sourceSrc}
                      alt={activeAsset?.ref.name ?? 'Source'}
                      className={styles.previewImg}
                      draggable={false}
                    />
                  )}
                </PreviewCanvas>
              )}

              {previewMode === 'vector' && (
                <div className={styles.vectorCanvas} aria-label="Vector output">
                  <PreviewCanvas kind="vector" zoom={zoom} state={vectorState} label="OUTPUT · VECTOR">
                    {result && vectorState === 'loaded' && (
                      <div className={styles.svgContainer}>
                        <div
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{ __html: result.svg }}
                          className={styles.svgOutput}
                          aria-label="SVG preview"
                        />
                        <NodeOverlay visible={nodeViz} points={nodeOverlayPoints} />
                      </div>
                    )}
                  </PreviewCanvas>
                </div>
              )}

              {previewMode === 'split' && (
                <div className={styles.splitView}>
                  <div className={styles.splitPane}>
                    <PreviewCanvas kind="source" zoom={zoom} state={sourceState} label="SOURCE · RASTER">
                      {sourceSrc && sourceState === 'loaded' && (
                        <img
                          src={sourceSrc}
                          alt={activeAsset?.ref.name ?? 'Source'}
                          className={styles.previewImg}
                          draggable={false}
                        />
                      )}
                    </PreviewCanvas>
                  </div>
                  <div className={styles.splitDivider} aria-hidden="true" />
                  <div className={styles.splitPane}>
                    <PreviewCanvas kind="vector" zoom={zoom} state={vectorState} label="OUTPUT · VECTOR">
                      {result && vectorState === 'loaded' && (
                        <div className={styles.svgContainer}>
                          <div
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: result.svg }}
                            className={styles.svgOutput}
                            aria-label="SVG preview"
                          />
                          <NodeOverlay visible={nodeViz} points={nodeOverlayPoints} />
                        </div>
                      )}
                    </PreviewCanvas>
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* ── Drop overlay ── */}
      {current && hasAssets && (
        <div
          className={styles.dropOverlay}
          data-drag-active={isDragOver ? 'true' : undefined}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
          }}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
