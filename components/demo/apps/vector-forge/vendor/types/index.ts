// §7 — Type Contracts (canonical, single definition)

export type Screen =
  | 'dashboard'
  | 'convert'
  | 'enhance'
  | 'optimize'
  | 'web'
  | 'batch'
  | 'export'
  | 'settings';

export type Theme = 'dark'; // v1.0 dark-only; 'light' reserved

export type PerfMode = 'cpu' | 'gpu';

export type ConvertMode = 'logo' | 'icon' | 'illustration' | 'precision';

export type Upscale = '2x' | '4x' | '8x';

export type OptFormat = 'png' | 'webp' | 'avif' | 'jpeg';

export type JobKind = 'detect' | 'vectorize' | 'enhance' | 'optimize' | 'webAssets' | 'export';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'paused' | 'cancelled';

// ─── Module 07 — SVG Optimization Engine Domain Models ────────────────────────

export type OptimizationProfile = 'safe' | 'balanced' | 'aggressive';

export interface OptimizationSettings {
  profile: OptimizationProfile;
  compression: number;          // 0–100 slider value
  removeMetadata: boolean;
  mergePaths: boolean;
  cleanupIds: boolean;
  removeHiddenElements: boolean;
  simplifyTransforms: boolean;
  multipass: boolean;
  precision: number;            // float digit count 0–8
}

export interface SvgStats {
  sizeBytes: number;
  nodeCount: number;
  pathCount: number;
}

export interface OptimizationMetrics {
  original: SvgStats;
  optimized: SvgStats;
  bytesSaved: number;
  sizePct: number;
  nodePct: number;
  grade: 'A' | 'B' | 'C' | 'D';
}

export interface OptimizationResult {
  svg: string;
  originalSvg: string;
  metrics: OptimizationMetrics;
  cachePath: string;
  optimizedAt: number;
}

export type OptimizeCompareMode = 'original' | 'optimized' | 'split' | 'side-by-side';

export type Lang = 'en' | 'es' | 'it';

export type ZoomLevel = 25 | 50 | 100 | 200 | 400;

export interface ImageRef {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
}

export interface ImageFile extends ImageRef {
  format: 'png' | 'jpg' | 'jpeg' | 'svg' | 'webp' | 'bmp' | 'tiff';
  width: number;
  height: number;
  buffer?: ArrayBuffer;
}

export type JobResult =
  | { kind: 'detect'; type: ConvertMode; confidence: number }
  | { kind: 'vectorize'; svg: string; nodeCount: number; pathCount: number; points: [number, number][] }
  | { kind: 'enhance'; previewPath: string; width: number; height: number }
  | { kind: 'optimize'; bytes: number; savingsPct: number }
  | { kind: 'webAssets'; pkg: AssetPackage };

// Enmienda A — pending/ready union for pre-probe items
export type JobPhase = 'pending' | 'ready';

export interface PendingJob {
  id: string;
  phase: 'pending';
  kind: JobKind;
  ref: ImageRef;
  status: 'queued';
  pct: 0;
}

export interface ReadyJob {
  id: string;
  phase: 'ready';
  kind: JobKind;
  file: ImageFile;
  status: JobStatus;
  pct: number;
  params: Record<string, number | string | boolean>;
  result?: JobResult;
  error?: string;
}

export type ProcessingJob = PendingJob | ReadyJob;

export interface QueueItem {
  id: string;
  name: string;
  size: string;
  status: JobStatus;
  pct: number;
}

export interface BatchJob {
  running: boolean;
  workers: number;
  items: ProcessingJob[];
  completed: number;
  failed: number;
  startedAt?: number;
  finishedAt?: number;
}

export type BatchState = BatchJob;

export interface ConvertState {
  convertMode: ConvertMode;
  nodeViz: boolean;
  zoom: ZoomLevel;
  dragOver: boolean;
  detail: number;
  colors: number;
  smoothing: number;
  simplify: boolean;
}

export type EnhanceCompareMode = 'slider' | 'sideBySide' | 'toggle';
export type EnhanceCompareSource = 'original' | 'previous';

export interface EnhanceState {
  upscale: Upscale;
  brightness: number;
  contrast: number;
  denoise: number;
  sharpen: number;
  saturation: number;
  colorTemp: number;
  bgRemove: boolean;
  split: number;
  // ─── Module 11B — Comparison modes (Phase 4) ──────────────────────────────
  compareMode: EnhanceCompareMode;
  compareSource: EnhanceCompareSource;
  // ─── Module 11B — Enhance Profiles (Phase 7) ──────────────────────────────
  profile: EnhanceProfileId;
}

export type EnhanceOptions = Omit<EnhanceState, 'split' | 'compareMode' | 'compareSource' | 'profile'>;

