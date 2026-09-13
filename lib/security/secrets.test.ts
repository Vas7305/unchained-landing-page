import { describe, expect, it } from 'vitest';
import {
  REDACTED,
  SecretInMetadataError,
  assertNoSecrets,
  isMetadataWithinLimit,
  metadataByteLength,
  redactSecrets,
  scanForSecrets,
} from './secrets';

/**
 * Keeping credentials out of the audit trail (contract §24, §25, §42.3).
 *
 * The tests are in two halves, and the second half is the one that decides
 * whether this mechanism survives contact with a real codebase:
 *
 *   · what it MUST catch — the shapes credentials actually take, including
 *     under innocent key names, which is where a key denylist alone fails;
 *   · what it MUST NOT catch — the ordinary fields a real event carries. A
 *     detector that fires on `authorized_at` or a 16-digit order number gets
 *     switched off by the people it fires on, and a switched-off detector
 *     protects nothing.
 */

const rules = (value: unknown) => scanForSecrets(value as never).map((f) => f.rule);
const paths = (value: unknown) => scanForSecrets(value as never).map((f) => f.path);

describe('prohibited key names', () => {
  it('catches a password under any spelling', () => {
    for (const key of ['password', 'Password', 'pass_word', 'userPassword', 'PASSWD']) {
      expect(scanForSecrets({ [key]: 'hunter2' }).length).toBe(1);
    }
  });

  it('catches every token flavour', () => {
    for (const key of ['token', 'access_token', 'accessToken', 'ACCESS-TOKEN', 'refresh_token', 'token_hash']) {
      expect(scanForSecrets({ [key]: 'anything' }).length).toBe(1);
    }
  });

  it('catches api keys, secrets and private keys', () => {
    expect(scanForSecrets({ api_key: 'x' }).length).toBe(1);
    expect(scanForSecrets({ apiKey: 'x' }).length).toBe(1);
    expect(scanForSecrets({ client_secret: 'x' }).length).toBe(1);
    expect(scanForSecrets({ privateKey: 'x' }).length).toBe(1);
    expect(scanForSecrets({ authorization: 'x' }).length).toBe(1);
  });

  it('catches card and identity fields', () => {
    expect(scanForSecrets({ card_number: '1' }).length).toBe(1);
    expect(scanForSecrets({ cvv: '123' }).length).toBe(1);
    expect(scanForSecrets({ iban: 'x' }).length).toBe(1);
  });

  it('reports the path so the caller knows which field to fix', () => {
    expect(paths({ user: { profile: { token: 'x' } } })).toEqual(['user.profile.token']);
    expect(paths({ items: [{ api_key: 'x' }] })).toEqual(['items[0].api_key']);
  });

  it('condemns the whole subtree at the offending key, not each leaf under it', () => {
    // `credentials` is itself prohibited, so the finding is the object — one
    // finding naming the field to delete, rather than four naming the things
    // inside it, which would all be the same mistake reported four times.
    expect(paths({ user: { credentials: { token: 'x', password: 'y' } } })).toEqual([
      'user.credentials',
    ]);
  });

  it('never reports the value', () => {
    const findings = scanForSecrets({ password: 'hunter2' });
    expect(JSON.stringify(findings)).not.toContain('hunter2');
  });
});

describe('keys that must NOT trip the scan', () => {
  /**
   * ─── Why this block exists ─────────────────────────────────────────────
   * `auth` as a fragment would reject `authorized_at`, `author` and
   * `authentication_method`. `key` as a fragment would reject
   * `idempotency_key` and `sort_key`. `pan` as a substring would reject
   * `company`, `panel` and `japan`. Each of those is a legitimate field, and
   * two of them are fields this contract's own events carry.
   */
  it('allows ordinary fields that merely resemble a secret', () => {
    const innocent = {
      authorized_at: '2026-09-12T10:00:00Z',
      author: 'valter',
      authentication_method: 'password',
      idempotency_key: 'abc123',
      sort_key: 'created_at',
      partition_key: 'tancerca',
      company: 'Unchained',
      panel: 'admin',
      expansion: 'phase-2',
      keyboard_layout: 'es',
      old_plan: 'pro',
      new_plan: 'premium',
    };
    expect(scanForSecrets(innocent)).toEqual([]);
  });
});

