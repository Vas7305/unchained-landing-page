/**
 * Keeping credentials out of the audit trail.
 *
 * ─── The problem this solves ──────────────────────────────────────────────
 * Contract §24 and §42.3 forbid storing passwords, tokens, API keys, private
 * keys, authentication secrets and payment card numbers in an event. The
 * failure mode is never deliberate. It is an application that reaches for
 * convenience — `metadata: { request: req.body }`, `metadata: { user }` — and
 * ships a refresh token into a table that is, by design, append-only and
 * readable by every Super Admin for as long as the retention policy says.
 *
 * An audit trail is the worst possible place for a secret: it is the one store
 * whose whole purpose is to be kept, copied to a SIEM, and read by humans.
 *
 * ─── Why "strip the obvious keys" is not enough ───────────────────────────
 * A key-name denylist catches `{ "password": "..." }` and misses every one of
 * these, all of which are things applications actually do:
 *
 *     { "value": "eyJhbGciOi..." }            a JWT under an innocent name
 *     { "header": "Bearer sk_live_..." }      a credential inside a string
 *     { "note": "-----BEGIN RSA PRIVATE KEY" } a key pasted into a comment
 *     { "card": "4242 4242 4242 4242" }        a PAN with spaces in it
 *     { "Pass Word": "hunter2" }               a key the denylist spells differently
 *
 * So detection runs on both sides. KEYS are matched after normalization, so
 * `access_token`, `accessToken`, `ACCESS-TOKEN` and `Access Token` are one
 * name. VALUES are matched against the shapes credentials actually have, which
 * is what catches a secret hiding under a blameless key.
 *
 * ─── Why it rejects instead of redacting ──────────────────────────────────
 * Redaction would be friendlier and would be the wrong default. An event whose
 * metadata was quietly rewritten is an event whose author never learns they
 * are leaking, and the next secret they leak will be in a shape this file does
 * not recognize. Rejecting makes the defect the caller's, at the moment they
 * introduce it.
 *
 * `redactSecrets()` exists for the one case where that logic inverts — a
 * generic adapter forwarding events it did not author and cannot fix — and it
 * is not what the ingestion path uses.
 *
 * ─── This is the client-side half ─────────────────────────────────────────
 * The enforcing copy is `public.security_metadata_violations()` in the
 * database, which the ingestion function calls and no caller can skip. See the
 * note at the top of `contract.ts` on why both exist. If the two ever disagree,
 * the database is the one that decides what gets stored.
 */

import {
  METADATA_MAX_BYTES,
  METADATA_MAX_DEPTH,
  type EventMetadata,
  type JsonValue,
} from './contract';

/**
 * One prohibited thing that was found.
 *
 * `path` says where; `rule` says what matched. The VALUE is deliberately never
 * carried — a finding is reported, logged, and sometimes stored, and a report
 * that quoted the secret it found would be the leak it was written to prevent.
 */
export interface SecretFinding {
  /** Dotted path into the metadata object, e.g. `user.credentials.token`. */
  readonly path: string;
  /** Which rule matched — a name, never the matched text. */
  readonly rule: string;
}

// ─── Key names ──────────────────────────────────────────────────────────────

/**
 * A key, reduced to letters and digits and lowercased.
 *
 * `access_token`, `accessToken`, `ACCESS-TOKEN` and `Access Token` all become
 * `accesstoken`, which is what makes the denylist below a list of concepts
 * rather than a list of spellings.
 */
function normalizeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

/**
 * Normalized key fragments that make a field prohibited.
 *
 * Matched as substrings of the normalized key, which is what lets one entry
 * cover `token`, `tokens`, `sessionToken` and `token_hash` at once.
 *
 * ─── The entries that are deliberately NOT here ───────────────────────────
 * `auth` alone would reject `authorized_at`, `author` and `authentication_method`
 * — all of them legitimate, and two of them things this contract's own events
 * carry. `key` alone would reject `idempotency_key`, `sort_key` and
 * `partition_key`. A rule that fires on innocent fields gets suppressed by the
 * people it fires on, which costs more than the rule was worth, so each entry
 * below is specific enough to be almost always right.
 */
const PROHIBITED_KEY_FRAGMENTS: readonly string[] = [
  'password',
  'passwd',
  'passphrase',
  'token', // access, refresh, id, session, csrf, bearer, token_hash
  'secret', // client_secret, secret_key, webhook_secret
  'apikey',
  'privatekey',
  'publickey', // a public key is not a secret; a field carrying one is a key dump
  'credential',
  'authorization', // the header, by its own name
  'sessionkey',
  'encryptionkey',
  'signingkey',
  'cardnumber',
  'cardnum',
  'cvv',
  'cvc',
  'securitycode',
  'pan', // matched exactly, not as a substring — see below
  'iban',
  'ssn',
  'clientsecret',
  'refreshtoken',
  'accesstoken',
  'bearer',
  'otp',
  'mfacode',
  'totp',
  'recoverycode',
  'backupcode',
];

