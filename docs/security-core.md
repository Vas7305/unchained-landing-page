# The Unchained Security & Audit Core

How security and audit events are created, validated, stored, protected,
correlated and read across every Unchained Business property.

The canonical contract is
[`docs/security/SECURITY_EVENT_CONTRACT_V1.md`](security/SECURITY_EVENT_CONTRACT_V1.md).
**That document is the single source of truth.** This one explains how it is
implemented here, and deliberately does not repeat it — where the two disagree,
the contract is right and the implementation is the defect.

A reference for somebody who has to change it, or integrate an application with
it. The reasoning behind each table and function is in the migration itself.

| | |
|---|---|
| **Contract** | `docs/security/SECURITY_EVENT_CONTRACT_V1.md` (normative, v1.0.0) |
| **Schema** | `supabase/migrations/20260914000001_unchained_security_core.sql` (this repo) |
| **Ingestion transport** | `supabase/functions/security-core/` (this repo) |
| **Client contract** | `lib/security/` (this repo) |
| **Tests** | `supabase/tests/security_core_contract.sql`, `lib/security/*.test.ts` |
| **Admin panel** | `D:\Tancerca\admin-panel` → https://www.admin.unchainedbusiness.com |

---

## 1. What it is

A shared capability, not an Admin Panel feature. The architecture is §2 of the
contract:

```text
Application  ──>  Security & Audit Core  ──>  Admin Platform
                          │
                          ├── Event Store
                          ├── Detection
                          └── Alerts
```

An application never talks to the Admin Panel to record an event. It talks to
the Core. The Panel is one of the Core's readers, and the most important one,
but it is not in the path of any write.

## 2. Where each piece lives

The Core is **in Unchained Business's own Supabase project**, next to the
Administration Core it depends on. Every other property keeps its own isolated
project, exactly as [`database-isolation.md`](database-isolation.md) requires —
and for the same reason [`administrator-management.md`](administrator-management.md)
gives for the administrator directory: what isolation removed was a shared
**customer** pool, and what is centralized here is neither customers nor
business data. It is telemetry about administrative and security events, which
is only useful when it can be read in one place.

```text
security_events          the canonical event store (contract §7)
security_alerts          conditions requiring attention (§30)
security_alert_events    which events caused which alert (§31)
security_detection_rules configurable detection (§31)
security_application_keys hashed ingestion credentials (§41)
security_retention_policies the retention foundation (§35) — read by nothing
security_core_settings   the installation's environment (§10)
```

Applications registered in `admin_applications` — the Administration Core's
registry, reused rather than duplicated. `security_events.application_id` is a
foreign key to it.

---

## 3. Three deviations, stated plainly

The contract's §46 requires that any intentional deviation be documented. There
are three, and each is the conservative choice rather than the convenient one.

### 3.1 `unchained` is spelled `unchained-business`

Contract §9.1 names three initial identifiers: `tancerca`, `frito`, `unchained`.
The registry created by `20260913000001` already holds `unchained-business`, in
production, referenced by every administrator row.

§9.1's actual requirement is an identifier that is unique, lowercase, stable and
independent of the display name. `unchained-business` is all four. Minting a
second identifier for the same property would create exactly the instability the
section exists to prevent, so the registry keeps its slug and the Core takes a
foreign key to it.

### 3.2 There is no `SECURITY_ADMIN` role

Contract §29 asks the Admin Platform to distinguish `APPLICATION_ADMIN`,
`SECURITY_ADMIN` and `SUPER_ADMIN`. `20260913000001` §16.3 asserts that
`admin_roles` holds **exactly** the five canonical roles and raises on any
other — a sixth would make an already-applied migration unappliable.

So the three tiers are permissions on the model that already exists:

| Contract tier | How it is held | Scope |
|---|---|---|
| `APPLICATION_ADMIN` | `APP_ADMIN` role → `SECURITY_EVENTS_VIEW` | its own application only |
| `SECURITY_ADMIN` | `SECURITY_EVENTS_VIEW_ALL`, granted per administrator | every application |
| `SUPER_ADMIN` | `public.is_super_admin()` | everything |

