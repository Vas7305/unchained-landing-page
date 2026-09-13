/**
 * The adapter an application wraps around the Security & Audit Core.
 *
 * ─── What an integrating application has to do ────────────────────────────
 *
 *     Future App  ──>  SecurityEventClient  ──>  Unchained Security Core
 *
 * That is the whole surface. An application builds a `SecurityEventInput`,
 * calls `emit()`, and never learns anything about the Admin Panel, the event
 * table, the RLS policies or the permission model. Contract §2 requires that
 * separation — an application that had to understand the Admin Panel to record
 * an event would be the prohibited architecture in that section.
 *
 * ─── Transport is injected, and that is the point ─────────────────────────
 * This module does not import a Supabase client, does not read an environment
 * variable and does not choose an HTTP library. It takes a `transport`
 * function. TanCerca runs on its own isolated project and posts to the
 * `security-core` edge function with an application key; the Unchained panel,
 * already holding a session, calls the `security_ingest_event` RPC; a test
 * passes a function that appends to an array.
 *
 * All three get the same validation, the same correlation handling and the
 * same failure semantics, which is what makes this an implementation of one
 * contract rather than three integrations that resemble each other.
 *
 * ─── Failure semantics (contract §33, §34) ────────────────────────────────
 * Contract §33 asks for two things that pull against each other: a security
 * event must not silently disappear, and security logging must not cause
 * cascading failures. §34 adds that not every event should be synchronous.
 *
 * So the caller classifies the event, once, at the call site:
 *
 *   · `emit()`       — best effort. Resolves whether or not the event was
 *                      persisted; a failure reaches `onError` and nothing
 *                      else. This is the default because a failed audit write
 *                      must not fail the order it was describing.
 *   · `emitCritical()` — throws if the event was not persisted. For the events
 *                      where losing the record is worse than failing the
 *                      operation: a credential compromise, a role change, a
 *                      detected intrusion.
 *
 * There is no queue, no batching and no background worker here. §34 permits
 * them and §50 forbids building them before they are needed; when a volume
 * problem actually exists, it is solved inside a `transport`, which is exactly
 * where it belongs and where it changes nothing about the callers.
 */

import { SECURITY_EVENT_SCHEMA_VERSION, type SecurityEventInput } from './contract';
import { assertValidEvent, toWirePayload } from './validate';

/**
 * What the Core answers when an event is accepted.
 *
 * `id` is the stable event identifier of contract §8.1, and returning it is
 * what lets a caller reference the event it just wrote — in a correction, in
 * an alert, or in its own logs.
 */
export interface IngestResult {
  readonly id: string;
  readonly occurred_at: string;
}

/**
 * How events reach the Core.
 *
 * Receives the validated wire payload and returns the identifier the Core
 * assigned. Throwing is how a transport reports failure; the client decides
 * what that means according to the event's class.
 */
export type SecurityEventTransport = (
  payload: Record<string, unknown>,
) => Promise<IngestResult>;

export interface SecurityEventClientOptions {
  readonly transport: SecurityEventTransport;

  /**
   * Where a best-effort failure goes.
   *
   * Contract §33: ingestion failures must be observable. The default writes to
   * `console.error`, which is the minimum that satisfies "observable" and is
   * almost certainly not what a production application wants — point this at
   * whatever already receives that application's operational errors.
   *
   * ─── This must never emit a security event ───────────────────────────────
   * Doing so is the recursion of the implementation brief §27: ingestion
   * fails, the handler reports it by emitting an event, that event fails to
   * ingest, and the handler runs again. Infrastructure failures belong in the
   * application's ordinary error channel, which is a different system by
   * design.
   */
  readonly onError?: (error: unknown, payload: Record<string, unknown>) => void;

  /**
   * Fields merged into every event this client emits.
   *
   * For the context an application knows once and should not repeat at three
   * hundred call sites — the request id of the current request, the session,
   * the user agent. Anything set explicitly on an event wins.
   */
  readonly defaults?: Partial<
    Pick<
      SecurityEventInput,
      | 'actor_type'
      | 'actor_id'
      | 'session_id'
      | 'request_id'
      | 'correlation_id'
      | 'ip_address'
      | 'user_agent'
      | 'device_id'
    >
  >;
}

function defaultOnError(error: unknown, payload: Record<string, unknown>): void {
  const action = typeof payload.event_action === 'string' ? payload.event_action : 'UNKNOWN';
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`[security-core] ${action} was not recorded: ${reason}`);
}

