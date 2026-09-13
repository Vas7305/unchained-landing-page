import { describe, expect, it } from 'vitest';
import {
  EventValidationError,
  assertValidEvent,
  isValidApplicationId,
  isValidEnvironment,
  toWirePayload,
  validateEvent,
} from './validate';
import { METADATA_MAX_BYTES, type SecurityEventInput } from './contract';

/**
 * The Security & Audit Event Contract, as executable rules.
 *
 * Every test below cites the section of
 * docs/security/SECURITY_EVENT_CONTRACT_V1.md it encodes. The point is not
 * coverage for its own sake: these are the rules an application will be told
 * it violated, so each one needs to be a rule the validator actually applies
 * rather than one the documentation claims it does.
 */

/** The minimum event the contract accepts. §43.1, reduced to its required fields. */
const validEvent: SecurityEventInput = {
  event_category: 'AUTHENTICATION',
  event_type: 'AUTH',
  event_action: 'LOGIN_SUCCESS',
  severity: 'INFO',
  status: 'SUCCESS',
};

/** The codes reported, for asserting on a set rather than on a list order. */
function codesFor(input: unknown): string[] {
  return validateEvent(input).map((issue) => `${issue.field}:${issue.code}`);
}

describe('a valid event', () => {
  it('accepts the minimum required fields', () => {
    expect(validateEvent(validEvent)).toEqual([]);
  });

  it('accepts the contract§43.1 successful login in full', () => {
    expect(
      validateEvent({
        ...validEvent,
        actor_type: 'USER',
        actor_id: '8f14e45f-ceea-467a-a3cd-9d1e2b8f4a21',
        resource_type: 'SESSION',
        resource_id: 'c0ffee00-0000-4000-8000-000000000001',
        session_id: 'c0ffee00-0000-4000-8000-000000000001',
        request_id: 'req_01HQ8Z',
        correlation_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        metadata: {},
      }),
    ).toEqual([]);
  });

  it('accepts an application-specific action, which §13 permits', () => {
    // §13 reserves a catalogue and allows an action outside it where nothing
    // in the catalogue fits. The validator checks SHAPE, not membership.
    expect(validateEvent({ ...validEvent, event_action: 'TANCOINS_GRANTED' })).toEqual([]);
  });
});

describe('classification (§11, §12)', () => {
  it('rejects a category outside the canonical sixteen', () => {
    expect(codesFor({ ...validEvent, event_category: 'MARKETING' })).toContain(
      'event_category:unknown-category',
    );
  });

  it('rejects a lowercase or malformed action', () => {
    expect(codesFor({ ...validEvent, event_action: 'login_success' })).toContain(
      'event_action:malformed-symbol',
    );
    expect(codesFor({ ...validEvent, event_type: '9AUTH' })).toContain(
      'event_type:malformed-symbol',
    );
  });
});

describe('severity and status (§14, §15)', () => {
  it('rejects a severity outside the five', () => {
    expect(codesFor({ ...validEvent, severity: 'URGENT' })).toContain('severity:invalid-severity');
  });

  it('rejects a status outside the six', () => {
    expect(codesFor({ ...validEvent, status: 'MAYBE' })).toContain('status:invalid-status');
  });
});

describe('the actor model (§16)', () => {
  it('rejects an actor_type outside the six', () => {
    expect(codesFor({ ...validEvent, actor_type: 'ROBOT' })).toContain(
      'actor_type:invalid-actor-type',
    );
  });

  it('rejects an ANONYMOUS event that names an actor', () => {
    // §16.2: an event with no identifiable actor carries a null id. Naming one
    // while claiming anonymity is a contradiction, and in practice it is an
    // email address or an IP in a field that must hold neither.
    expect(
      codesFor({ ...validEvent, actor_type: 'ANONYMOUS', actor_id: 'someone' }),
    ).toContain('actor_id:actor-id-on-anonymous');
  });

  it('accepts ANONYMOUS with a null actor, which is §43.2', () => {
    expect(
      validateEvent({
        ...validEvent,
        event_action: 'LOGIN_FAILED',
        severity: 'LOW',
        status: 'FAILURE',
        actor_type: 'ANONYMOUS',
        actor_id: null,
      }),
    ).toEqual([]);
  });

  it('rejects an email address as actor_id', () => {
    // §16.2 forbids it outright, and it is the single commonest thing to find
    // in this field.
    expect(codesFor({ ...validEvent, actor_id: 'juan@example.com' })).toContain(
      'actor_id:actor-id-looks-like-email',
    );
  });
});