The semantics of §29 are delivered exactly. No delegated **role** is mapped to
`SECURITY_EVENTS_VIEW_ALL`, `SECURITY_EVENT_PII_VIEW`, `SECURITY_RULES_MANAGE`,
`SECURITY_ALERTS_MANAGE` or `SECURITY_EVENTS_INGEST`, and the migration asserts
that on apply — so cross-application visibility is always a decision made about
a person, never something that arrives with a job title (§28).

### 3.3 The Admin Panel UI is not in this repository

Contract §37 and the implementation brief's §19 describe a Security & Audit
section of the Admin Panel. **The panel is not here** — it is at
`D:\Tancerca\admin-panel`, and this repository's only frontend is the public
marketing site, which ships the anonymous key and has no authenticated area at
all. Adding an event explorer to it would have been a security regression, not
a feature.

What is built here instead is the whole authorized data surface the panel needs.
§9 below is the integration guide for it.

---

## 4. The event model

Contract §7, as `public.security_events`. Every field of §7 is a column, with
the types §7 of the brief calls for: `uuid`, `timestamptz`, `jsonb`, `inet`.

Two columns are not in §7:

* `schema_version` — required by §44, so a future v2 reader can tell what it is
  holding without guessing.
* `source` — `api` | `rpc` | `admin_core_bridge` | `system`. Not exported to a
  SIEM. It exists because of the legacy bridge in §7 below, and answers the one
  question that decides when that bridge can be retired.

Categories, severities, statuses and actor types are closed sets, enforced by
CHECK constraints. `event_action` is constrained by **shape** rather than
membership, because §13 permits an application-specific action where the
catalogue cannot express the event.

---

## 5. Creating an event

There are exactly two doors, and both end in the same writer.

```text
Application with its own project          Code holding a session here
(TanCerca, Frito)                         (Admin Panel, Unchained server)
        │                                            │
   application key                              auth.uid()
        │                                            │
   POST /security-core                    security_ingest_event(app, event)
        │                                            │
   security_ingest_as_application()                  │
        └──────────────┬─────────────────────────────┘
                       │
              security_write_event()
                       │
          validate → persist → evaluate rules
```

### What the caller never decides

Contract §12 of the brief, enforced in `security_write_event()` and its two
entry points:

| Field | Where it actually comes from |
|---|---|
| `application_id` | the key row, or an authorized permission check |
| `environment` | the key row, or `security_core_environment()` |
| `created_at` | the column default — `now()` |
| `id` | `gen_random_uuid()` |
| `actor_id` / `actor_type` | `auth.uid()` on the session path |

An application key **is** an application and an environment. There is no
parameter by which a caller can name either, so TanCerca's key writes TanCerca
events and can do nothing else, whatever its payload claims. That is the
isolation guarantee of §28, and `supabase/tests/security_core_contract.sql`
section 5 asserts it by sending a payload that claims to be Frito.

### Validation

`security_validate_event()` runs at the boundary and cannot be bypassed. It
rejects unknown categories, invalid severities and statuses, malformed UUIDs,
oversized or over-nested metadata, and metadata carrying credentials — returning
a short code (`invalid_severity`) rather than a sentence, so an integrating
developer learns what to fix and a prober learns nothing about the schema.

`lib/security/validate.ts` is the same ruleset in TypeScript, for applications
to check themselves **before** sending. It is a convenience, not a control. See
the header of `lib/security/contract.ts` for why both exist.

### Sensitive data

Contract §42.3 forbids logging passwords, tokens, API keys, private keys and
card numbers. Detection runs on both keys and values, because a key denylist
alone misses the case that actually happens:

```json
{ "note": "eyJhbGciOi..." }        a JWT under an innocent name
{ "reference": "4242 4242 4242 4242" }   a PAN with spaces in it
```

Keys are matched after normalization, so `access_token`, `accessToken` and
`ACCESS-TOKEN` are one name. Values are matched against the shapes credentials
actually have — PEM blocks, JWTs, vendor-prefixed keys, connection strings — and
card numbers must pass the Luhn checksum, which is what stops the rule firing on
every 16-digit order number and being switched off within a week.

**A detected secret fails the event.** Nothing partial is stored and the caller
is told which field is at fault, never what was in it.

---

## 6. Reading an event

`authenticated` holds **no privilege at all** on `security_events`. Every read
goes through a function:

