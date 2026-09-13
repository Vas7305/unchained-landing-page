# Unchained Business

# Security & Audit Event Contract v1.0

**Status:** Normative
**Version:** 1.0.0
**Document Type:** Cross-Application Security and Audit Contract
**Authority:** Unchained Business
**Scope:** All current and future Unchained Business applications
**Primary Consumer:** Unchained Business Admin Platform
**Canonical Administrative Domain:** `www.admin.unchainedbusiness.com`

---

## 1. Purpose

This document defines the canonical **Security & Audit Event Contract** for the Unchained Business ecosystem.

It is the **single source of truth** for how applications generate, store, classify, query, correlate, protect, and expose security and audit events.

All current and future Unchained Business applications MUST conform to this contract when emitting security or audit events.

The contract is designed to:

* provide consistent security observability across applications;
* provide reliable administrative auditing;
* enable cross-application event correlation;
* support future SIEM integration without redesigning the event model;
* preserve event integrity;
* enforce application-level isolation;
* support centralized monitoring through the Unchained Business Admin Platform;
* minimize unnecessary sensitive-data collection;
* remain independent of any specific frontend framework, backend framework, or infrastructure provider.

---

# 2. Architectural Principle

The Security & Audit system is a **shared Unchained Business capability**, not a feature belonging exclusively to the Admin Panel frontend.

The architecture MUST follow this principle:

```text
Application
    |
    v
Security & Audit Core
    |
    +---- Event Store
    |
    +---- Detection
    |
    +---- Alerts
    |
    v
Unchained Business Admin Platform
```

The Admin Platform is the primary **management, investigation, and visualization interface**.

Applications MUST NOT depend on the Admin Panel frontend to record events.

The following architecture is explicitly prohibited:

```text
Application
    |
    v
Admin Panel Frontend
    |
    v
Audit Database
```

Applications SHOULD communicate with the Security & Audit Core through a secure backend/API/RPC mechanism.

---

# 3. Design Goals

The implementation MUST prioritize:

1. Integrity
2. Security
3. Application isolation
4. Traceability
5. Correlation
6. Privacy
7. Reliability
8. Queryability
9. Extensibility
10. SIEM readiness

The implementation MUST NOT optimize for feature quantity at the expense of these principles.

---

# 4. Non-Goals

Version 1.0 is NOT a full SIEM.

The system does not attempt to replace:

* EDR;
* antivirus;
* firewall;
* IDS/IPS;
* vulnerability scanners;
* dedicated SIEM platforms;
* full SOC infrastructure.

The system provides the event foundation required for those systems to consume Unchained Business security telemetry in the future.

---

# 5. Canonical Terminology

## 5.1 Audit Event

An event describing a meaningful action performed by a user, administrator, service, or system.

Examples:

```text
ADMIN_UPDATED_STORE
PRODUCT_DELETED
CONTENT_PUBLISHED
ROLE_CHANGED
ORDER_CANCELLED
```

## 5.2 Security Event

An event representing authentication, authorization, suspicious activity, policy violation, security control activation, or another security-relevant condition.

Examples:

```text
AUTH_LOGIN_FAILED
AUTH_PERMISSION_DENIED
SECURITY_RATE_LIMIT_TRIGGERED
SECURITY_SUSPICIOUS_ACTIVITY
SECURITY_ACCOUNT_LOCKED
```

## 5.3 Security & Audit Event

The generic event envelope capable of representing either an audit or security event.

All events MUST use the canonical event model defined below.

---

# 6. Event Lifecycle

Every event follows this conceptual lifecycle:

```text
ACTION / CONDITION
       |
       v
EVENT CREATED
       |
       v
VALIDATED
       |
       v
PERSISTED
       |
       +-------------------+
       |                   |
       v                   v
  AUDIT VIEW          SECURITY ENGINE
                           |
                           v
                       ALERT
```

The original event MUST remain immutable.

Detection and alerts MUST NOT modify the original event.

---

# 7. Canonical Event Model

The canonical event MUST contain the following fields.

```text
id
occurred_at
created_at

application_id
environment

event_category
event_type
event_action

severity
status

actor_type
actor_id

resource_type
resource_id

session_id
request_id
correlation_id

ip_address
user_agent
device_id

metadata
```

Fields may be nullable where explicitly permitted by this contract.

---

# 8. Field Definitions

## 8.1 `id`

Type:

```text
UUID
```

Purpose:

