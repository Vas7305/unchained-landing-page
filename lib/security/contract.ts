/**
 * The Unchained Business Security & Audit Event Contract, as types.
 *
 * ─── What this module is ──────────────────────────────────────────────────
 * The canonical event vocabulary of `docs/security/SECURITY_EVENT_CONTRACT_V1.md`,
 * expressed once, in TypeScript, so that every Unchained application builds
 * events from the same enumerations rather than from string literals that
 * agree by coincidence until they do not.
 *
 * It is the CONTRACT, not the enforcement. The enforcement is in the database
 * — `security_ingest_event()` re-validates every field of every event it is
 * handed, and the CHECK constraints on `public.security_events` refuse an
 * invalid row even if that function is bypassed. That boundary is deliberate
 * and is stated here because a reader who finds validation in two places is
 * owed the reason:
 *
 *   · this module runs in the APPLICATION, before the event is sent. It
 *     catches mistakes where they are cheap to fix, in the caller's own types,
 *     and it lets an application reject its own malformed event without a
 *     round trip.
 *   · the database runs at the BOUNDARY, after the event arrives. It is the
 *     only one of the two that a hostile or buggy caller cannot skip.
 *
 * A client-side validator that the server trusted would be theatre (contract
 * §42.1, §42.5). A server-side validator with no client-side counterpart would
 * be correct and would make every integration mistake a production round trip.
 * Both exist; only one of them is a security control.
 *
 * ─── Why this file has no imports ─────────────────────────────────────────
 * It is consumed by the Next.js site under this tsconfig, by Vitest, and — by
 * copy, since Deno cannot resolve `@/lib` — by the edge function. Keeping it
 * dependency-free and side-effect-free is what makes that possible, and is why
 * nothing here reads an environment variable or touches a network client.
 *
 * The canonical contract is the Markdown document. Where this file and that
 * document disagree, the document wins and this file is the defect.
 */

/** The contract version every event produced by this module declares. */
export const SECURITY_EVENT_SCHEMA_VERSION = '1.0' as const;

// ─── Environments (contract §10) ────────────────────────────────────────────
// Production events must never be silently mixed with development or test
// events, which is why this is a closed set and not a free string.

