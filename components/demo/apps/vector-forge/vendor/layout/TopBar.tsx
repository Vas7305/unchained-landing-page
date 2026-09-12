import { Undo2, Redo2, Download } from 'lucide-react';
import { useUiStore } from '../stores/uiStore';
import { useHistoryStore } from '../stores/historyStore';
import { useToastStore } from '../stores/toastStore';
import { useProjectStore } from '../stores/projectStore';
import { IconButton } from '../primitives/IconButton';
import { StatusPill } from '../primitives/StatusPill';
import { useT } from '../hooks/useT';
import type { Screen } from '../types';
import styles from './TopBar.module.css';

const SCREEN_TITLES: Record<Screen, string> = {
  dashboard: 'Dashboard',
  convert: 'Convert',
  enhance: 'Enhance',
  optimize: 'Optimize',
  web: 'Web Assets',
  batch: 'Batch Processing',
  export: 'Export',
  settings: 'Settings',
};

function useStatusDescriptor(screen: Screen) {
  return {
    dashboard: { text: 'Ready', color: 'var(--accent-500)', pulse: false },
    convert:   { text: 'Idle',  color: 'var(--text-faint)', pulse: false },
    enhance:   { text: 'Idle',  color: 'var(--text-faint)', pulse: false },
    optimize:  { text: 'Idle',  color: 'var(--text-faint)', pulse: false },
    web:       { text: 'Idle',  color: 'var(--text-faint)', pulse: false },
    batch:     { text: 'Idle',  color: 'var(--text-faint)', pulse: false },
    export:    { text: 'Idle',  color: 'var(--text-faint)', pulse: false },
    settings:  { text: 'Ready', color: 'var(--accent-500)', pulse: false },
  }[screen];
}

function formatSavedAt(savedAt: number): string {
  const diff = Date.now() - savedAt;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function TopBar() {
  const screen = useUiStore((s) => s.screen);
  const { canUndo, canRedo, undo, redo } = useHistoryStore();
  const { show } = useToastStore();
  const current = useProjectStore((s) => s.current);
  const t = useT();

  const status = useStatusDescriptor(screen);

  const handleUndo = () => {
    undo((msg) => show('danger', msg));
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <span className={styles.screenTitle}>{SCREEN_TITLES[screen]}</span>
        {current && (
          <div className={styles.projectContext}>
            <span className={styles.projectName}>{current.name}</span>
            <span className={styles.projectSaved} aria-label={`Last saved ${formatSavedAt(current.savedAt)}`}>
              {current.saved ? `Saved ${formatSavedAt(current.savedAt)}` : 'Unsaved'}
            </span>
          </div>
        )}
      </div>

      <div className={styles.center}>
        <StatusPill text={status.text} color={status.color} pulse={status.pulse} />
      </div>

      <div className={styles.right}>
        <IconButton
          icon={<Undo2 size={16} strokeWidth={1.5} />}
          title={t('action.undo')}
          disabled={!canUndo}
          onClick={handleUndo}
        />
        <IconButton
          icon={<Redo2 size={16} strokeWidth={1.5} />}
          title={t('action.redo')}
          disabled={!canRedo}
          onClick={redo}
        />
        <div className={styles.sep} aria-hidden="true" />
        <IconButton
          icon={<Download size={16} strokeWidth={1.5} />}
          title={t('action.export')}
          onClick={() => {}}
        />
      </div>
    </header>
  );
}