Globally unique identifier for the persisted event.

Requirements:

* MUST be unique.
* MUST NOT be reused.
* MUST remain immutable.
* SHOULD use UUID v4 or another cryptographically appropriate UUID strategy.

---

## 8.2 `occurred_at`

Type:

```text
TIMESTAMPTZ
```

Purpose:

Timestamp at which the underlying action or condition occurred.

Requirements:

* MUST use UTC.
* MUST represent the event occurrence time, not merely database insertion time.

---

## 8.3 `created_at`

Type:

```text
TIMESTAMPTZ
```

Purpose:

Timestamp at which the event was persisted by the Security & Audit Core.

Requirements:

* MUST use UTC.
* MUST be generated server-side.
* MUST NOT rely exclusively on client-provided timestamps.

---

# 9. Application Identification

## 9.1 `application_id`

Type:

```text
TEXT
```

This identifies the application that generated the event.

Initial canonical identifiers:

```text
tancerca
frito
unchained
```

Future applications MUST receive their own stable identifier.

Application identifiers MUST be:

* unique;
* lowercase;
* stable;
* independent from display names.

Example:

```text
application_id = "tancerca"
```

NOT:

```text
application_id = "TanCerca Marketplace Production"
```

---

# 10. Environment

## 10.1 `environment`

Allowed values:

```text
development
staging
production
test
```

Production events MUST NEVER be silently mixed with development or test events.

The Admin Platform MUST allow filtering by environment.

---

# 11. Event Classification

## 11.1 `event_category`

Version 1.0 defines the following canonical categories:

```text
AUTHENTICATION
AUTHORIZATION
ACCOUNT
SESSION
ADMINISTRATION
DATA
PAYMENT
FINANCIAL
ORDER
SECURITY
API
SYSTEM
CONTENT
COMMUNICATION
LOCATION
DEVICE
```

Applications MUST reuse existing categories whenever applicable.

Applications MUST NOT create arbitrary categories without updating this contract.

---

# 12. Event Type and Action

The contract separates:

```text
event_type
event_action
```

### `event_type`

Identifies the semantic event family.

Example:

```text
AUTH
PAYMENT
ORDER
ACCOUNT
```

### `event_action`

Identifies the specific operation.

Example:

```text
LOGIN_SUCCESS
LOGIN_FAILED
PASSWORD_CHANGED
PAYMENT_CREATED
PAYMENT_COMPLETED
ORDER_CREATED
ORDER_CANCELLED
```

The combination:

```text
event_category
event_type
event_action
```

MUST uniquely describe the meaning of the event.

---

# 13. Canonical Event Actions

The following actions are reserved for Version 1.0.