export const ENVIRONMENTS = ['development', 'staging', 'production', 'test'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

// ─── Categories (contract §11.1) ────────────────────────────────────────────
// The sixteen canonical categories. An application that cannot express its
// event with one of these is not permitted to invent a seventeenth: the
// contract is amended first, then this list, then the database's CHECK.

export const EVENT_CATEGORIES = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'ACCOUNT',
  'SESSION',
  'ADMINISTRATION',
  'DATA',
  'PAYMENT',
  'FINANCIAL',
  'ORDER',
  'SECURITY',
  'API',
  'SYSTEM',
  'CONTENT',
  'COMMUNICATION',
  'LOCATION',
  'DEVICE',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// ─── Severity (contract §14) ────────────────────────────────────────────────

export const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

// ─── Status (contract §15) ──────────────────────────────────────────────────

export const EVENT_STATUSES = [
  'SUCCESS',
  'FAILURE',
  'PENDING',
  'BLOCKED',
  'DENIED',
  'DETECTED',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// ─── Actor (contract §16.1) ─────────────────────────────────────────────────

export const ACTOR_TYPES = ['USER', 'ADMIN', 'SYSTEM', 'SERVICE', 'API', 'ANONYMOUS'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/**
 * The actor types for which `actor_id` must be absent.
 *
 * Contract §16.2: an event with no identifiable actor carries a null id. An
 * ANONYMOUS event that names an actor is a contradiction — if the actor is
 * known the event is not anonymous — and it is usually a caller putting an
 * email address or an IP into the field, which §16.2 also forbids.
 */
export const ACTORLESS_TYPES: readonly ActorType[] = ['ANONYMOUS'];

// ─── Canonical actions (contract §13) ───────────────────────────────────────
// Reserved for v1.0. §13 permits an application to define an action outside
// this catalogue only when nothing here can accurately represent the event,
// so the set is exported for that judgement to be made against, and
// `isCanonicalAction()` below is what a caller checks rather than hard-coding
// its own copy.

export const CANONICAL_ACTIONS = [
  // Authentication
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'SESSION_EXPIRED',
  // Authorization
  'PERMISSION_GRANTED',
  'PERMISSION_DENIED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'ROLE_CHANGED',
  // Account
  'ACCOUNT_CREATED',
  'ACCOUNT_UPDATED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'ACCOUNT_DELETED',
  'ACCOUNT_LOCKED',
  // Administration
  'ADMIN_ACTION',
  'ADMIN_LOGIN',
  'ADMIN_LOGOUT',
  'ADMIN_CONFIGURATION_CHANGED',
  // Data
  'DATA_CREATED',
  'DATA_UPDATED',
  'DATA_DELETED',
  'DATA_EXPORTED',
  'DATA_IMPORTED',
  // Payment
  'PAYMENT_CREATED',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'PAYMENT_CANCELLED',
  'PAYMENT_REFUNDED',
  // Order
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'ORDER_CANCELLED',
  'ORDER_COMPLETED',
  'ORDER_EXPIRED',
  // Security
  'SUSPICIOUS_ACTIVITY',
  'RATE_LIMIT_TRIGGERED',
  'CREDENTIAL_COMPROMISE',
  'TOKEN_REUSE_DETECTED',
  'UNUSUAL_ACTIVITY',
  'SECURITY_POLICY_VIOLATION',
  // System
  'SYSTEM_ERROR',
  'SYSTEM_WARNING',
  'SYSTEM_CONFIGURATION_CHANGED',
  'SERVICE_STARTED',
  'SERVICE_STOPPED',
  // Correction (contract §26). The only way to amend a persisted event.
  'EVENT_CORRECTION',
] as const;
export type CanonicalAction = (typeof CANONICAL_ACTIONS)[number];

const CANONICAL_ACTION_SET: ReadonlySet<string> = new Set(CANONICAL_ACTIONS);

/**
 * Whether an action is one the contract reserves.
 *
 * A `false` answer is not an error. §13 allows an application-specific action
 * where the catalogue cannot express the event; what it does not allow is an
 * application inventing one *casually*, so this exists to make the choice
 * visible at the call site rather than to forbid it.
 *
 * Note that `ACCOUNT_LOCKED` appears under both Account and Security in §13.
 * It is one action with one spelling, and the category it carries is what
 * distinguishes an administrative lock from a detected one.
 */
export function isCanonicalAction(action: string): action is CanonicalAction {
  return CANONICAL_ACTION_SET.has(action);
}

// ─── Shape rules ────────────────────────────────────────────────────────────
// Identifiers are SCREAMING_SNAKE, applications are lowercase slugs. Both are
// mirrored by CHECK constraints on public.security_events; the regexes are
// duplicated across the two languages because there is no way not to, and the
// SQL is the one that decides.

/** `event_category`, `event_type`, `event_action`, `actor_type`, `resource_type`. */
export const SYMBOL_PATTERN = /^[A-Z][A-Z0-9_]{1,60}$/;

/** `application_id` — lowercase, stable, hyphens allowed (contract §9.1). */
export const APPLICATION_ID_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;

/** RFC 4122 in any version, which is what `uuid` accepts in Postgres. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The ceiling on a serialized `metadata` object, in bytes of UTF-8.
 *
 * Contract §24 and §42.4: metadata carries what is needed to reconstruct the
 * event, not the record the event happened to. 16 KiB is comfortably more than
 * any legitimate event in this catalogue needs and comfortably less than a
 * dumped row, which is exactly the line the limit is trying to draw. It is
 * enforced again in `security_ingest_event()`, in the same units.
 */
export const METADATA_MAX_BYTES = 16 * 1024;

/** How deep a metadata object may nest. Deeper is a serialized object graph. */
export const METADATA_MAX_DEPTH = 6;

/** The ceiling on a stored user-agent string (contract §23). */
export const USER_AGENT_MAX_LENGTH = 1024;

// ─── The canonical event ────────────────────────────────────────────────────

/**
 * A `metadata` value, as the contract permits it.
 *
 * JSON, and deliberately not `unknown`: metadata is structured data that has
 * to survive `JSON.stringify` and land in a `jsonb` column, and a type that
 * admitted a `Date`, a `Map` or a class instance would be describing something
 * the column cannot store.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type EventMetadata = Readonly<Record<string, JsonValue>>;

/**
 * What an application supplies when it emits an event.
 *
 * ─── What is NOT in this type, and why ───────────────────────────────────
 * `id`, `created_at`, and — in most cases — `actor_id`, `actor_type` and
 * `session_id` are absent because contract §12 and the implementation's §12
 * make them server-controlled. An application cannot set them, so the type
 * does not invite it to try. The server derives them from the authenticated
 * context and overwrites anything that arrives in their place.
 *
 * `application_id` and `environment` are likewise absent: both are properties
 * of the CREDENTIAL the event arrives under, not claims the payload makes.
 * An application that could name its own `application_id` could write events
 * into another application's history, which is the isolation boundary of
 * contract §28.
 */
export interface SecurityEventInput {
  /** When the action or condition happened. Defaults to now at the server. */
  readonly occurred_at?: string | Date;

  readonly event_category: EventCategory;
  /** The semantic family — `AUTH`, `PAYMENT`, `ORDER` (contract §12). */
  readonly event_type: string;
  /** The specific operation. Prefer a `CanonicalAction` (contract §13). */
  readonly event_action: string;

  readonly severity: Severity;
  readonly status: EventStatus;

  /**
   * Who acted, when the application knows better than the session does.
   *
   * A service-to-service event has no session and must say `SERVICE`; an
   * anonymous failed login must say `ANONYMOUS`. Where the Core can derive the
   * actor from an authenticated session it does, and what it derives wins.
   */
  readonly actor_type?: ActorType;
  readonly actor_id?: string | null;

  readonly resource_type?: string | null;
  readonly resource_id?: string | null;

  readonly session_id?: string | null;
  readonly request_id?: string | null;
  /** Shared by every event of one logical operation (contract §18). */
  readonly correlation_id?: string | null;

  readonly ip_address?: string | null;
  readonly user_agent?: string | null;
  readonly device_id?: string | null;

  readonly metadata?: EventMetadata;
}

/**
 * A persisted event, as the Core returns it.
 *
 * `ip_address`, `user_agent` and `device_id` are optional on the way OUT as
 * well as in, and that is not laziness: contract §22 requires that network and
 * device data be withheld from administrators who lack the authorization to
 * see it, so a reader without `SECURITY_EVENT_PII_VIEW` receives the row with
 * those three fields absent. A type that promised them would be lying to every
 * caller that is not a Super Admin.
 */
export interface SecurityEvent {
  readonly id: string;
  readonly occurred_at: string;
  readonly created_at: string;

  readonly application_id: string;
  readonly environment: Environment;

  readonly event_category: EventCategory;
  readonly event_type: string;
  readonly event_action: string;

  readonly severity: Severity;
  readonly status: EventStatus;

  readonly actor_type: ActorType;
  readonly actor_id: string | null;

  readonly resource_type: string | null;
  readonly resource_id: string | null;

  readonly session_id: string | null;
  readonly request_id: string | null;
  readonly correlation_id: string | null;

  readonly ip_address?: string | null;
  readonly user_agent?: string | null;
  readonly device_id?: string | null;

  readonly metadata: EventMetadata;
  readonly schema_version: string;
}
