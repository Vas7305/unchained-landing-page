import { describe, expect, it, vi } from 'vitest';
import { SecurityEventClient, createHttpTransport, type IngestResult } from './client';
import { EventValidationError } from './validate';
import type { SecurityEventInput } from './contract';

/**
 * The adapter an application wraps around the Core.
 *
 * These tests pin the two behaviours an integrating application depends on and
 * cannot see from the outside: that correlation survives across the events of
 * one operation (§18), and that a transport failure does or does not propagate
 * according to how the caller classified the event (§33).
 */

const loginSuccess: SecurityEventInput = {
  event_category: 'AUTHENTICATION',
  event_type: 'AUTH',
  event_action: 'LOGIN_SUCCESS',
  severity: 'INFO',
  status: 'SUCCESS',
};

/** A transport that records what it was given and answers like the Core. */
function recordingTransport() {
  const sent: Record<string, unknown>[] = [];
  const transport = async (payload: Record<string, unknown>): Promise<IngestResult> => {
    sent.push(payload);
    return { id: `evt-${sent.length}`, occurred_at: '2026-09-12T10:00:00.000Z' };
  };
  return { sent, transport };
}

describe('emitting an event', () => {
  it('sends the validated wire payload and returns the identifier', async () => {
    const { sent, transport } = recordingTransport();
    const client = new SecurityEventClient({ transport });

    const result = await client.emit(loginSuccess);

    expect(result).toEqual({ id: 'evt-1', occurred_at: '2026-09-12T10:00:00.000Z' });
    expect(sent[0]).toMatchObject({
      event_category: 'AUTHENTICATION',
      event_action: 'LOGIN_SUCCESS',
      schema_version: '1.0',
    });
  });

  it('throws for a malformed event rather than sending it', async () => {
    // A validation failure is a defect in the calling code. Swallowing it
    // would let an application emit nothing for weeks without noticing.
    const { sent, transport } = recordingTransport();
    const client = new SecurityEventClient({ transport });

    await expect(client.emit({ ...loginSuccess, severity: 'URGENT' as never })).rejects.toThrow(
      EventValidationError,
    );
    expect(sent).toEqual([]);
  });
});

describe('correlation (§18)', () => {
  it('carries one correlation id across every event of an operation', async () => {
    const { sent, transport } = recordingTransport();
    const correlationId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const operation = new SecurityEventClient({ transport }).withDefaults({ correlation_id: correlationId });

    // §18's worked example: one logical business operation, five events.
    await operation.emit({ ...loginSuccess, event_category: 'ORDER', event_type: 'ORDER', event_action: 'ORDER_CREATED' });
    await operation.emit({ ...loginSuccess, event_category: 'PAYMENT', event_type: 'PAYMENT', event_action: 'PAYMENT_CREATED' });
    await operation.emit({ ...loginSuccess, event_category: 'PAYMENT', event_type: 'PAYMENT', event_action: 'PAYMENT_COMPLETED' });

    expect(sent).toHaveLength(3);
    for (const payload of sent) {
      expect(payload.correlation_id).toBe(correlationId);
    }
  });

  it('preserves the request id across events', async () => {
    // §19: request_id is what lets an event be traced back into application
    // logs, so it has to survive being set once on a request-scoped client.
    const { sent, transport } = recordingTransport();
    const request = new SecurityEventClient({ transport }).withDefaults({ request_id: 'req_01HQ8Z' });

    await request.emit(loginSuccess);
    await request.emit({ ...loginSuccess, event_action: 'LOGOUT' });

    expect(sent.map((p) => p.request_id)).toEqual(['req_01HQ8Z', 'req_01HQ8Z']);
  });

  it('lets an individual event override a default', async () => {
    const { sent, transport } = recordingTransport();
    const client = new SecurityEventClient({ transport }).withDefaults({ actor_id: 'user-1' });

    await client.emit({ ...loginSuccess, actor_id: 'user-2' });

    expect(sent[0].actor_id).toBe('user-2');
  });

  it('does not mutate the client it was derived from', async () => {
    const { sent, transport } = recordingTransport();
    const base = new SecurityEventClient({ transport });
    base.withDefaults({ request_id: 'req_scoped' });

    await base.emit(loginSuccess);

    expect('request_id' in sent[0]).toBe(false);
  });
});

describe('failure semantics (§33)', () => {
  it('emit() survives a transport failure and reports it', async () => {
    // An audit write must not fail the order it was describing.
    const onError = vi.fn();
    const client = new SecurityEventClient({
      transport: async () => {
        throw new Error('network down');
      },
      onError,
    });

    await expect(client.emit(loginSuccess)).resolves.toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('emitCritical() propagates a transport failure', async () => {
    // For the events where losing the record is worse than failing the
    // operation.
    const client = new SecurityEventClient({
      transport: async () => {
        throw new Error('network down');
      },
    });

    await expect(
      client.emitCritical({
        ...loginSuccess,
        event_category: 'SECURITY',
        event_type: 'SECURITY',
        event_action: 'CREDENTIAL_COMPROMISE',
        severity: 'CRITICAL',
        status: 'DETECTED',
      }),
    ).rejects.toThrow('network down');
  });
});

describe('the HTTP transport', () => {
  it('presents the application key as a header, never in the body', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'evt-1', occurred_at: '2026-09-12T10:00:00.000Z' }), {
        status: 201,
      }),
    );

    const transport = createHttpTransport({
      endpoint: 'https://example.test/functions/v1/security-core',
      applicationKey: 'usk_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await transport({ event_action: 'LOGIN_SUCCESS' });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Security-Application-Key']).toBe('usk_test');
    expect(init.body).not.toContain('usk_test');
  });

  it('surfaces a refusal without inventing an identifier', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_event', reason: 'invalid_severity' }), {
        status: 400,
      }),
    );

    const transport = createHttpTransport({
      endpoint: 'https://example.test/functions/v1/security-core',
      applicationKey: 'usk_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(transport({})).rejects.toThrow(/invalid_event/);
  });
});