## Authentication

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
PASSWORD_CHANGED
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED
MFA_ENABLED
MFA_DISABLED
SESSION_EXPIRED
```

## Authorization

```text
PERMISSION_GRANTED
PERMISSION_DENIED
ROLE_ASSIGNED
ROLE_REMOVED
ROLE_CHANGED
```

## Account

```text
ACCOUNT_CREATED
ACCOUNT_UPDATED
ACCOUNT_SUSPENDED
ACCOUNT_REACTIVATED
ACCOUNT_DELETED
ACCOUNT_LOCKED
```

## Administration

```text
ADMIN_ACTION
ADMIN_LOGIN
ADMIN_LOGOUT
ADMIN_CONFIGURATION_CHANGED
```

## Data

```text
DATA_CREATED
DATA_UPDATED
DATA_DELETED
DATA_EXPORTED
DATA_IMPORTED
```

## Payment

```text
PAYMENT_CREATED
PAYMENT_PENDING
PAYMENT_COMPLETED
PAYMENT_FAILED
PAYMENT_CANCELLED
PAYMENT_REFUNDED
```

## Order

```text
ORDER_CREATED
ORDER_UPDATED
ORDER_CANCELLED
ORDER_COMPLETED
ORDER_EXPIRED
```

## Security

```text
SUSPICIOUS_ACTIVITY
RATE_LIMIT_TRIGGERED
ACCOUNT_LOCKED
CREDENTIAL_COMPROMISE
TOKEN_REUSE_DETECTED
UNUSUAL_ACTIVITY
SECURITY_POLICY_VIOLATION
```

## System

```text
SYSTEM_ERROR
SYSTEM_WARNING
SYSTEM_CONFIGURATION_CHANGED
SERVICE_STARTED
SERVICE_STOPPED
```

Applications MAY define additional actions only when the existing catalog cannot accurately represent the event.

---

# 14. Severity

Allowed values:

```text
INFO
LOW
MEDIUM
HIGH
CRITICAL
```

Guidelines:

### INFO

Normal operational activity.

Example:

```text
LOGIN_SUCCESS
```

### LOW

Minor security-relevant or unusual activity.

Example:

```text
LOGIN_FAILED
```

### MEDIUM

Potentially meaningful suspicious activity.

Example:

```text
RATE_LIMIT_TRIGGERED
```

### HIGH

Likely security incident or privileged-risk event.

Example:

```text
ROLE_CHANGED
```

when unexpected or suspicious.

### CRITICAL

Potentially severe compromise or high-impact security event.

Example:

```text
CREDENTIAL_COMPROMISE
```

Severity MUST represent the significance of the specific event.

---

# 15. Status

Allowed values:

```text
SUCCESS
FAILURE
PENDING
BLOCKED
DENIED
DETECTED
```

Status describes the result or state of the event.

Example:

```text
event_action = LOGIN
status = FAILURE
```

---

# 16. Actor Model

## 16.1 `actor_type`

Allowed values:

```text
USER
ADMIN
SYSTEM
SERVICE
API
ANONYMOUS
```

## 16.2 `actor_id`

The identifier of the actor when one exists.

Requirements:

* MUST be null when no identifiable actor exists.
* MUST NOT contain email addresses unless explicitly required by an approved security use case.
* SHOULD reference the stable internal user identifier.

Example:

```text
actor_type = USER
actor_id = "UUID"
```

System-generated event:

```text
actor_type = SYSTEM
actor_id = NULL
```

---

# 17. Resource Model

## 17.1 `resource_type`

Identifies the affected resource.

Examples:

```text
USER
STORE
PRODUCT
ORDER
PAYMENT
DELIVERY
DRIVER
SESSION
CONTENT
ROLE
SYSTEM_CONFIGURATION
```

## 17.2 `resource_id`

Identifies the affected resource.

The value SHOULD be the stable internal identifier.

---

# 18. Correlation

## 18.1 `correlation_id`

A UUID identifying a logical business or security operation spanning multiple events.

Example:

```text
ORDER_CREATED
PAYMENT_CREATED
PAYMENT_COMPLETED
INVOICE_CREATED
DELIVERY_CREATED
```

All may share:

```text
correlation_id = UUID
```

The Admin Platform MUST support investigation by correlation ID.

---

# 19. Request Identification

## 19.1 `request_id`

Identifies the individual API or service request responsible for the event.

Example:

```text
HTTP Request
    |
request_id
    |
API
    |
Database
    |
Security Event
```

This allows event-level tracing into application logs.

---

# 20. Session Identification

## 20.1 `session_id`

Identifies the authenticated session when applicable.

Requirements:

* MUST NOT contain raw authentication tokens.
* MUST NOT contain passwords.
* MUST NOT contain refresh tokens.
* SHOULD use an opaque session identifier.

---

# 21. Device Identification

## 21.1 `device_id`

May identify the logical device associated with the event.

Requirements:

* MUST NOT contain unnecessary personally identifying information.
* SHOULD use an application-generated or provider-generated opaque identifier.
* MUST NOT store raw hardware identifiers unless explicitly justified.

---

# 22. Network Information

## 22.1 `ip_address`

The originating IP address when available.

Requirements:

* MUST be handled as potentially sensitive data.
* MUST be subject to retention policies.
* MUST NOT be exposed to administrators who do not have the appropriate authorization.

---

# 23. User Agent

## 23.1 `user_agent`

The client user-agent string when available.

Purpose:

Security investigation, device identification, and troubleshooting.

Applications SHOULD avoid storing unnecessarily large or duplicated user-agent data.

---

# 24. Metadata

## 24.1 `metadata`

Type:

```text
JSONB
```

Purpose:

Event-specific structured information.

Example:

```json
{
  "old_plan": "pro",
  "new_plan": "premium"
}
```

Metadata MUST:

* contain structured data;
* contain only information relevant to the event;
* avoid unnecessary personal data;
* avoid secrets;
* avoid authentication credentials;
* avoid full database records.

The following MUST NEVER be stored in metadata:

```text
passwords
access tokens
refresh tokens
API keys
private keys
payment card numbers
authentication secrets
```

---

# 25. Sensitive Data Minimization

The Security & Audit system MUST follow data minimization.

Do not log data simply because it is technically available.

The default rule is:

> Log enough information to reconstruct and investigate the event, but not enough to unnecessarily reproduce the underlying private data.

Examples:

GOOD:

```json
{
  "amount": 1500,
  "currency": "CUP"
}
```

Potentially BAD:

```json
{
  "entire_user_record": "...",
  "entire_payment_record": "..."
}
```

---

# 26. Event Immutability

Persisted events are append-only.

After creation:

```text
UPDATE security_events
DELETE security_events
```

MUST NOT be available through normal application or Admin Panel operations.

If an event requires correction, create a new event:

```text
EVENT_CORRECTION
```

The original event MUST remain intact.

---

# 27. Database Security

The Security & Audit storage layer MUST enforce authorization independently from the frontend.

Frontend visibility controls are NOT security controls.

Database/API authorization MUST guarantee application isolation.

---

# 28. Application Isolation

An application MUST only be able to create and access events within its authorized scope.

Example:

```text
TanCerca
    |
    +--> TanCerca events