// ─── Module 11A — Enhance Engine ──────────────────────────────────────────────

export interface EnhancedPreview {
  path: string;
  width: number;
  height: number;
}

export interface EnhanceResult {
  sourceAssetId: string;
  previewPath: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface OptimizeState {
  profile: OptimizationProfile;
  settings: OptimizationSettings;
  sourceSvg: string | null;
  result: OptimizationResult | null;
  isOptimizing: boolean;
  progress: number;
  error: string | null;
  compareMode: OptimizeCompareMode;
}

// ─── Module 08 — Web Assets Generator Domain Models ──────────────────────────

export type AssetProfile = 'website' | 'startup' | 'saas' | 'fullBrandKit';

export type AssetGroupKind = 'favicon' | 'apple' | 'android' | 'pwa' | 'social' | 'logo';

export interface AssetGenerationOptions {
  favicon: boolean;
  apple: boolean;
  android: boolean;
  pwa: boolean;
  social: boolean;
  logo: boolean;
}

export interface GeneratedAsset {
  id: string;
  filename: string;
  format: 'png' | 'svg' | 'ico' | 'json';
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  cachePath: string;
  group: AssetGroupKind;
}

export interface GeneratedAssetGroup {
  kind: AssetGroupKind;
  label: string;
  assets: GeneratedAsset[];
}

export interface AssetPackageSummary {
  totalAssets: number;
  totalSizeBytes: number;
  formats: string[];
}

export interface AssetPackage {
  id: string;
  profile: AssetProfile;
  groups: GeneratedAssetGroup[];
  summary: AssetPackageSummary;
  generatedAt: number;
  projectId: string;
}

// Enmienda B+F — WebAssetsState (extended for Module 08)
export interface WebAssetsState {
  // Blueprint fields (§7 Enmienda B+F)
  faviconEnabled: boolean;
  appIconEnabled: boolean;
  logoEnabled: boolean;
  safeZonePadding: number;
  sourceFile: ImageFile | null;
  favicons: AssetVariant[];
  appIcons: AssetVariant[];
  logoVariants: AssetVariant[];
  generating: { favicon: boolean; appIcon: boolean; logo: boolean };
  preset: 'web' | 'branding' | 'favicon';
  // Module 08 additions
  profile: AssetProfile;
  options: AssetGenerationOptions;
  package: AssetPackage | null;
  selectedVariantId: string | null;
  isGenerating: boolean;
  progress: number;
  error: string | null;
}

export interface AssetVariant {
  id: string;
  group: 'favicon' | 'appIcon' | 'logo';
  label: string;
  platform?: 'ios' | 'android' | 'windows';
  sizePx?: number;
  background?: string;
  svg?: string;
}

export interface TreeNode {
  name: string;
  type: 'dir' | 'svg' | 'img' | 'ico' | 'json' | 'html';
  depth: number;
  relativePath: string;
  children?: TreeNode[];
}

// ─── Module 09 — Export Engine Domain Models ─────────────────────────────────

export type ExportProfileId =
  | 'svg'
  | 'favicon'
  | 'website'
  | 'startup'
  | 'saas'
  | 'fullBrandKit';

export interface ExportOptions {
  includeManifest: boolean;
}

export interface ExportManifestAsset {
  path: string;
  sizeBytes: number;
  format: string;
}

export interface ExportManifest {
  projectId: string;
  projectName: string;
  exportProfile: ExportProfileId;
  generatedAt: string;
  assets: ExportManifestAsset[];
}

export interface ExportAsset {
  sourcePath: string;
  destPath: string;
  sizeBytes: number;
  format: string;
}

export interface ExportBundle {
  profile: ExportProfileId;
  projectId: string;
  projectName: string;
  projectDir: string;
  assets: ExportAsset[];
}

export interface ExportResult {
  id: string;
  profile: ExportProfileId;
  filename: string;
  path: string;
  sizeBytes: number;
  assetCount: number;
  createdAt: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ExportPackage {
  id: 'web' | 'branding' | 'favicon';
  name: string;
  desc: string;
  fileCount: number;
  sizeLabel: string;
  tree: TreeNode[];
}

export interface ExportState {
  profile: ExportProfileId;
  options: ExportOptions;
  tree: TreeNode[];
  exports: ExportResult[];
  isBuilding: boolean;
  progress: number;
  error: string | null;
}

export interface RecentProject {
  id: string;
  name: string;
  meta: string;
  tag: string;
}

// Module 03 — Project domain models
export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSettings {
  qualityPreset: 'fast' | 'balanced' | 'max';
  exportDir: string;
}

export interface Project {
  metadata: ProjectMetadata;
  settings: ProjectSettings;
}

export interface CurrentProject {
  id: string;
  name: string;
  saved: boolean;
  savedAt: number;
  dir: string;
  activeAssetId: string;
  activeSvgId: string;
  activeOptimizedSvgId: string;
  activeEnhancedId?: string;
}

export interface ProjectState {
  current: CurrentProject | null;
  lifetimeProcessed: number;
  recentProjects: RecentProject[];
  recentExports: RecentExport[];
}

export interface RecentExport {
  id: string;
  name: string;
  ext: string;
  time: string;
  size: string;
  savingsPct?: number;
}

export interface UserPreferences {
  theme: Theme;
  perfMode: PerfMode;
  exportDir: string;
  qualityPreset: 'fast' | 'balanced' | 'max';
  language: Lang;
}

export interface EngineStats {
  vramUsedGb: number;
  vramTotalGb: number;
  cudaCores: number;
  engineActive: boolean;
  cpuPct: number;
  gpuPct: number;
}

export interface StatusDescriptor {
  text: string;
  color: string;
  pulse: boolean;
}

export interface ApplicationState {
  ui: {
    screen: Screen;
    theme: Theme;
    perfMode: PerfMode;
    panelWidths: { sidebar: number; right: number };
  };
  convert: ConvertState;
  enhance: EnhanceState;
  optimize: OptimizeState;   // Module 07: SVG optimization state
  batch: BatchState;
  export: ExportState;
  project: {
    current: CurrentProject | null;
    lifetimeProcessed: number;
    recentProjects: RecentProject[];
    recentExports: RecentExport[];
  };
  preferences: UserPreferences;
  system: EngineStats;
}

export type SetFn<D> = <K extends keyof D>(key: K, value: D[K], opts?: { record?: boolean }) => void;

export interface Command {
  label: string;
  apply(): boolean;
  invert(): boolean;
}

// ─── Module 05 — Batch Processing Domain Models ───────────────────────────────

export type PipelineStage =
  | 'queued'
  | 'loading'
  | 'processing'
  | 'finalizing'
  | 'done'
  | 'error';

export interface WorkerInfo {
  id: string;
  jobId: string | null;
  status: 'idle' | 'busy';
}

export interface JobProgress {
  jobId: string;
  pct: number;
  stage: PipelineStage;
  elapsedMs: number;
}

export interface QueueState {
  items: ProcessingJob[];
  running: boolean;
  workers: number;
  completed: number;
  failed: number;
  startedAt?: number;
  finishedAt?: number;
}

// ─── Type guards (§7 canonical) ────────────────────────────────────────────────
export function isReady(j: ProcessingJob): j is ReadyJob {
  return j.phase === 'ready';
}

export function isPending(j: ProcessingJob): j is PendingJob {
  return j.phase === 'pending';
}

// ─── Module 06 — SVG Conversion Engine Domain Models ─────────────────────────

export interface VectorizationOptions {
  mode: ConvertMode;
  detail: number;   // 0–100
  colors: number;   // 2–32
  smoothing: number; // 0–100
}

export interface VectorizationResult {
  svg: string;
  nodeCount: number;
  pathCount: number;
  points: [number, number][];
  generatedAt: number;
  sourcePath: string;
  cachePath: string;
}

export interface NodeOverlayData {
  points: [number, number][];
  pathCount: number;
  nodeCount: number;
}

export interface SvgMetadata {
  pathCount: number;
  nodeCount: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  generatedSizeBytes: number;
}

export type PreviewMode = 'source' | 'vector' | 'split';

export interface ConvertJobResult {
  jobId: string;
  svg: string;
  nodeCount: number;
  pathCount: number;
  points: [number, number][];
  cachePath: string;
}

// ─── Module 04 — Asset Domain Models ──────────────────────────────────────────

export interface AssetMetadata {
  width: number;
  height: number;
  format: ImageFile['format'];
  sizeBytes: number;
  createdAt: number;
  modifiedAt: number;
  importedAt: number;
}

export interface ThumbnailInfo {
  assetId: string;
  thumbPath: string;
  width: number;
  height: number;
}

export interface ImportResult {
  assetId: string;
  ref: ImageRef;
  errors: string[];
}

export interface ProbeResult {
  id: string;
  format: ImageFile['format'];
  width: number;
  height: number;
}

export interface AssetItem {
  id: string;
  ref: ImageRef;
  file?: ImageFile;
  metadata?: AssetMetadata;
  thumbnail?: ThumbnailInfo;
  status: 'pending' | 'probing' | 'ready' | 'error';
  error?: string;
}

// ─── Storage Architecture — project.json registry types ─────────────────────

export interface ProjectAssetEntry {
  id: string;
  filename: string;
  path: string;
  format: string;
  createdAt: number;
}

export interface ProjectSvgEntry {
  id: string;
  sourceAssetId: string;
  path: string;
  createdAt: number;
  // ─── Module 11B — Pipeline Traceability (optional: absent on svgs created
  // before this patch) ─────────────────────────────────────────────────────
  enhancedVersionId?: string;
}

export interface ProjectOptimizedEntry {
  id: string;
  sourceSvgId: string;
  path: string;
  createdAt: number;
}

// ─── Module 11A — Enhance Engine (optional: absent on projects created before
// this patch; project-migrator.ts backfills it on open) ──────────────────────
export interface EnhanceAdjustmentSettings {
  brightness: number;
  contrast: number;
  sharpen: number;
  denoise: number;
  saturation: number;
  colorTemp: number;
}

export interface ProjectEnhancedEntry {
  id: string;
  sourceAssetId: string;
  filename: string;
  path: string;
  createdAt: string;
  // ─── Module 11B — Enhanced Asset Versioning (optional: absent on entries
  // created under M11A; normalized in memory by the rehydrator/repair pass) ──
  version?: number;
  settings?: EnhanceAdjustmentSettings;
}

// ─── Module 11B — Enhance Profiles ────────────────────────────────────────────
export type EnhanceProfileId = 'softCleanup' | 'photoRestore' | 'highContrast' | 'webReady' | 'custom';

export interface EnhanceProfileDefinition {
  id: string;
  name: string;
  settings: EnhanceAdjustmentSettings;
}

// ─── Module 11B — Enhance Queue System (independent from BatchStore) ────────
export type EnhanceQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface EnhanceQueueItem {
  id: string;
  assetId: string;
  sourcePath: string;
  status: EnhanceQueueStatus;
  pct: number;
  error?: string;
  resultVersionId?: string;
}

export interface EnhanceQueueState {
  running: boolean;
  workers: number;
  items: EnhanceQueueItem[];
  completed: number;
  failed: number;
}

// ─── Module 11B — Pipeline Traceability ──────────────────────────────────────
export interface AssetLineage {
  originalAssetId: string;
  enhancedVersionId?: string;
  svgId?: string;
  optimizedId?: string;
  webAssetIds: string[];
  exportIds: string[];
}

// ─── Module 11B — Future AI Preparation (architecture hook only — no AI is
// implemented in v1.0; see services/enhance/enhanceProvider.ts) ──────────────
export interface EnhanceProvider {
  id: string;
  name: string;
  supportsUpscale: boolean;
  supportsBackgroundRemoval: boolean;
  supportsDenoise: boolean;
}

export interface ProjectWebAssetEntry {
  id: string;
  type: string;
  path: string;
}

export interface ProjectExportEntry {
  id: string;
  profile: string;
  filename: string;
  path: string;
  createdAt: number;
}

export interface ProjectJson {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  assets: ProjectAssetEntry[];
  svgs: ProjectSvgEntry[];
  optimized: ProjectOptimizedEntry[];
  webAssets: ProjectWebAssetEntry[];
  exports: ProjectExportEntry[];
  activeAssetId: string;
  activeSvgId: string;
  activeOptimizedSvgId: string;
  // ─── Module 10.1 — Project Lifecycle Manager (optional: absent on projects
  // created before this patch; project-migrator.ts backfills them on open) ────
  projectVersion?: string;
  createdWith?: string;
  lastOpenedWith?: string;
  tags?: string[];
  lastOpened?: number;
  assetCount?: number;
  svgCount?: number;
  exportCount?: number;
  // ─── Module 11A — Enhance Engine (optional: absent on projects created
  // before this patch; project-migrator.ts backfills them on open) ────────────
  enhanced?: ProjectEnhancedEntry[];
  activeEnhancedId?: string;
}

// ─── Module 10.1 — Project Lifecycle Manager Domain Models ───────────────────

export enum ProjectHealth {
  Healthy = 'healthy',
  Warning = 'warning',
  Damaged = 'damaged',
}

export interface IntegrityIssue {
  area: 'manifest' | 'assets' | 'cache' | 'exports' | 'registry' | 'activeRefs';
  message: string;
  severity: 'warning' | 'error';
}

export interface IntegrityReport {
  health: ProjectHealth;
  issues: IntegrityIssue[];
}

export interface ProjectStats {
  assets: number;
  svgs: number;
  optimizedSvgs: number;
  exports: number;
  diskUsageBytes: number;
}

export interface SessionState {
  lastProjectId: string;
  lastScreen: Screen | '';
  lastAssetId: string;
  lastSvgId: string;
}
