import { X } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';
import styles from './Toast.module.css';

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className={styles.container} role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`} role="alert">
          <span className={styles.message}>{t.message}</span>
          <button
            className={styles.dismiss}
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            type="button"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