Frito
    |
    +--> Frito events
```

Cross-application access MUST require explicit elevated authorization.

The Unchained Business Super Admin role MAY access cross-application security information.

Application isolation MUST be enforced server-side.

---

# 29. Admin Access Model

The Admin Platform MUST distinguish at minimum:

```text
APPLICATION_ADMIN
SECURITY_ADMIN
SUPER_ADMIN
```

### APPLICATION_ADMIN

May inspect events belonging to their authorized application.

### SECURITY_ADMIN

May investigate security events across authorized applications.

### SUPER_ADMIN

May access the entire Unchained Business security domain.

The exact role hierarchy may evolve, but cross-application visibility MUST never be granted simply because a user can access the Admin Panel.

---

# 30. Security Alerts

Events and alerts are different entities.

An event represents what happened.

An alert represents a condition requiring attention.

Conceptually:

```text
security_events
       |
       v
detection rules
       |
       v
security_alerts
```

A single alert MAY reference multiple events.

Example:

```text
5 LOGIN_FAILED events
        |
        v
BRUTE_FORCE_DETECTED
        |
        v
HIGH security alert
```

---

# 31. Detection Rules

Version 1.0 SHOULD support configurable detection rules.

Example:

```text
RULE:
LOGIN_FAILED >= 5
within 5 minutes
same actor
        |
        v
SECURITY ALERT
```

Rules MUST NOT modify original events.

Rules SHOULD reference event IDs that caused the alert.

---

# 32. Event Integrity

The system SHOULD support integrity verification for high-value security events.

Future-compatible fields may include:

```text
event_hash
previous_event_hash
integrity_version
```

Version 1.0 does not require blockchain or external notarization.

Do not introduce cryptographic complexity without a concrete threat model.

---

# 33. Reliability

Security event recording SHOULD NOT silently disappear because an application experiences a transient error.

For critical security operations:

* event persistence SHOULD be treated as a first-class operation;
* failures SHOULD be observable;
* event ingestion failures SHOULD generate operational alerts.

However, security logging MUST NOT cause uncontrolled cascading failures across the application ecosystem.

The implementation MUST define safe failure behavior per event class.

---

# 34. Performance

Security logging MUST NOT unnecessarily block normal application operations.

The implementation MAY use:

* asynchronous event delivery;
* queues;
* batched ingestion;
* background processing.

However, security-critical events that must be immediately persisted MUST be explicitly classified.

Do not make every event synchronous by default.

---

# 35. Retention

Retention MUST be configurable.

Retention MAY vary by:

```text
application
event_category
severity
environment
```

Example conceptual policy:

```text
CRITICAL → long retention
HIGH     → long retention
MEDIUM   → configurable
LOW      → configurable
INFO     → shorter retention
```

Exact retention periods are intentionally NOT fixed by this contract.

They must be defined according to:

* business requirements;
* storage costs;
* security requirements;
* applicable legal requirements.

---

# 36. Privacy

The Security & Audit layer MUST respect applicable privacy requirements.

Particular attention MUST be paid to:

```text
IP addresses
location information
communication metadata
device identifiers
user identifiers
financial information
```

Security logging does not automatically justify unlimited retention or unrestricted access.

---

# 37. Admin Panel Requirements

The Unchained Business Admin Platform MUST eventually expose:

```text
Security
├── Overview
├── Events
├── Alerts
├── Detection Rules
├── Sessions
└── Security Metrics

