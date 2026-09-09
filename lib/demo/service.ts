/**
 * The demo system's stand-in for a backend.
 *
 * ─── What a "simulated request" is here ───────────────────────────────────
 * In the real products, submitting an order, confirming a booking or exporting
 * a package is a network round trip that can be slow and can be refused. A
 * demo that returns instantly and always succeeds teaches the visitor the
 * wrong thing about the product, so those operations keep their shape: a
 * pending state, a short delay, and an answer that may be a refusal.
 *
 * What they do NOT keep is the network. `simulate` runs a pure function that
 * the demo already had to write anyway — the same one its tests call directly —
 * and resolves with the result after a timer.
 *
 * ─── Why failures are deterministic ───────────────────────────────────────
 * A demo that fails one time in ten is a demo that fails in front of the one
 * visitor who mattered, and succeeds every time anybody tries to reproduce it.
 * So nothing here is random: a demo's refusals are conditions on its own
 * state — a card number reserved for declines, a slot that was taken while the
 * form was open, a fund with less capital left than the allocation asks for.
 * Each one is reachable on purpose and reachable again.
 */

/** Why an operation was refused. */
export interface DemoFailure {
  /** Stable identifier, so a view can special-case a refusal it explains. */
  code: string;
  /** Sentence shown to the visitor, in the product's own language. */
  message: string;
  /**
   * The form field at fault, where there is one. Lets the view move focus and
   * attach `aria-describedby` to the right control rather than announcing a
   * form-level error for a single bad postcode.
   */
  field?: string;
}

export type DemoResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: DemoFailure };

export function ok<T>(value: T): DemoResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  code: string,
  message: string,
  field?: string,
): DemoResult<T> {
  return { ok: false, failure: { code, message, ...(field ? { field } : {}) } };
}

/**
 * How long a simulated operation takes.
 *
 * Long enough that a pending state is visible and honest, short enough that
 * the demo never feels like it is buffering. §8: delays are for realism, not
 * for drama, so there is no "thinking" animation longer than the work it
 * stands for.
 */
export const DEMO_LATENCY = {
  /** A filter, a search, a lookup. */
  quick: 180,
  /** A save, a booking, an allocation. */
  normal: 420,
  /** Something the real product genuinely grinds on — an export, a trace. */
  heavy: 900,
} as const;

/**
 * Tests do not wait.
 *
 * The reducers and the decision functions are what lib/demo/apps/*.test.ts
 * exercises, so they never reach this module — but a view-level test added
 * later should not spend real seconds in timers either. Setting the multiplier
 * to 0 makes every simulated operation resolve on the next macrotask while
 * keeping the pending state observable.
 */
let latencyScale = 1;

/** @internal Test seam. Production code never calls this. */
export function setDemoLatencyScale(scale: number): void {
  latencyScale = Math.max(0, scale);
}

/**
 * Run a decision and answer with it after a plausible delay.
 *
 * `decide` is pure and synchronous — it is the demo's own logic, and it is the
 * function its unit tests call. Everything asynchronous about a demo lives
 * here and nowhere else, which is why "does this demo touch the network" is a
 * question with a one-word answer.
 */
export function simulate<T>(
  decide: () => DemoResult<T>,
  delayMs: number = DEMO_LATENCY.normal,
): Promise<DemoResult<T>> {
  // Computed before the timer, so a decision made against the state the
  // visitor was actually looking at is not re-evaluated against a later one.
  const result = decide();
  const wait = Math.round(delayMs * latencyScale);

  if (wait === 0) return Promise.resolve(result);

  return new Promise((resolve) => {
    setTimeout(() => resolve(result), wait);
  });
}

/**
 * A queue worked through one item at a time, reporting as it goes.
 *
 * ─── Why this is not `Promise.all` ────────────────────────────────────────
 * Because the product is not. A batch queue that reports "running", then
 * "done", per item, in order, is the thing being demonstrated; running the
 * items concurrently would finish sooner and show nothing. The sequencing is
 * the feature.
 *
 * ─── And why the loop lives here rather than in the view ──────────────────
 * This module's contract is that everything asynchronous about a demo happens
 * in it. A component that awaits its way down a list has quietly taken over
 * pacing, which is this file's job — and a reviewer then has to check two
 * places to answer "how long does this demo take, and can it be sped up for a
 * test". `latencyScale` applies here and nowhere else.
 *
 * `start` may return a settle function, called after the delay: the natural
 * shape for "mark it running, wait, mark it finished".
 */
export async function simulateEach<T>(
  items: readonly T[],
  start: (item: T) => void | (() => void),
  stepMs: number = DEMO_LATENCY.quick,
): Promise<void> {
  const wait = Math.round(stepMs * latencyScale);

  for (const item of items) {
    const settle = start(item);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    settle?.();
  }
}

/**
 * A step sequence, for operations the real product reports progress on.
 *
 * VectorForge tracing an image and an export writing a package are not one
 * spinner in the product and should not be one here. `onStep` is called with
 * each label in turn; the returned promise settles after the last one.
 */
export async function simulateSteps(
  steps: readonly string[],
  onStep: (step: string, index: number) => void,
  stepMs = 260,
): Promise<void> {
  const wait = Math.round(stepMs * latencyScale);
  for (let i = 0; i < steps.length; i++) {
    onStep(steps[i], i);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}
