import React, { useEffect, useId, useRef } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  variant: 'default' | 'destructive';
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, variant, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // DEMO DIVERGENCE — the product renders the title inside the panel but never
  // connects it to the <dialog>, so a screen reader announces "dialog" with no
  // name. The id below points `aria-labelledby` at the heading that is already
  // on screen. Additive, no behaviour change, and worth taking upstream — it is
  // the one accessibility finding in this tree that a real user would hit.
  const titleId = useId();
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      previousFocusRef.current = document.activeElement;
      dialog.showModal();
    } else {
      dialog.close();
      (previousFocusRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${styles[variant]}`}
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title} id={titleId}>
            {title}
          </span>
          <button className={styles.close} onClick={onClose} aria-label="Close" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