describe('correlation and identifiers (§18, §19, §20)', () => {
  it('rejects a malformed correlation_id', () => {
    // §18.1 makes it a UUID. Dropping a malformed one would silently lose a
    // branch of an investigation.
    expect(codesFor({ ...validEvent, correlation_id: 'order-1234' })).toContain(
      'correlation_id:malformed-uuid',
    );
  });

  it('rejects an empty string, which is a missing value in disguise', () => {
    expect(codesFor({ ...validEvent, correlation_id: '' })).toContain(
      'correlation_id:malformed-uuid',
    );
  });

  it('accepts an opaque non-UUID request_id', () => {
    // §19 asks for an identifier, not a shape. Platform trace ids are rarely
    // UUIDs and rejecting them would make the field unusable.
    expect(validateEvent({ ...validEvent, request_id: '1-5f9a2b-7c3d' })).toEqual([]);
  });

  it('refuses a token in session_id', () => {
    // §20: a session identifier must never be the credential itself.
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(codesFor({ ...validEvent, session_id: jwt })).toContain('session_id:prohibited-data');
  });
});

describe('network data (§22)', () => {
  it('accepts IPv4 and IPv6', () => {
    expect(validateEvent({ ...validEvent, ip_address: '203.0.113.7' })).toEqual([]);
    expect(validateEvent({ ...validEvent, ip_address: '2001:db8::1' })).toEqual([]);
  });

  it('rejects what actually arrives in this field when it is wrong', () => {
    // A forwarded-for list, a hostname, and the string "unknown" are the three
    // things that turn up here.
    expect(codesFor({ ...validEvent, ip_address: '203.0.113.7, 198.51.100.2' })).toContain(
      'ip_address:malformed-ip',
    );
    expect(codesFor({ ...validEvent, ip_address: 'unknown' })).toContain('ip_address:malformed-ip');
    expect(codesFor({ ...validEvent, ip_address: '999.1.1.1' })).toContain(
      'ip_address:malformed-ip',
    );
  });
});

describe('metadata (§24, §25, §42.4)', () => {
  it('rejects a non-object at the root', () => {
    expect(codesFor({ ...validEvent, metadata: ['a', 'b'] })).toContain('metadata:not-an-object');
    expect(codesFor({ ...validEvent, metadata: 'a string' })).toContain('metadata:not-an-object');
  });

  it('rejects metadata over the size ceiling', () => {
    const oversized = { dump: 'x'.repeat(METADATA_MAX_BYTES + 1) };
    expect(codesFor({ ...validEvent, metadata: oversized })).toContain('metadata:too-large');
  });

  it('accepts the §24 worked example', () => {
    expect(
      validateEvent({ ...validEvent, metadata: { old_plan: 'pro', new_plan: 'premium' } }),
    ).toEqual([]);
  });

  it('rejects credentials in metadata', () => {
    const issues = codesFor({ ...validEvent, metadata: { password: 'hunter2' } });
    expect(issues).toContain('metadata.password:prohibited-data');
  });

  it('rejects an object nested past the depth limit', () => {
    // §42.4 forbids storing whole records, and seven levels of nesting inside
    // an audit event is a record.
    const deep = { a: { b: { c: { d: { e: { f: { g: 'too far' } } } } } } };
    expect(codesFor({ ...validEvent, metadata: deep }).some((c) => c.endsWith(':too-deep'))).toBe(
      true,
    );
  });
});

describe('timestamps (§8.2)', () => {
  it('accepts an ISO string and a Date', () => {
    expect(validateEvent({ ...validEvent, occurred_at: '2026-09-12T10:00:00Z' })).toEqual([]);
    expect(validateEvent({ ...validEvent, occurred_at: new Date() })).toEqual([]);
  });

  it('rejects an unparseable timestamp rather than defaulting it', () => {
    // An Invalid Date serializes to null and would silently become "now" at
    // the server, which is a different claim from the one the caller made.
    expect(codesFor({ ...validEvent, occurred_at: 'last tuesday' })).toContain(
      'occurred_at:invalid-date',
    );
    expect(codesFor({ ...validEvent, occurred_at: new Date('nonsense') })).toContain(
      'occurred_at:invalid-date',
    );
  });
});

describe('malformed events', () => {
  it('rejects a non-object', () => {
    expect(codesFor(null)).toEqual(['<root>:not-an-object']);
    expect(codesFor('an event')).toEqual(['<root>:not-an-object']);
    expect(codesFor([validEvent])).toEqual(['<root>:not-an-object']);
  });

  it('reports every problem at once, not the first', () => {
    // An application integrating for the first time usually has three things
    // wrong. Reporting them one round trip at a time is the difference between
    // a ten-minute integration and an afternoon.
    const issues = validateEvent({
      event_category: 'NOPE',
      event_type: 'auth',
      event_action: 'login',
      severity: 'URGENT',
      status: 'MAYBE',
    });
    expect(issues.length).toBeGreaterThanOrEqual(5);
  });

  it('never puts a value into an issue message', () => {
    // An error message is the single most likely thing to end up in a log
    // line, which makes it the last place a secret should be quoted.
    const issues = validateEvent({ ...validEvent, metadata: { api_key: 'sk_live_abcdef1234567890' } });
    for (const issue of issues) {
      expect(issue.message).not.toContain('sk_live_abcdef1234567890');
      expect(issue.field).not.toContain('sk_live_abcdef1234567890');
    }
  });
});