/**
 * An application's handle on the Security & Audit Core.
 *
 * Cheap to construct and safe to construct per request, which is the usual
 * shape: a request-scoped client carrying that request's `request_id` and
 * actor in `defaults` means no call site has to remember them.
 */
export class SecurityEventClient {
  private readonly transport: SecurityEventTransport;
  private readonly onError: (error: unknown, payload: Record<string, unknown>) => void;
  private readonly defaults: SecurityEventClientOptions['defaults'];

  constructor(options: SecurityEventClientOptions) {
    this.transport = options.transport;
    this.onError = options.onError ?? defaultOnError;
    this.defaults = options.defaults;
  }

  /** The contract version this client speaks (contract §44). */
  static readonly schemaVersion = SECURITY_EVENT_SCHEMA_VERSION;

  /**
   * A client that shares this one's transport with additional defaults.
   *
   * The idiom for contract §18: one logical operation, one correlation id,
   * many events.
   *
   *     const op = security.withDefaults({ correlation_id: crypto.randomUUID() });
   *     await op.emit({ ...ORDER_CREATED });
   *     await op.emit({ ...PAYMENT_CREATED });
   *     await op.emit({ ...DELIVERY_CREATED });
   *
   * Every event carries the same correlation id without any call site holding
   * it, which is what makes the relationship survive a refactor.
   */
  withDefaults(defaults: SecurityEventClientOptions['defaults']): SecurityEventClient {
    return new SecurityEventClient({
      transport: this.transport,
      onError: this.onError,
      defaults: { ...this.defaults, ...defaults },
    });
  }

  /**
   * Record an event, best effort.
   *
   * Returns the result, or `null` if the event could not be recorded. Never
   * throws for a transport failure — see the header on why that is the default
   * — but DOES throw `EventValidationError` for a malformed event, because
   * that is a defect in the calling code rather than a condition of the
   * network, and swallowing it would let an application emit nothing for weeks
   * without noticing.
   */
  async emit(input: SecurityEventInput): Promise<IngestResult | null> {
    const payload = this.prepare(input);
    try {
      return await this.transport(payload);
    } catch (error) {
      this.onError(error, payload);
      return null;
    }
  }

  /**
   * Record an event, and fail if it was not recorded.
   *
   * For the events of contract §33 where persistence is a first-class part of
   * the operation. Use it deliberately: every call is a place where the
   * Security Core becomes a dependency of the thing it is observing.
   */
  async emitCritical(input: SecurityEventInput): Promise<IngestResult> {
    return this.transport(this.prepare(input));
  }

  /** Merge defaults, validate, serialize. The one path both emitters share. */
  private prepare(input: SecurityEventInput): Record<string, unknown> {
    const merged: SecurityEventInput = { ...this.defaults, ...input };
    assertValidEvent(merged);
    return toWirePayload(merged);
  }
}

/**
 * A transport that posts to the `security-core` edge function.
 *
 * The shape an application on its OWN Supabase project uses: it has no session
 * in the Unchained project and authenticates with an application key, which
 * is what identifies it and what fixes its `application_id` and `environment`
 * server-side (contract §41).
 *
 * The key is a credential. It belongs in that application's secret management
 * alongside its other service credentials, is read from there at runtime, and
 * is never shipped to a browser — an application key in client-side code would
 * let anyone holding the page write events as that application.
 */
export function createHttpTransport(options: {
  readonly endpoint: string;
  readonly applicationKey: string;
  readonly fetchImpl?: typeof fetch;
}): SecurityEventTransport {
  const doFetch = options.fetchImpl ?? fetch;

  return async (payload) => {
    const response = await doFetch(options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Application-Key': options.applicationKey,
      },
      body: JSON.stringify({ action: 'ingest_event', event: payload }),
    });

    if (!response.ok) {
      // The Core's error bodies are deliberately terse (§28 of the brief): a
      // code and a sentence, never SQL, a stack or an internal identifier.
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(
        `Security Core rejected the event (HTTP ${response.status}): ${body?.error ?? 'no detail'}`,
      );
    }

    const body = (await response.json()) as { id?: string; occurred_at?: string };
    if (!body.id || !body.occurred_at) {
      throw new Error('Security Core returned no event identifier.');
    }
    return { id: body.id, occurred_at: body.occurred_at };
  };
}
