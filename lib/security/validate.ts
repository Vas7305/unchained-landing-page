/**
 * Validating an event against the Security & Audit Event Contract.
 *
 * ─── What this rejects ────────────────────────────────────────────────────
 * Unknown categories, invalid severities, invalid statuses, malformed UUIDs,
 * invalid application identifiers, oversized or over-nested metadata, metadata
 * carrying credentials, and structurally malformed events. Every rule here is
 * a sentence from `docs/security/SECURITY_EVENT_CONTRACT_V1.md`, and the
 * section is cited where the rule is not self-evident.
 *
 * ─── Every issue, not the first ───────────────────────────────────────────
 * `validateEvent()` returns a list. An application integrating for the first
 * time usually has three things wrong at once, and a validator that reports
 * them one round trip at a time turns a ten-minute integration into an
 * afternoon. The caller that wants an exception gets `assertValidEvent()`.
 *
 * ─── Reusable, and deliberately unaware of transport ──────────────────────
 * Nothing here knows how an event reaches the Core. That is what lets TanCerca,
 * Frito and the next application share it whether they post to the edge
 * function, call the RPC or hand the event to an in-process adapter.
 */

import {
  ACTOR_TYPES,
  ACTORLESS_TYPES,
  APPLICATION_ID_PATTERN,
  ENVIRONMENTS,
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  METADATA_MAX_BYTES,
  SECURITY_EVENT_SCHEMA_VERSION,
  SEVERITIES,
  SYMBOL_PATTERN,
  USER_AGENT_MAX_LENGTH,
  UUID_PATTERN,
  type ActorType,
  type EventMetadata,
  type SecurityEventInput,
} from './contract';
import { metadataByteLength, scanForSecrets } from './secrets';

/** One reason an event is not acceptable. */
export interface ValidationIssue {
  /** The offending field, dotted for metadata paths. */
  readonly field: string;
  /** A stable machine-readable reason. Safe to branch on. */
  readonly code: string;
  /** A sentence for a developer. Never contains a field's value. */
  readonly message: string;
}

