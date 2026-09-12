import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import type { ImageRef } from '../types';
import { openImportDialog, validateRef } from '../services/fs';
import { useToastStore } from '../stores/toastStore';
import styles from './DropZone.module.css';

interface DropZoneProps {
  onFiles: (refs: ImageRef[]) => void;
  dragOver: boolean;
  title: string;
  hint: string;
}

function filterAndValidate(
  refs: ImageRef[],
  showToast: (level: 'danger', msg: string) => void
): ImageRef[] {
  const valid: ImageRef[] = [];
  for (const ref of refs) {
    const err = validateRef(ref);
    if (err) showToast('danger', err);
    else valid.push(ref);
  }
  return valid;
}

export function DropZone({ onFiles, dragOver, title, hint }: DropZoneProps) {
  const showToast = useToastStore((s) => s.show);

  // DEMO DIVERGENCE — the product keeps `onFiles` and `showToast` in refs it
  // writes during render, so the Tauri drag-drop listener below could stay
  // mounted for the component's whole life while still calling the latest
  // props. That listener is gone (see below) and the click handler is the only
  // consumer left, so the props go in the dependency array where they belong.
  const handleClick = useCallback(async () => {
    const refs = await openImportDialog();
    if (refs.length === 0) return;
    const valid = filterAndValidate(refs, showToast);
    if (valid.length > 0) onFiles(valid);
  }, [onFiles, showToast]);

  // DEMO DIVERGENCE — the product also listens for Tauri's OS-level drag-drop,
  // which is the only way a desktop app learns a dropped file's real path. A
  // browser tab has no such event and this demo reads no local files, so the
  // listener is gone; the click path above is the whole import surface.

  return (
    <div
      className={`${styles.zone} ${dragOver ? styles.dragOver : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${title}. ${hint}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => e.preventDefault()}
      onClick={() => { void handleClick(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleClick();
        }
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        <Upload size={24} strokeWidth={1.5} />
      </span>
      <span className={styles.title}>{title}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
