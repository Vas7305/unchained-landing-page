'use client';

import {
  Component,
  Suspense,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { RotateCcw } from 'lucide-react';
import DemoSpinner from './ui/DemoSpinner';
import { demoComponents } from './demoComponents';

/**
 * Where a demo's code is actually fetched, and the only place it is.
 *
 * ─── §11, concretely ──────────────────────────────────────────────────────
 * Each demo is behind its own dynamic `import()` in lib/demo/registry.ts, so
 * each is its own chunk. Nothing renders one of those lazy components except
 * this file, and this file only appears on the demo route — so opening the
 * homepage, the work index or a project page fetches no demo code whatsoever,
 * and opening one demo fetches one demo.
 *
 * ─── Why it is client-only ────────────────────────────────────────────────
 * `isClient` is false during the server pass and false on the first client
 * render, so both produce the same skeleton and hydration has nothing to
 * disagree about. That is a deliberate trade, and the reason is specific:
 * these demos format money, dates and percentages in six locales, and Node's
 * ICU data and the browser's do not always agree on a separator or a symbol
 * position. Server-rendering them would risk a hydration mismatch in any one
 * of eight applications, in exchange for a little first paint inside a frame
 * the visitor has to scroll to. The page's actual content — heading,
 * explanation, project copy, every link — is server-rendered by DemoShell, and
 * is what a crawler and a no-JavaScript visitor see.
 *
 * The client check is a `useSyncExternalStore` with a server snapshot of false
 * rather than the usual `useState` + `useEffect(() => setMounted(true))`,
 * which schedules a second render pass from inside an effect. Same result, no
 * cascading render, and it is the pattern lib/i18n/localeStore.ts already uses.
 *
 * ─── Reset is a remount ───────────────────────────────────────────────────
 * The shell changes `resetToken`, which is part of this component's `key` in
 * the tree above. React discards the subtree and builds it again from the
 * demo's own initial state — so reset is total by construction, and cannot rot
 * as a demo grows a piece of state somebody forgets to clear (§10). It costs
 * nothing: the chunk is already loaded and the fixtures are module constants.
 */

interface StageProps {
  /** The project whose demo to render. */
  slug: string;
  scenarioId: string;
  /** Localised, because everything here is chrome the visitor reads. */
  labels: {
    loading: string;
    error: string;
    retry: string;
  };
}

/** Never subscribes: the value only has to differ between server and client. */
const noopSubscribe = () => () => {};

function Skeleton({ message }: { message: string }) {
  return (
    <div className='h-full flex flex-col items-center justify-center gap-3 text-[var(--d-muted)]'>
      <DemoSpinner size={22} />
      <p className='text-xs'>{message}</p>
    </div>
  );
}

/**
 * A chunk that will not load.
 *
 * Worth handling rather than letting it throw: this is the one failure the
 * demo system genuinely has, and it is a network failure — a deploy that moved
 * the chunk, a visitor who went offline between opening the page and reaching
 * the demo. The retry re-mounts the boundary and React attempts the import
 * again.
 */
class LoadBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback(() => this.setState({ failed: false }));
    }
    return this.props.children;
  }
}

export default function DemoStage({ slug, scenarioId, labels }: StageProps) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // A module-scope constant, not something built here: see demoComponents.ts.
  // The map has a null prototype, so an unknown slug is simply undefined.
  const App = demoComponents[slug];

  if (!isClient || !App) return <Skeleton message={labels.loading} />;

  return (
    <LoadBoundary
      fallback={(retry) => (
        <div className='h-full flex flex-col items-center justify-center gap-3 px-6 text-center'>
          <p className='text-xs text-[var(--d-muted)]'>{labels.error}</p>
          <button
            type='button'
            onClick={retry}
            style={{ borderRadius: 'var(--d-radius)' }}
            className='inline-flex items-center gap-2 px-4 min-h-10 text-xs font-semibold bg-[var(--d-accent)] text-[var(--d-accent-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
          >
            <RotateCcw size={13} aria-hidden='true' />
            {labels.retry}
          </button>
        </div>
      )}
    >
      <Suspense fallback={<Skeleton message={labels.loading} />}>
        <App scenarioId={scenarioId} />
      </Suspense>
    </LoadBoundary>
  );
}