/** Raised by `assertValidEvent()`. Carries every issue, not just the first. */
export class EventValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Invalid security event: ${issues.map((i) => `${i.field} ${i.code}`).join(', ')}`);
    this.name = 'EventValidationError';
    this.issues = issues;
  }
}

const CATEGORY_SET: ReadonlySet<string> = new Set(EVENT_CATEGORIES);
const SEVERITY_SET: ReadonlySet<string> = new Set(SEVERITIES);
const STATUS_SET: ReadonlySet<string> = new Set(EVENT_STATUSES);
const ACTOR_TYPE_SET: ReadonlySet<string> = new Set(ACTOR_TYPES);
const ENVIRONMENT_SET: ReadonlySet<string> = new Set(ENVIRONMENTS);

function issue(field: string, code: string, message: string): ValidationIssue {
  return { field, code, message };
}

/**
 * Whether a value is a plain JSON object.
 *
 * `typeof null === 'object'` and arrays are objects, so both are excluded
 * explicitly. A `Date` or a class instance passes this check and fails at
 * `JSON.stringify` time in a way that is hard to read, which is why the
 * metadata rules below also bound what the values may be.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * An optional identifier that must be a UUID when present.
 *
 * `null` and `undefined` are both absence and both fine. An empty string is
 * NOT: it is almost always a caller passing through a missing value from a
 * form or a header, and storing it would make "has a correlation id" true for
 * an event that has none.
 */
function checkOptionalUuid(
  value: unknown,
  field: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    issues.push(issue(field, 'not-a-string', `${field} must be a UUID string when present.`));
    return;
  }
  if (!UUID_PATTERN.test(value)) {
    issues.push(
      issue(field, 'malformed-uuid', `${field} must be a well-formed UUID. Use null for absence.`),
    );
  }
}

/** An optional SCREAMING_SNAKE symbol. */
function checkOptionalSymbol(
  value: unknown,
  field: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !SYMBOL_PATTERN.test(value)) {
    issues.push(
      issue(
        field,
        'malformed-symbol',
        `${field} must be SCREAMING_SNAKE_CASE, 2–61 characters, starting with a letter.`,
      ),
    );
  }
}

/** An optional bounded free-text field. */
function checkOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
  issues: ValidationIssue[],
): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    issues.push(issue(field, 'not-a-string', `${field} must be a string when present.`));
    return;
  }
  if (value.length > maxLength) {
    issues.push(
      issue(field, 'too-long', `${field} exceeds ${maxLength} characters.`),
    );
  }
}

/**
 * Whether an `occurred_at` is a real instant.
 *
 * Accepts a `Date` or anything `Date` can parse, and rejects `Invalid Date`,
 * which is what `new Date('nonsense')` produces and what would otherwise
 * serialize to `null` and silently become "now" at the server.
 */
function checkOccurredAt(value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined || value === null) return;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      issues.push(issue('occurred_at', 'invalid-date', 'occurred_at is an Invalid Date.'));
    }
    return;
  }

  if (typeof value !== 'string') {
    issues.push(
      issue('occurred_at', 'not-a-timestamp', 'occurred_at must be an ISO 8601 string or a Date.'),
    );
    return;
  }

  if (Number.isNaN(Date.parse(value))) {
    issues.push(
      issue('occurred_at', 'invalid-date', 'occurred_at is not a parseable ISO 8601 timestamp.'),
    );
  }
}

/**
 * The metadata rules of contract §24, §25 and §42.4.
 *
 * Size, shape and secrets, in that order — the size check first because a
 * caller that handed us a serialized database row should hear about the row
 * before hearing about the seventeen credentials inside it.
 */
function checkMetadata(value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined || value === null) return;

  if (!isPlainObject(value)) {
    issues.push(
      issue(
        'metadata',
        'not-an-object',
        'metadata must be a JSON object. Arrays and scalars are not acceptable at the root.',
      ),
    );
    return;
  }

  const metadata = value as EventMetadata;

  let size: number;
  try {
    size = metadataByteLength(metadata);
  } catch {
    // JSON.stringify throws on a cycle or a BigInt. Either is a caller passing
    // something that was never going to reach a jsonb column.
    issues.push(
      issue('metadata', 'not-serializable', 'metadata is not JSON-serializable.'),
    );
    return;
  }

  if (size > METADATA_MAX_BYTES) {
    issues.push(
      issue(
        'metadata',
        'too-large',
        `metadata is ${size} bytes, over the ${METADATA_MAX_BYTES}-byte limit. Contract §42.4 forbids storing whole records; log the fields that changed.`,
      ),
    );
  }

  for (const finding of scanForSecrets(metadata)) {
    issues.push(
      issue(
        `metadata.${finding.path}`,
        finding.rule === 'max-depth-exceeded' ? 'too-deep' : 'prohibited-data',
        finding.rule === 'max-depth-exceeded'
          ? 'metadata nests too deeply. Contract §42.4: log what changed, not the object graph.'
          : `metadata carries prohibited data (${finding.rule}). Contract §42.3: never log credentials or card numbers.`,
      ),
    );
  }
}

/**
 * Every way an event fails the contract.
 *
 * An empty array means the event is acceptable to the CLIENT. It does not mean
 * the Core will accept it: authorization, application scope and environment
 * are decided at the boundary from the caller's credential, and none of them
 * is visible here.
 */
export function validateEvent(input: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return [issue('<root>', 'not-an-object', 'An event must be a JSON object.')];
  }

  const event = input as Record<string, unknown>;

  // ── Classification (§11, §12) ────────────────────────────────────────────
  if (typeof event.event_category !== 'string' || !CATEGORY_SET.has(event.event_category)) {
    issues.push(
      issue(
        'event_category',
        'unknown-category',
        `event_category must be one of the ${EVENT_CATEGORIES.length} canonical categories. Contract §11.1 forbids inventing one.`,
      ),
    );
  }

  if (typeof event.event_type !== 'string' || !SYMBOL_PATTERN.test(event.event_type)) {
    issues.push(
      issue('event_type', 'malformed-symbol', 'event_type must be SCREAMING_SNAKE_CASE.'),
    );
  }

  if (typeof event.event_action !== 'string' || !SYMBOL_PATTERN.test(event.event_action)) {
    issues.push(
      issue('event_action', 'malformed-symbol', 'event_action must be SCREAMING_SNAKE_CASE.'),
    );
  }

  // ── Severity and status (§14, §15) ───────────────────────────────────────
  if (typeof event.severity !== 'string' || !SEVERITY_SET.has(event.severity)) {
    issues.push(
      issue('severity', 'invalid-severity', `severity must be one of ${SEVERITIES.join(', ')}.`),
    );
  }

  if (typeof event.status !== 'string' || !STATUS_SET.has(event.status)) {
    issues.push(
      issue('status', 'invalid-status', `status must be one of ${EVENT_STATUSES.join(', ')}.`),
    );
  }

  // ── Actor (§16) ──────────────────────────────────────────────────────────
  if (event.actor_type !== undefined && event.actor_type !== null) {
    if (typeof event.actor_type !== 'string' || !ACTOR_TYPE_SET.has(event.actor_type)) {
      issues.push(
        issue('actor_type', 'invalid-actor-type', `actor_type must be one of ${ACTOR_TYPES.join(', ')}.`),
      );
    } else if (
      ACTORLESS_TYPES.includes(event.actor_type as ActorType) &&
      event.actor_id !== undefined &&
      event.actor_id !== null
    ) {
      issues.push(
        issue(
          'actor_id',
          'actor-id-on-anonymous',
          'An ANONYMOUS event must not name an actor. Contract §16.2: use null where no actor is identifiable.',
        ),
      );
    }
  }

  // `actor_id` is a free identifier rather than a UUID: §16.2 says it SHOULD
  // reference the stable internal user id, and not every application's user id
  // is a UUID. What it must not be is an email address, which §16.2 forbids
  // outright and which is the mistake worth catching.
  if (typeof event.actor_id === 'string' && event.actor_id.includes('@')) {
    issues.push(
      issue(
        'actor_id',
        'actor-id-looks-like-email',
        'actor_id must not be an email address. Contract §16.2: use the stable internal identifier.',
      ),
    );
  }
  checkOptionalText(event.actor_id, 'actor_id', 200, issues);

  // ── Resource (§17) ───────────────────────────────────────────────────────
  checkOptionalSymbol(event.resource_type, 'resource_type', issues);
  checkOptionalText(event.resource_id, 'resource_id', 200, issues);

  // ── Correlation, request, session (§18, §19, §20) ────────────────────────
  // correlation_id is a UUID by §18.1. request_id and session_id are opaque:
  // §19 and §20 ask for an identifier, not for a particular shape, and a
  // request id is very often the platform's own non-UUID trace id.
  checkOptionalUuid(event.correlation_id, 'correlation_id', issues);
  checkOptionalText(event.request_id, 'request_id', 200, issues);
  checkOptionalText(event.session_id, 'session_id', 200, issues);

  // §20: a session identifier must be opaque, never the credential itself.
  // A JWT in this field is the exact failure the contract names.
  for (const field of ['session_id', 'request_id', 'device_id'] as const) {
    const value = event[field];
    if (typeof value === 'string' && scanForSecrets(value).length > 0) {
      issues.push(
        issue(
          field,
          'prohibited-data',
          `${field} must be an opaque identifier, not a token. Contract §20.`,
        ),
      );
    }
  }

  // ── Network and device (§21, §22, §23) ───────────────────────────────────
  checkOptionalText(event.device_id, 'device_id', 200, issues);
  checkOptionalText(event.user_agent, 'user_agent', USER_AGENT_MAX_LENGTH, issues);
  if (event.ip_address !== undefined && event.ip_address !== null) {
    if (typeof event.ip_address !== 'string' || !isIpAddress(event.ip_address)) {
      issues.push(
        issue('ip_address', 'malformed-ip', 'ip_address must be a valid IPv4 or IPv6 address.'),
      );
    }
  }

  // ── Time (§8.2) ──────────────────────────────────────────────────────────
  checkOccurredAt(event.occurred_at, issues);

  // ── Metadata (§24, §25, §42.4) ───────────────────────────────────────────
  checkMetadata(event.metadata, issues);

  return issues;
}

/** Throw unless the event satisfies the contract. */
export function assertValidEvent(input: unknown): asserts input is SecurityEventInput {
  const issues = validateEvent(input);
  if (issues.length > 0) throw new EventValidationError(issues);
}

/**
 * Whether an application identifier is well-formed (contract §9.1).
 *
 * Well-formed is not the same as registered: whether the identifier names a
 * real application is a question only the registry can answer, and it is
 * answered at the boundary by a foreign key to `public.admin_applications`.
 */
export function isValidApplicationId(value: unknown): value is string {
  return typeof value === 'string' && APPLICATION_ID_PATTERN.test(value);
}

/** Whether a value is one of the four environments of contract §10. */
export function isValidEnvironment(value: unknown): boolean {
  return typeof value === 'string' && ENVIRONMENT_SET.has(value);
}

/**
 * A permissive IPv4/IPv6 check.
 *
 * Deliberately shape-only. `inet` in Postgres is the authority and will refuse
 * what this lets through; the purpose here is to catch a hostname, a
 * `x-forwarded-for` list, or the string "unknown" — the three things that
 * actually arrive in this field — before they cause a type error at the
 * boundary.
 */
function isIpAddress(value: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  // IPv6, including the compressed and IPv4-mapped forms.
  return /^[0-9a-f:]{2,45}$/i.test(value) && value.includes(':');
}

/**
 * The event as it goes on the wire.
 *
 * Normalizes `occurred_at` to an ISO string, defaults metadata to an empty
 * object, drops `undefined` keys so they do not serialize to `null`, and
 * stamps the contract version (§44).
 *
 * It does NOT set `application_id`, `environment`, `created_at` or `id`. Those
 * are the server's (contract §12, §8.3), and a client that filled them in
 * would be making a claim rather than a report.
 */
export function toWirePayload(input: SecurityEventInput): Record<string, unknown> {
  assertValidEvent(input);

  const occurredAt =
    input.occurred_at instanceof Date
      ? input.occurred_at.toISOString()
      : typeof input.occurred_at === 'string'
        ? new Date(input.occurred_at).toISOString()
        : undefined;

  const payload: Record<string, unknown> = {
    event_category: input.event_category,
    event_type: input.event_type,
    event_action: input.event_action,
    severity: input.severity,
    status: input.status,
    metadata: input.metadata ?? {},
    schema_version: SECURITY_EVENT_SCHEMA_VERSION,
  };

  const optional: Record<string, unknown> = {
    occurred_at: occurredAt,
    actor_type: input.actor_type,
    actor_id: input.actor_id,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    session_id: input.session_id,
    request_id: input.request_id,
    correlation_id: input.correlation_id,
    ip_address: input.ip_address,
    user_agent: input.user_agent,
    device_id: input.device_id,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) payload[key] = value;
  }

  return payload;
}