```sql
security_query_events(...)     -- the event explorer, every filter of §37
security_get_event(id)         -- one event (§38)
security_related_events(id)    -- correlation and request navigation (§18, §38)
security_query_alerts(...)     -- alerts (§30)
security_alert_evidence(id)    -- the events behind an alert (§31)
```

This is not indirection for its own sake. Contract §22 requires that
`ip_address` be withheld from administrators without the authorization to see
it, and a `SELECT` grant cannot express "these rows, minus three columns". The
functions apply row authorization and column redaction together: without
`SECURITY_EVENT_PII_VIEW`, `ip_address`, `user_agent` and `device_id` come back
`NULL`.

Events and alerts are **separate entitlements**, because §30 makes them
separate things: the event functions resolve scope from `SECURITY_EVENTS_VIEW`
and `security_query_alerts` from `SECURITY_ALERTS_VIEW`. An administrator can
hold one without the other. Cross-application access is the exception — a
single elevation, `SECURITY_EVENTS_VIEW_ALL`, covers both, because §28 wants
that elevation rare and visible rather than multiplied per resource.

`security_alert_evidence()` returns the EVENTS behind an alert, so it requires
the events entitlement, not the alerts one.

RLS is still enabled on the table, with the isolation policy in place. It is the
second lock on a door that currently has no handle — if a future migration ever
grants `SELECT`, application isolation survives the mistake.

**Filtering is not the security mechanism.** An application administrator asking
for another application's events receives nothing, not a filtered view of
something they could otherwise reach.

---

## 7. What happened to `admin_logs`

`public.admin_logs` is the pre-existing audit trail, with production data and a
live writer. It was **not** deleted, and it was not left to drift.

* **Overlap** — total in purpose, partial in shape. It records the same
  administrative events, as `(admin_id, action, metadata)` with the envelope
  inside `metadata`. It has no `occurred_at`, no category, no severity column,
  no status, no resource and no correlation, so it cannot answer §37's filters
  or §38's investigation.
* **Decision** — keep it and **adapt** it. `admin_core_log_event()` keeps its
  exact prior behaviour — same signature, same insert, same never-throws
  contract — and gained a mirror into `security_events`, marked
  `source = 'admin_core_bridge'`. Nothing that calls it changed; nothing that
  reads `admin_logs` changed. Every administrative event already being recorded
  now also appears in the canonical store, correctly classified.
* **Not duplicate generation** — one logical event, written once by one writer
  into two stores during a transition, always distinguishable by `source`. What
  the brief forbids is two systems generating the same event independently,
  which is the thing an adapter avoids.
* **Retirement** — when the panel reads `security_events` instead of
  `admin_logs`, the legacy insert can be dropped in one edit, with the old rows
  still there and still immutable.

The mirror has its own exception handler inside the writer's. A malformed bridge
event loses the canonical row and keeps the `admin_logs` row; it never costs the
caller its transaction.

---

## 8. Immutability, and the one thing that is mutable

Events are append-only, enforced by a trigger that refuses `UPDATE` and `DELETE`
for **every** role, `service_role` included. A correction is a new
`EVENT_CORRECTION` event (§26); the original always stands.

Alerts are the exception, and the difference is the point of §30: an event is
what happened, an alert is a condition somebody has to work through. Alerts move
`OPEN → ACKNOWLEDGED → RESOLVED | DISMISSED` via
`security_set_alert_status()`, which requires `SECURITY_ALERTS_MANAGE` on the
alert's own application.

Retention (§35) is configurable in `security_retention_policies` and **enacted
by nothing**. Deleting audit history will have to drop the immutability trigger
to do its job, which is exactly the amount of friction that operation deserves.

---

## 9. Integrating an application

A future application implements a small adapter around the canonical contract
and needs to know nothing about the Admin Panel.

```text
Future App ──> Security Event Adapter ──> Unchained Security Core
```

**1. Register the application.** One row in `admin_applications`. A slug, not a
display name (§9.1).

**2. Mint an application key.** Super Admin only:

```http
POST /functions/v1/security-core
Authorization: Bearer <super admin session>

{ "action": "mint_application_key",
  "application": "tancerca", "environment": "production",
  "label": "tancerca production ingestion" }
```

The plaintext key is returned **once** and never stored — only its SHA-256 hash
is. Put it in that application's existing secret management, alongside its other
service credentials. It is a server-side credential: an application key in
client-side code would let anyone holding the page write events as that
application.