Audit
├── Activity
├── Administrative Actions
└── Data Changes
```

The interface MUST support filtering by:

```text
application
environment
category
event type
action
severity
status
actor
resource
date range
correlation_id
request_id
```

---

# 38. Event Investigation

Administrators SHOULD be able to navigate:

```text
Event
  |
  +-- Actor
  |
  +-- Resource
  |
  +-- Session
  |
  +-- Request
  |
  +-- Correlation
  |
  +-- Related Events
  |
  +-- Related Alerts
```

This is a core requirement for useful security observability.

---

# 39. SIEM Compatibility

The schema MUST remain exportable to future SIEM platforms.

The implementation MUST NOT couple the internal event model to a specific vendor.

Future integrations may transform:

```text
Unchained Security Event
        |
        v
SIEM Adapter
        |
        v
External SIEM
```

Possible future targets include:

```text
Microsoft Sentinel
Splunk
Elastic Security
Google Security Operations
```

No SIEM vendor is mandated by Version 1.0.

---

# 40. API Contract

The Security Core SHOULD expose operations conceptually equivalent to:

```text
POST   /security/events
GET    /security/events
GET    /security/events/:id

GET    /security/alerts
GET    /security/alerts/:id

GET    /security/applications

GET    /security/events/:id/related
GET    /security/correlations/:id
```

Exact routing is an implementation detail.

The semantic contract is not.

---

# 41. Event Ingestion Rules

Applications MUST:

1. authenticate with the Security Core;
2. identify themselves using `application_id`;
3. provide valid event classification;
4. provide actor information when available;
5. provide resource information when applicable;
6. provide `request_id` when available;
7. provide `correlation_id` for multi-event operations;
8. avoid sensitive data leakage;
9. never send credentials or secrets;
10. respect environment boundaries.

---

# 42. Prohibited Practices

The following are prohibited:

### 42.1 Client-only auditing

Do not rely exclusively on frontend code.

### 42.2 Editable audit history

Do not allow normal users or administrators to modify persisted events.

### 42.3 Logging secrets

Never log:

```text
passwords
tokens
API keys
private keys
authentication secrets
```

### 42.4 Full-record logging

Do not store entire database records as event metadata.

### 42.5 Frontend-only authorization

Do not rely on hidden menus or routes to enforce application isolation.

### 42.6 Vendor lock-in

Do not design the internal schema around a specific SIEM vendor.

### 42.7 Arbitrary event taxonomies

Applications must not create inconsistent event categories without updating the canonical contract.

---

# 43. Example Events

## 43.1 Successful Login

```json
{
  "application_id": "tancerca",
  "environment": "production",
  "event_category": "AUTHENTICATION",
  "event_type": "AUTH",
  "event_action": "LOGIN_SUCCESS",
  "severity": "INFO",
  "status": "SUCCESS",
  "actor_type": "USER",
  "actor_id": "USER_UUID",
  "resource_type": "SESSION",
  "resource_id": "SESSION_UUID",
  "session_id": "SESSION_UUID",
  "request_id": "REQUEST_ID",
  "correlation_id": "CORRELATION_UUID",
  "metadata": {}
}
```

---

## 43.2 Failed Login

```json
{
  "application_id": "frito",
  "environment": "production",
  "event_category": "AUTHENTICATION",
  "event_type": "AUTH",
  "event_action": "LOGIN_FAILED",
  "severity": "LOW",
  "status": "FAILURE",
  "actor_type": "ANONYMOUS",
  "actor_id": null,
  "resource_type": "ACCOUNT",
  "resource_id": "ACCOUNT_UUID",
  "metadata": {
    "reason": "INVALID_CREDENTIALS"
  }
}
```

---

## 43.3 Administrative Plan Change

```json
{
  "application_id": "tancerca",
  "environment": "production",
  "event_category": "ADMINISTRATION",
  "event_type": "STORE",
  "event_action": "ADMIN_CONFIGURATION_CHANGED",
  "severity": "HIGH",
  "status": "SUCCESS",
  "actor_type": "ADMIN",
  "actor_id": "ADMIN_UUID",
  "resource_type": "STORE",
  "resource_id": "STORE_UUID",
  "metadata": {
    "setting": "subscription_plan",
    "old_value": "PRO",
    "new_value": "PREMIUM"
  }
}
```

---

## 43.4 Suspicious Activity

```json
{
  "application_id": "frito",
  "environment": "production",
  "event_category": "SECURITY",
  "event_type": "SECURITY",
  "event_action": "SUSPICIOUS_ACTIVITY",
  "severity": "HIGH",
  "status": "DETECTED",
  "actor_type": "USER",
  "actor_id": "USER_UUID",
  "resource_type": "ACCOUNT",
  "resource_id": "ACCOUNT_UUID",
  "metadata": {
    "detection": "UNUSUAL_REQUEST_RATE",
    "threshold": 100,
    "observed": 428
  }
}
```

---

# 44. Versioning

This contract follows semantic versioning:

```text
MAJOR.MINOR.PATCH
```

### MAJOR

Breaking schema or semantic changes.

### MINOR

Backward-compatible additions.

### PATCH

Clarifications, corrections, or non-breaking changes.

Applications MUST declare the contract version they implement.

Example:

```text
security_event_schema_version = "1.0"
```

---

# 45. Backward Compatibility

Changes MUST NOT silently alter the meaning of existing event types.

Deprecated event types MUST remain recognizable during the supported migration period.

Applications MUST NOT interpret a newer event contract as an older contract without explicit compatibility logic.

---

# 46. Source of Truth

This document is the canonical authority for the Security & Audit Event Contract.

If implementation code, documentation, generated code, or application-specific assumptions conflict with this document:

```text
THIS CONTRACT WINS.
```

Any intentional deviation MUST be explicitly documented and approved before implementation.

---

# 47. Implementation Boundary

This contract defines **what the Security & Audit system means**.

It does not mandate:

* a specific frontend framework;
* a specific backend framework;
* a specific database provider;
* a specific queue;
* a specific cloud provider;
* a specific SIEM;
* a specific logging library.

Implementation details MUST remain replaceable wherever practical.

---

# 48. Unchained Business Reference Architecture

The intended architecture is:

```text
                    UNCHAINED BUSINESS
                           |
                  Security & Audit Core
                           |
          ┌────────────────┼────────────────┐
          |                |                |
      TanCerca           Frito          Unchained
          |                |                |
          └────────────────┼────────────────┘
                           |
                     Event Storage
                           |
                ┌──────────┴──────────┐
                |                     |
             Alerts               Audit
                |                     |
                └──────────┬──────────┘
                           |
                  Admin Platform
                           |
             www.admin.unchainedbusiness.com
                           |
                    Future SIEM