describe('credentials hiding under innocent key names', () => {
  /**
   * The case a key denylist cannot see. Each value below sits under a key
   * nothing would flag, and each is a working credential.
   */
  it('catches a JWT', () => {
    expect(
      rules({
        value:
          'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      }),
    ).toEqual(['jwt']);
  });

  it('catches a PEM private key', () => {
    expect(rules({ note: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...' })).toEqual([
      'pem-private-key',
    ]);
    expect(rules({ note: '-----BEGIN PRIVATE KEY-----' })).toEqual(['pem-private-key']);
  });

  it('catches a bearer credential inside a string', () => {
    expect(rules({ header: 'Bearer abcdef0123456789abcdef' })).toEqual(['bearer-token']);
  });

  it('catches vendor-prefixed keys', () => {
    expect(rules({ reference: 'sk_live_abcdefghij0123456789' })).toEqual(['stripe-key']);
    expect(rules({ detail: 'AKIAIOSFODNN7EXAMPLE' })).toEqual(['aws-access-key-id']);
    expect(rules({ detail: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' })).toEqual(['github-token']);
  });

  it('catches a connection string carrying credentials', () => {
    expect(rules({ target: 'postgres://admin:s3cret@db.internal:5432/app' })).toEqual([
      'url-credentials',
    ]);
  });
});

describe('payment card numbers (§42.3)', () => {
  it('catches a Luhn-valid PAN, spaced or hyphenated as people paste them', () => {
    expect(rules({ reference: '4242424242424242' })).toEqual(['payment-card-number']);
    expect(rules({ reference: '4242 4242 4242 4242' })).toEqual(['payment-card-number']);
    expect(rules({ reference: '4242-4242-4242-4242' })).toEqual(['payment-card-number']);
    // An Amex, which is 15 digits rather than 16.
    expect(rules({ reference: '378282246310005' })).toEqual(['payment-card-number']);
  });

  it('catches one embedded in a sentence', () => {
    expect(rules({ note: 'customer gave card 4242424242424242 over the phone' })).toEqual([
      'payment-card-number',
    ]);
  });

  it('does NOT fire on ordinary long numbers', () => {
    /**
     * ─── The test that keeps the rule usable ───────────────────────────────
     * Order numbers, millisecond timestamps, phone numbers and database ids
     * are all long digit runs. Requiring the Luhn checksum is what turns a
     * rule that would fire constantly into one that is usually right.
     */
    expect(
      scanForSecrets({
        order_number: '1234567890123456',
        timestamp_ms: '1757671234567',
        phone: '+53 5 1234567',
        invoice: '9876543210987654',
      }),
    ).toEqual([]);
  });
});

describe('structural limits', () => {
  it('reports nesting past the depth limit instead of descending forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'x' } } } } } } };
    expect(rules(deep)).toContain('max-depth-exceeded');
  });

  it('reports a circular reference rather than hanging', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic.self = cyclic;
    expect(rules(cyclic)).toContain('circular-reference');
  });

  it('measures size in UTF-8 bytes, which is what the column stores', () => {
    // A limit counted in JavaScript characters would let an event pass here
    // and fail at the boundary.
    expect(metadataByteLength({ a: 'é' })).toBeGreaterThan(JSON.stringify({ a: 'é' }).length - 1);
    expect(isMetadataWithinLimit({ a: 'x'.repeat(100) })).toBe(true);
    expect(isMetadataWithinLimit({ a: 'x'.repeat(20000) })).toBe(false);
  });
});

describe('assertNoSecrets', () => {
  it('throws with the findings attached', () => {
    try {
      assertNoSecrets({ password: 'hunter2' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SecretInMetadataError);
      expect((error as SecretInMetadataError).findings[0].path).toBe('password');
    }
  });

  it('does not quote the secret in the thrown message', () => {
    try {
      assertNoSecrets({ password: 'hunter2' });
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
      expect((error as Error).message).toContain('password');
    }
  });

  it('is silent for clean metadata', () => {
    expect(() => assertNoSecrets({ amount: 1500, currency: 'CUP' })).not.toThrow();
  });
});

describe('redactSecrets', () => {
  it('replaces prohibited fields and leaves the rest intact', () => {
    expect(redactSecrets({ user: 'u1', password: 'hunter2', amount: 1500 })).toEqual({
      user: 'u1',
      password: REDACTED,
      amount: 1500,
    });
  });

  it('redacts a credential found by its value', () => {
    expect(redactSecrets({ note: 'sk_live_abcdefghij0123456789' })).toEqual({ note: REDACTED });
  });

  it('produces metadata the scan then accepts', () => {
    const dirty = { password: 'x', nested: { api_key: 'y', fine: 'ok' } };
    expect(scanForSecrets(redactSecrets(dirty))).toEqual([]);
  });
});
