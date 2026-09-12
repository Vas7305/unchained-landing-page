import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { SpecialistSelection } from '../types';

/**
 * Booking context for the persistent CTA.
 *
 * A page that knows what the visitor is looking at (a service, a specialist, a
 * result) declares it here, and the sticky mobile bar deep-links straight into
 * that booking instead of dropping the visitor on an empty form. Pages that
 * declare nothing fall back to the generic action.
 */

export interface CtaTarget {
  label: string;
  serviceSlug?: string;
  specialist?: SpecialistSelection;
  /** Analytics origin, e.g. `service-detail`. */
  from: string;
  /** Shown as a second line on the sticky bar: price, duration, specialist. */
  detail?: string;
  /** Hides the bar entirely — used inside the booking flow itself. */
  hidden?: boolean;
}

const DEFAULT_TARGET: CtaTarget = { label: 'Записаться', from: 'sticky' };

const CtaContext = createContext<{
  target: CtaTarget;
  setTarget: (target: CtaTarget | null) => void;
}>({ target: DEFAULT_TARGET, setTarget: () => {} });

export function CtaProvider({ children }: { children: React.ReactNode }) {
  const [target, setTargetState] = useState<CtaTarget | null>(null);

  const value = useMemo(
    () => ({
      target: target ?? DEFAULT_TARGET,
      setTarget: setTargetState,
    }),
    [target],
  );

  return <CtaContext.Provider value={value}>{children}</CtaContext.Provider>;
}

export function useCtaTarget(): CtaTarget {
  return useContext(CtaContext).target;
}

/**
 * Declares the booking target for as long as the calling page is mounted.
 * Clearing on unmount is what keeps a stale service from leaking to the next page.
 */
export function useDeclareCta(target: CtaTarget | null): void {
  const { setTarget } = useContext(CtaContext);
  const key = JSON.stringify(target);

  useEffect(() => {
    setTarget(key ? (JSON.parse(key) as CtaTarget) : null);
    return () => setTarget(null);
  }, [key, setTarget]);
}