describe('assertValidEvent', () => {
  it('throws with every issue attached', () => {
    try {
      assertValidEvent({ ...validEvent, severity: 'URGENT' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EventValidationError);
      expect((error as EventValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it('is silent for a valid event', () => {
    expect(() => assertValidEvent(validEvent)).not.toThrow();
  });
});

describe('application identifiers (§9.1)', () => {
  it('accepts the registered slugs', () => {
    expect(isValidApplicationId('tancerca')).toBe(true);
    expect(isValidApplicationId('frito')).toBe(true);
    expect(isValidApplicationId('unchained-business')).toBe(true);
  });

  it('rejects a display name used as an identifier', () => {
    // §9.1's own counter-example.
    expect(isValidApplicationId('TanCerca Marketplace Production')).toBe(false);
    expect(isValidApplicationId('TanCerca')).toBe(false);
    expect(isValidApplicationId('')).toBe(false);
  });
});

describe('environments (§10)', () => {
  it('accepts the four and nothing else', () => {
    for (const env of ['development', 'staging', 'production', 'test']) {
      expect(isValidEnvironment(env)).toBe(true);
    }
    expect(isValidEnvironment('prod')).toBe(false);
    expect(isValidEnvironment('PRODUCTION')).toBe(false);
  });
});

describe('toWirePayload', () => {
  it('stamps the contract version (§44)', () => {
    expect(toWirePayload(validEvent).schema_version).toBe('1.0');
  });

  it('normalizes occurred_at to ISO 8601', () => {
    const payload = toWirePayload({ ...validEvent, occurred_at: new Date('2026-09-12T10:00:00Z') });
    expect(payload.occurred_at).toBe('2026-09-12T10:00:00.000Z');
  });

  it('omits absent fields rather than sending nulls', () => {
    const payload = toWirePayload(validEvent);
    expect('correlation_id' in payload).toBe(false);
    expect('ip_address' in payload).toBe(false);
    expect(payload.metadata).toEqual({});
  });

  it('keeps an explicit null, which means "known to be absent"', () => {
    const payload = toWirePayload({ ...validEvent, actor_type: 'ANONYMOUS', actor_id: null });
    expect(payload.actor_id).toBeNull();
  });

  it('never carries application_id or environment (§12 of the brief)', () => {
    // Both are properties of the credential the event arrives under, not
    // claims the payload makes. An application that could name its own
    // application_id could write into another application's history.
    const payload = toWirePayload({
      ...validEvent,
      // @ts-expect-error — the type forbids it; this proves the runtime does too.
      application_id: 'frito',
      environment: 'production',
    });
    expect('application_id' in payload).toBe(false);
    expect('environment' in payload).toBe(false);
  });

  it('refuses to serialize an invalid event', () => {
    expect(() => toWirePayload({ ...validEvent, severity: 'URGENT' as never })).toThrow(
      EventValidationError,
    );
  });
});

describe('absent fields, which are not the same test as wrong ones', () => {
  /**
   * ─── Why this block exists ─────────────────────────────────────────────
   * The SQL half of this validator had exactly this hole: `NULL IN (...)` is
   * NULL, `NOT NULL` is NULL, and a branch on a NULL condition does not fire,
   * so an event whose `severity` key was simply missing passed validation and
   * died later on a NOT NULL constraint.
   *
   * TypeScript's `undefined` does not have that failure mode — `typeof
   * undefined !== 'string'` is plainly true — but the rule is worth pinning
   * here anyway, because the two validators are meant to agree and this is the
   * case where they most easily would not.
   */
  const requiredFields = ['event_category', 'event_type', 'event_action', 'severity', 'status'] as const;

  for (const field of requiredFields) {
    it(`rejects an event with no ${field}`, () => {
      const incomplete: Record<string, unknown> = { ...validEvent };
      delete incomplete[field];
      expect(validateEvent(incomplete).some((issue) => issue.field === field)).toBe(true);
    });
  }

  it('rejects an explicit null in a required field', () => {
    expect(codesFor({ ...validEvent, severity: null })).toContain('severity:invalid-severity');
    expect(codesFor({ ...validEvent, status: null })).toContain('status:invalid-status');
  });

  it('accepts an event carrying no metadata key at all', () => {
    // Valid, and the server substitutes an empty object. The column is NOT
    // NULL, so "absent" must never travel as null.
    expect(validateEvent(validEvent)).toEqual([]);
    expect(toWirePayload(validEvent).metadata).toEqual({});
  });
});