**3. Emit events.**

```ts
import { SecurityEventClient, createHttpTransport } from '@/lib/security';

const security = new SecurityEventClient({
  transport: createHttpTransport({
    endpoint: `${CORE_URL}/functions/v1/security-core`,
    applicationKey: process.env.UNCHAINED_SECURITY_KEY!,
  }),
});

await security.emit({
  event_category: 'AUTHENTICATION',
  event_type: 'AUTH',
  event_action: 'LOGIN_FAILED',
  severity: 'LOW',
  status: 'FAILURE',
  actor_type: 'ANONYMOUS',
  actor_id: null,
  metadata: { reason: 'INVALID_CREDENTIALS' },
});
```

Code that already holds a session in this project skips the transport entirely
and calls `security_ingest_event(application, event)` over PostgREST.

**4. Correlate.** One logical operation, one `correlation_id`, many events
(§18):

```ts
const operation = security.withDefaults({ correlation_id: crypto.randomUUID() });
await operation.emit({ ...ORDER_CREATED });
await operation.emit({ ...PAYMENT_CREATED });
await operation.emit({ ...DELIVERY_CREATED });
```

**5. Choose a failure mode.** `emit()` is best effort and never throws for a
transport failure — an audit write must not fail the order it was describing.
`emitCritical()` throws if the event was not persisted, for the events of §33
where losing the record is worse than failing the operation. Use it
deliberately: each call makes the Security Core a dependency of the thing it is
observing.

---

## 10. What the Admin Panel has to build

The panel repository consumes the functions in §6 directly over PostgREST. No
part of the authorization model lives in the panel; it renders what it is given
and receives only what the signed-in administrator is entitled to.

```text
Security
├── Overview          security_query_alerts(p_status => 'OPEN')
│                   + security_query_events(p_severity => 'CRITICAL')
├── Events            security_query_events(...)   ← every filter of §37
│   └── Detail        security_get_event(id)
│                   + security_related_events(id)
├── Alerts            security_query_alerts(...)
│   └── Evidence      security_alert_evidence(id)
│                   + security_set_alert_status(id, status, note)
└── Detection Rules   SELECT on security_detection_rules

Audit
└── Activity          security_query_events(p_category => 'ADMINISTRATION')
```

Two rules for whoever builds it:

* **Never filter by application in the client.** Call the functions without
  `p_application` and render what comes back; the entitlement is already
  applied. A client-side filter over a fuller result would be the §42.5 failure.
* **Expect `ip_address`, `user_agent` and `device_id` to be `NULL`** for most
  administrators. That is §22 working, not missing data, and the UI should say
  so rather than rendering an empty field.

---

## 11. Testing

| Suite | Covers | How to run |
|---|---|---|
| `lib/security/*.test.ts` | the contract vocabulary, validation, secret detection, correlation, adapter failure modes | `pnpm test` |
| `supabase/tests/security_core_contract.sql` | authorization, isolation, immutability, persistence, ingestion, detection, the bridge | paste into the Studio SQL editor |

The SQL suite opens a transaction, builds its own fixtures, asserts, and rolls
back — nothing it creates survives, including every event it ingests. It has to
be run by hand because this project has no CI database and its migrations are
applied by hand; run it after applying `20260914000001` and after any change to
the Core's functions, permissions or RLS.

`node scripts/check-migrations.mjs` runs the static checks over the migration
before it is pasted anywhere.

---

## 12. Deliberately not built

Each of these is permitted by the contract and forbidden by its §50 until there
is a concrete need.

| | Why not yet |
|---|---|
| SIEM export (§39) | The model is vendor-neutral and exportable. Nothing exports it, and an adapter with no target would be designed against a guess. |
| `event_hash` / `previous_event_hash` (§32) | §32 says not to introduce cryptographic complexity without a concrete threat model. There is not one. The trigger already makes the table append-only. |
| Queues, batching, background workers (§34) | Permitted, and unnecessary at this volume. When it matters, it goes inside a `transport` and changes nothing about the callers. |
| Enacted retention (§35) | The policy table exists; nothing deletes anything. |
| More detection rules (§31) | One real rule — §31's own worked example — proves the schema, the evaluator and the alert path are wired together. Dozens of speculative ones would prove nothing. |
