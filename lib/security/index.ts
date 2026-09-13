/**
 * The Unchained Security & Audit Core — client contract.
 *
 * The public surface an Unchained application imports. Everything here is
 * dependency-free, side-effect-free and transport-agnostic, so it can be
 * consumed by the Next.js site under this tsconfig, by Vitest, and — by copy,
 * since Deno cannot resolve `@/lib` — by an edge function.
 *
 * Canonical contract: `docs/security/SECURITY_EVENT_CONTRACT_V1.md`.
 * Implementation guide: `docs/security-core.md`.
 *
 * Nothing in this module is a security control. The enforcement is in the
 * database — see the header of `contract.ts` for why both halves exist and
 * which one decides.
 */

export {
  ACTOR_TYPES,
  CANONICAL_ACTIONS,
  ENVIRONMENTS,
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  METADATA_MAX_BYTES,
  SECURITY_EVENT_SCHEMA_VERSION,
  SEVERITIES,
  isCanonicalAction,
  type ActorType,
  type CanonicalAction,
  type Environment,
  type EventCategory,
  type EventMetadata,
  type EventStatus,
  type SecurityEvent,
  type SecurityEventInput,
  type Severity,
} from './contract';

export {
  EventValidationError,
  assertValidEvent,
  isValidApplicationId,
  isValidEnvironment,
  toWirePayload,
  validateEvent,
  type ValidationIssue,
} from './validate';

export {
  REDACTED,
  SecretInMetadataError,
  assertNoSecrets,
  isMetadataWithinLimit,
  metadataByteLength,
  redactSecrets,
  scanForSecrets,
  type SecretFinding,
} from './secrets';

export {
  SecurityEventClient,
  createHttpTransport,
  type IngestResult,
  type SecurityEventClientOptions,
  type SecurityEventTransport,
} from './client';