/**
 * Fragments too short or too common to match as substrings.
 *
 * `pan` inside `company`, `panel`, `japan` or `expansion` is not a card
 * number. `otp` inside a word is not a one-time password. These are compared
 * against the WHOLE normalized key instead.
 */
const EXACT_ONLY_FRAGMENTS: ReadonlySet<string> = new Set(['pan', 'otp', 'ssn', 'iban', 'cvv', 'cvc']);

/** Which key rule a field trips, if any. */
function prohibitedKeyRule(key: string): string | null {
  const normalized = normalizeKey(key);
  if (!normalized) return null;

  for (const fragment of PROHIBITED_KEY_FRAGMENTS) {
    if (EXACT_ONLY_FRAGMENTS.has(fragment)) {
      if (normalized === fragment) return `prohibited-key:${fragment}`;
      continue;
    }
    if (normalized.includes(fragment)) return `prohibited-key:${fragment}`;
  }
  return null;
}

// ─── Value shapes ───────────────────────────────────────────────────────────

/**
 * Credential shapes that are recognizable wherever they appear.
 *
 * Each is anchored to something structural rather than to a keyword, because a
 * secret does not stop being one when the field is renamed. Order is not
 * significant; the first match wins and the rest are not evaluated.
 */
const VALUE_RULES: readonly { readonly rule: string; readonly pattern: RegExp }[] = [
  // A PEM private key block. The header is unambiguous and appears verbatim.
  { rule: 'pem-private-key', pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  // A JWT: three base64url segments, and a first segment that decodes to a
  // JSON header. The `eyJ` prefix IS `{"` in base64url, which is what makes
  // this specific rather than "any three dot-separated blobs".
  { rule: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  // An Authorization header value carried inside a string.
  { rule: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/i },
  { rule: 'basic-auth', pattern: /\bBasic\s+[A-Za-z0-9+/]{16,}={0,2}/ },
  // Vendor-prefixed keys. These prefixes are chosen by their issuers precisely
  // so that a leaked key is identifiable, which works in our favour here.
  { rule: 'stripe-key', pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { rule: 'aws-access-key-id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { rule: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { rule: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { rule: 'slack-token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { rule: 'openai-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  // A URL carrying credentials in its authority section.
  { rule: 'url-credentials', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i },
  // A postgres/supabase connection string is all of the above at once.
  { rule: 'private-key-body', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/ },
];

/**
 * Digit runs that pass the Luhn checksum at card length.
 *
 * ─── Why Luhn, and not "16 digits" ────────────────────────────────────────
 * Order numbers, timestamps in milliseconds, phone numbers and database ids
 * are all long digit runs, and rejecting every one of them would make this
 * check useless within a week. Every real payment card number satisfies the
 * Luhn checksum, and an arbitrary 16-digit number satisfies it about one time
 * in ten — so requiring Luhn turns a rule that fires constantly into one that
 * is usually right.
 *
 * Separators are tolerated because `4242 4242 4242 4242` and
 * `4242-4242-4242-4242` are how people paste them.
 */
function looksLikePaymentCard(value: string): boolean {
  // Candidate runs: 13–19 digits, optionally grouped by single spaces or
  // hyphens, not adjoining another digit on either side.
  const candidates = value.match(/(?<![0-9])(?:[0-9][ -]?){12,18}[0-9](?![0-9])/g);
  if (!candidates) return false;

  for (const candidate of candidates) {
    const digits = candidate.replace(/[^0-9]/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    if (luhnValid(digits)) return true;
  }
  return false;
}

/** The Luhn checksum, as every card issuer computes it. */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Which value rule a string trips, if any. */
function prohibitedValueRule(value: string): string | null {
  for (const { rule, pattern } of VALUE_RULES) {
    if (pattern.test(value)) return rule;
  }
  if (looksLikePaymentCard(value)) return 'payment-card-number';
  return null;
}

/** The placeholder a redacted field is replaced with. */
export const REDACTED = '[REDACTED]' as const;

// ─── The scan ───────────────────────────────────────────────────────────────

/**
 * Every prohibited thing in a metadata object.
 *
 * Walks keys and values to `METADATA_MAX_DEPTH`. A structure deeper than that
 * is reported as a finding of its own rather than descended into: contract
 * §42.4 forbids storing whole records, and six levels of nesting inside an
 * audit event is a record, so the depth limit and the secret scan are refusing
 * the same mistake from two directions.
 *
 * Returns every finding rather than the first, so a caller fixing an
 * integration sees the whole list in one pass.
 */
export function scanForSecrets(metadata: EventMetadata | JsonValue): readonly SecretFinding[] {
  const findings: SecretFinding[] = [];
  const seen = new WeakSet<object>();

  function walk(value: JsonValue, path: string, depth: number): void {
    if (depth > METADATA_MAX_DEPTH) {
      findings.push({ path: path || '<root>', rule: 'max-depth-exceeded' });
      return;
    }

    if (typeof value === 'string') {
      const rule = prohibitedValueRule(value);
      if (rule) findings.push({ path: path || '<root>', rule });
      return;
    }

    if (value === null || typeof value === 'number' || typeof value === 'boolean') return;

    // A cycle cannot reach a jsonb column, but it can hang this walk, and the
    // caller handing us one has a bug worth naming rather than hanging on.
    if (seen.has(value)) {
      findings.push({ path: path || '<root>', rule: 'circular-reference' });
      return;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const keyRule = prohibitedKeyRule(key);
      if (keyRule) {
        // An already-redacted field is not a finding. Without this, the output
        // of `redactSecrets()` would still be rejected by the very scan that
        // produced it — a forwarding adapter could then never construct an
        // acceptable event, which would make redaction useless.
        //
        // Letting the KEY survive is deliberate: `{"password": "[REDACTED]"}`
        // tells an investigator a password field was present and withheld,
        // which is more useful than the field silently vanishing, and it
        // discloses nothing.
        if (child === REDACTED) continue;

        // Otherwise the key alone condemns the field. Descending into it would
        // only produce more findings about the same secret.
        findings.push({ path: childPath, rule: keyRule });
        continue;
      }
      walk(child as JsonValue, childPath, depth + 1);
    }
  }

  walk(metadata as JsonValue, '', 0);
  return findings;
}

/** Raised when metadata carries something the contract forbids storing. */
export class SecretInMetadataError extends Error {
  readonly findings: readonly SecretFinding[];

  constructor(findings: readonly SecretFinding[]) {
    // The message names paths and rules and never values, because an error
    // message is the single most likely thing to end up in a log line.
    const summary = findings.map((f) => `${f.path} (${f.rule})`).join(', ');
    super(`Event metadata carries prohibited data: ${summary}`);
    this.name = 'SecretInMetadataError';
    this.findings = findings;
  }
}

/**
 * Throw unless the metadata is clean.
 *
 * This is the fail-safe path of the implementation brief: prohibited data is
 * detected and the event does not proceed. The caller sees exactly which
 * fields are at fault.
 */
export function assertNoSecrets(metadata: EventMetadata): void {
  const findings = scanForSecrets(metadata);
  if (findings.length > 0) throw new SecretInMetadataError(findings);
}

/**
 * Metadata with every prohibited field replaced by `[REDACTED]`.
 *
 * For an adapter forwarding events it did not author. An application emitting
 * its OWN events should call `assertNoSecrets()` and fix the caller — see the
 * header for why quiet redaction is the wrong default when you can fix the
 * source.
 */
export function redactSecrets(metadata: EventMetadata): EventMetadata {
  function walk(value: JsonValue, depth: number): JsonValue {
    if (depth > METADATA_MAX_DEPTH) return REDACTED;
    if (typeof value === 'string') return prohibitedValueRule(value) ? REDACTED : value;
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1));

    const out: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = prohibitedKeyRule(key) ? REDACTED : walk(child as JsonValue, depth + 1);
    }
    return out;
  }

  return walk(metadata as JsonValue, 0) as EventMetadata;
}

// ─── Size ───────────────────────────────────────────────────────────────────

/**
 * The serialized size of metadata, in bytes of UTF-8.
 *
 * Bytes and not characters, because that is what `jsonb` stores and what the
 * database's own limit counts. A string of emoji that measures 200 characters
 * in JavaScript is 800 bytes on disk, and a limit that disagreed with the one
 * enforced at the boundary would let an event pass here and fail there.
 */
export function metadataByteLength(metadata: EventMetadata): number {
  return new TextEncoder().encode(JSON.stringify(metadata)).length;
}

/** Whether metadata is within the contract's size ceiling. */
export function isMetadataWithinLimit(metadata: EventMetadata): boolean {
  return metadataByteLength(metadata) <= METADATA_MAX_BYTES;
}