```

The Security Core is shared infrastructure.

The Admin Platform is its primary administrative interface.

Applications remain logically independent.

---

# 49. Implementation Priority

Implementation MUST proceed in this order:

### Phase A — Contract

Implement:

* canonical event model;
* enumerations;
* application registry;
* validation rules;
* security boundaries.

### Phase B — Storage

Implement:

* event storage;
* indexes;
* immutability;
* RLS/access controls;
* retention foundation.

### Phase C — Ingestion

Implement:

* secure event ingestion;
* application authentication;
* server-side validation;
* request/correlation tracking.

### Phase D — Admin

Implement:

* event explorer;
* filtering;
* event details;
* correlation investigation;
* application isolation.

### Phase E — Detection

Implement:

* detection rules;
* security alerts;
* alert lifecycle.

### Phase F — Integrations

Only after the foundation is stable:

* external SIEM export;
* advanced observability;
* automated response;
* additional security providers.

---

# 50. Critical Engineering Rule

Do not implement speculative security infrastructure merely because this contract allows it.

Version 1.0 establishes the foundation.

Implement only the capabilities required by the current threat model and operational requirements.

The architecture MUST remain extensible without forcing premature complexity.

---

# 51. Final Contract Statement

The Unchained Business Security & Audit system is an ecosystem-wide capability.

Every application is responsible for emitting accurate events.

The Security Core is responsible for validating, persisting, protecting, correlating, and exposing those events.

The Admin Platform is responsible for providing authorized human operators with visibility and control.

Original events are immutable.

Application boundaries are enforced server-side.

Sensitive information is minimized.

The system remains vendor-neutral and SIEM-ready.

The goal is not to build a SIEM prematurely.

The goal is to ensure that when Unchained Business eventually requires one, its applications already speak a consistent security language.

**This document is the canonical Security Event Contract v1.0 and MUST be treated as the single source of truth for implementation.**
