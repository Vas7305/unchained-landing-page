# The Unchained Administration Core

Who may administer which application, with what role, what permissions, what
salary, and how they got in.

A reference for somebody who has to change it. It does not repeat what the code
says — `supabase/migrations/20260913000001_unchained_admin_core.sql` carries the
reasoning for every table and function it creates — and it is deliberately
short.

---

## 1. What this is, and what it is not

It is the **identity, RBAC, application-scope, compensation, invitation and
audit foundation** for delegated administrators across every Unchained Business
property.

It is **not** an administrator CRUD screen. The screens are the visible tenth of
it; the security boundary is in the database and in one edge function, and a
hidden button has never been a permission.

It is also **not a second authentication system**. People authenticate through
GoTrue exactly as they did, `public.roles` still says who the Super Admin is,
and no existing guard, policy or login path changed meaning.

| | |
|---|---|
| **Admin panel** | `D:\Tancerca\admin-panel` → https://www.admin.unchainedbusiness.com |
| **Core schema** | `supabase/migrations/20260913000001_unchained_admin_core.sql` (this repo) |
| **Privileged writes** | `supabase/functions/admin-core/` (this repo) |
| **Tests** | `supabase/tests/admin_core_authorization.sql`, plus `src/features/admin-core/*.test.ts` in the panel |

---

## 2. Where it lives, and why that is not a contradiction

The Core is in **Unchained Business's own Supabase project**. Every other
property keeps its own isolated project, exactly as
`docs/database-isolation.md` requires.

That looks like a contradiction and is not. What the isolation removed was a
shared **customer** pool: one `auth.users` holding TanCerca's customers and
Unchained's staff, which is what made "this email is already registered" happen
to somebody who had never touched Unchained, and what made "revoke this
contractor everywhere" unanswerable.

What is centralized here is a **staff directory** — delegated administrators and
nobody else. No customer of any property is ever a row in
`public.administrators`. Each property keeps its own `auth.users`, its own keys,
its own sending domain and all of its business data. What it stops owning is a
private, divergent idea of who its administrators are.

A separate Supabase project for the Core was considered and rejected: nothing
needs one, the organisation's two free project slots are both in use, and a
third database would have to be kept in step with this one by hand.

### `admin_applications` is not `platform_products`

They answer different questions and must never be merged.

| | |
|---|---|
| `platform_products` | *"Which products does **this** database grant memberships for?"* Exactly one row — `unchained` — and migration `20260905000001` §9.2 **raises** if a second appears. |
| `admin_applications` | *"Which web properties does Unchained administer?"* `tancerca`, `unchained-business`, `frito`. A row is a **scope**, not a grant: it confers nothing and opens no table in any other database. |

The Core's own migration asserts that `platform_products` is still intact, so a
future edit that tried to register an application in the wrong place fails on
apply.

---

## 3. The authorization chain

```text
authenticated?      auth.uid() is not null
      ↓
administrator?      a row in public.administrators for that user
      ↓
status?             that row is ACTIVE
      ↓
application scope?  that row names THIS application, and it is active
      ↓
role?               the role is 'active' — a LATENT role resolves to nothing
      ↓
permission?         the role maps it, or an explicit ALLOW grant does
      ↓
not denied?         no explicit DENY grant for this administrator
      ↓
                    ALLOW / DENY
```

All of it in `public.admin_has_permission(application, permission)` — `STABLE`,
side-effect free, safe inside an RLS policy. **Deny by default**: the query
returns false unless every link holds.

### Recording a refusal and aborting on it are two different calls

PostgreSQL has **no autonomous transactions**. A function that writes an audit
row and then raises destroys its own audit row — the raise aborts the
transaction, and everything written inside it goes too.

The first cut of this Core had one `admin_authorize()` that logged the denial
*and* raised. It never recorded a single event, and it read as though it did.
The authorization suite caught it on its first real run, at §13.

So there are two enforcement functions, and the caller picks by what it needs:

| | |
|---|---|
| `admin_check_access(app, perm)` | Returns **FALSE** and **records** the denial. Use this wherever the event matters — which is most places. The caller decides what to do with the `false`. |
| `admin_authorize(app, perm)` | **Raises** `insufficient_privilege` (PostgREST → **403**) and records **nothing**. Use it where the request must die at the database and the caller records the refusal itself. |

`admin_authorize()` deliberately does not call `admin_check_access()` — that
would look tidy and would be a lie, since the raise would roll its event back.

A recorded refusal is one of two events, and the distinction matters:

* `ADMIN_CROSS_APP_ACCESS_ATTEMPT` — the caller **is** an active administrator,
  of a different application. Severity `critical`.
* `ADMIN_ACCESS_DENIED` — everything else.

A **granted** check records nothing: a trail of every successful permission
check would bury the refusals, which are the entries anybody actually reads.

The only global authority is `public.is_super_admin()`, a row in `public.roles`.
There is no delegated `SUPER_ADMIN`: `admin_roles` holds five roles and the
creation form cannot offer a sixth, which the migration asserts on apply.

---

## 4. Roles and permissions

Five canonical roles, fixed for this implementation:

| Role | Holds |
|---|---|
| `APP_ADMIN` | dashboard, operations (read), affiliates, commercials, specialists |
| `CONTENT_ADMIN` | dashboard, the whole CMS including publish and delete |
| `FINANCE_ADMIN` | dashboard, finance read, reports, expenses, reconciliation |
| `OPERATIONS_ADMIN` | dashboard, operations read **and** manage, affiliates, commercials, specialists |
| `TRANSPORT_OPERATIONS_ADMIN` | **nothing** — see §6 |

What no delegated role holds, for any application: `ADMIN_*`, `SALARY_MANAGE`,
`PRICING_MANAGE`, `MEMBERSHIP_PRICING_MANAGE`, `TANCOINS_MANAGE`,
`FRITOS_MANAGE`, `ECONOMY_MANAGE`, `ANTIFRAUD_MANAGE`, `GLOBAL_SETTINGS_MANAGE`,
`ROLE_MANAGE`, `PERMISSION_MANAGE`, `APPLICATION_SCOPE_MANAGE`.

That is not a convention. §16.5 of the migration is an apply-time assertion: map
one of them to a role and the migration stops being appliable. The SQL test
suite asks the same question of the resolver, for every role, by name.

`FINANCE_ADMIN` deliberately does **not** hold `SALARY_VIEW`. Salary may be
visible where the permission is explicitly granted; deny-by-default means
*explicitly granted* is a decision somebody makes about a person, not a default
that arrives with a job title.

`APP_DASHBOARD_VIEW` is held by all four active roles. It is the minimum "may
open this application's admin shell", conveys no data of its own, and without it
an administrator would accept an invitation and land nowhere.

### Adding a permission

An `INSERT` into `admin_permissions` and one into `admin_role_permissions`. No
migration to a `CHECK`, no component to edit, no second list to keep in step —
the capability preview, the resolver and the integration contract all read the
same two tables.

### Adding a role

An `INSERT` into `admin_roles` plus its mapping — **and** an edit to the §16.3
assertion, which currently refuses any role outside the canonical five. That
friction is intentional: the specification fixes the set, and a sixth role
should be a decision rather than a side effect.

---

## 5. Extensibility, already built

`administrator_permission_grants` is a per-administrator override table:
`ALLOW` adds a permission on top of the role, `DENY` removes one, and `DENY`
wins. It is **empty**, has no UI and no writer in this module.

It exists so that `APP_ADMIN + CMS_PUBLISH` — the example the specification
gives — is a row rather than a redesign. The resolver already reads it, and the
test suite already exercises both effects, including that an `ALLOW` is still
scoped to one application.

---

## 6. The latent Transport Operations role

```text
role   = TRANSPORT_OPERATIONS_ADMIN
module = TRANSPORT_OPERATIONS
status = latent
```

The role exists, is assignable today, and **resolves to no permissions at all**
— including the two it is mapped to. Latency is the `status` column on the role
row, not a missing mapping.

Enabling the future Transport Supervisor module is therefore:

```sql
UPDATE public.admin_roles SET status = 'active' WHERE code = 'TRANSPORT_OPERATIONS_ADMIN';
```

No schema change, no mapping change, no panel change. The test suite asserts
both halves: that it grants nothing now, and that flipping the status turns
exactly its two permissions on.

Nothing of the supervisor module itself has been built — no map, no driver
tracking, no dispatch, no incident console. This is the authorization foundation
only.

---

## 7. The Magic Link

```text
Super Admin → Create administrator (name, email, application, role, salary)
           → PENDING administrator row, no auth account yet
           → 32 random bytes; only the SHA-256 hash is stored
           → email carries the raw token to /admin-invite
Recipient  → opens the link
           → admin_claim_invitation() spends it, atomically, once
           → GoTrue account created (invite) or recovery link generated
           → admin_activate_administrator() → ACTIVE
           → the person chooses a password and has a scoped session
```

**Why the Core mints its own token instead of using GoTrue's.** GoTrue's invite
link is already single-use and already expires. It cannot be **revoked**, and
its status cannot be audited — and the specification requires both. So the Core
issues its own, and GoTrue's link is generated only *after* the Core's has been
validated and consumed. Two tokens in series, not in competition.

Properties, each tested in `supabase/tests/admin_core_authorization.sql`:

* the plaintext token is never stored, never logged, and leaves the edge
  function only in the email body;
* one-time use is a single `UPDATE … WHERE status = 'pending' AND expires_at >
  now() RETURNING`, so two concurrent acceptances serialise on the row and
  exactly one wins — there is no check-then-write window;
* at most one live invitation per administrator (a partial unique index), so
  resending kills the previous link;
* an expired, spent or revoked token, and a token belonging to a suspended or
  revoked administrator, are all refused;
* every refusal returns the **same** message, so the endpoint cannot be used to
  learn which tokens ever existed. The real reason goes to the security event.

The default lifetime is 72 hours (`ADMIN_INVITATION_TTL_HOURS`).

---

## 8. Lifecycle

```text
PENDING ──accepted──► ACTIVE ──┬──► SUSPENDED ──► ACTIVE
                               └──► REVOKED
```

There is **no delete**, on the screen or in the API. Removing access is a status
change that leaves the record, its role history, its salary history and its
audit trail attached to the person — because "who had access to TanCerca in
March" has to stay answerable after they leave.

Closing an account does three things, all in `set_status`:

1. the status change, which makes the account powerless on its **next request** —
   every authorization question requires `status = 'ACTIVE'`;
2. any pending invitation is revoked, so they cannot re-accept their way back;
3. `auth.admin.signOut(user, 'global')` ends their live sessions.

(3) is best-effort: a revocation that is recorded and already being enforced
must not report failure because GoTrue was briefly unreachable.

---

## 9. Compensation

`administrator_compensation` is versioned, not overwritten: superseding closes
the previous row with an `effective_to` and opens a new one, and a partial
unique index makes "the current salary" a single row rather than a query with an
`ORDER BY` and a hope.

Only the Super Admin writes it. An administrator may **read** their own and can
never write it — enforced by RLS, and again by a trigger that refuses a write
whose subject is the writer. Every change emits `ADMIN_SALARY_CREATED` or
`ADMIN_SALARY_CHANGED` at `critical` severity.

---

## 10. Security events

There is **no new event table**. In this database the existing contract is
`public.admin_logs` — the same table `create-unchained-member` already writes to
— and `public.admin_core_log_event()` is the only writer for the Core.

(TanCerca's project has a richer `security_events` / `log_security_event()` /
`admin_audit_log` layer. It is not reachable from here, by design: calling
across would need a credential spanning two properties, which is the thing the
split removed.)

Every event carries the same envelope inside `metadata`:

```json
{
  "contract": "unchained.admin_core.v1",
  "result": "SUCCESS | DENIED | FAILURE",
  "severity": "info | warning | critical",
  "application": "tancerca",
  "target": "<administrator id>",
  "occurred_at": "…"
}
```

Emitted: `ADMIN_CREATED`, `ADMIN_INVITATION_SENT`, `ADMIN_INVITATION_ACCEPTED`,
`ADMIN_SUSPENDED`, `ADMIN_REVOKED`, `ADMIN_REINSTATED`, `ADMIN_ROLE_ASSIGNED`,
`ADMIN_ROLE_CHANGED`, `ADMIN_APPLICATION_ASSIGNED`, `ADMIN_APPLICATION_CHANGED`,
`ADMIN_SALARY_CREATED`, `ADMIN_SALARY_CHANGED`, `ADMIN_ACCESS_DENIED`,
`ADMIN_CROSS_APP_ACCESS_ATTEMPT`.

`admin_logs` is now **physically append-only**: a `BEFORE UPDATE OR DELETE`
trigger refuses for every role, `service_role` included. Nothing in either
repository updates or deletes it.

`admin_core_log_event()` never throws — a logging failure must not roll back the
operation that caused it — and is `EXECUTE`-able only by `service_role`, so a
browser session cannot forge an event.

It also cannot be called from a code path that is about to raise: see §3. The
`admin-core` edge function is unaffected, because each of its RPCs is its own
transaction and `logEvent()` is a separate call that commits on its own.

`ADMIN_LOGIN` / `ADMIN_LOGOUT` are **not** emitted. Authentication is GoTrue's,
it already records it, and a second, partial copy written by whichever client
happened to notice would be worse than none. `administrators.last_access_at`
carries what the administrator list actually needs.

---

## 11. Integration contract for applications

One call. An application asks the Core who is in front of it:

```sql
select * from public.admin_resolve_context('tancerca');
-- administrator_id, name, email, application_slug, application_name,
-- role_code, role_name, role_status, status, is_active, permissions[]
```

It applies the **whole** chain from §3 — status, scope, role latency, permission
status, per-administrator `DENY`. An application that joined the tables itself
would be re-implementing that chain, and the first time the two disagreed the
more permissive one would win silently.

`public.admin_current_contexts()` lists every context the caller holds, across
applications. `public.admin_touch_last_access()` stamps their own row.

### What is **not** done yet, and must be said plainly

TanCerca's ~69 RLS policies and 59 functions authorize on TanCerca's own
`is_super_admin()`, in TanCerca's database, which knows nothing about the Core.
The same is true of Unchained's own screens, which gate on
`product_memberships`.

So a delegated administrator created here is **authoritative in the Core and
inert inside the applications** until each application adopts this contract.
Today they sign in and land on `/administration/me`, which tells them their
application, their role and exactly what it resolves to.

Adopting the contract, per application, is: call `admin_resolve_context()` (or
`admin_has_permission()` from a policy, where the application shares this
database), and replace `is_super_admin()` in the policies that should become
role-scoped. That is a dedicated migration per application and was deliberately
not attempted as a side effect of this one — the panel's router has carried a
note saying exactly that since the platform phase.

---

## 12. The screens

| Route | Who | What |
|---|---|---|
| `/administration/$application/administrators` | Super Admin | the list, create, resend, suspend, revoke, role and salary |
| `/administration/me` | any administrator | their own application, role and resolved permissions |
| `/admin-invite?token=…` | public | exchanges the one-time token for a GoTrue link |

The subtree sits outside every product: the Core belongs to none of them, and
the application in the path is what scopes the screen. It is entered from an
**Administration** section in both product sidebars.

Managing TanCerca's administrators needs a session against **Unchained's**
project, because that is where the Core is. An operator who has only signed in
to TanCerca is sent to `/login?property=unchained` — asked to sign in, not
refused.

The route guards are routing, not enforcement. Bypassed, the data still refuses:
`admin_list_administrators()` **raises** for a non-Super-Admin rather than
returning an empty list, every Core table is Super-Admin-only under RLS, and
every privileged write re-authorizes from the JWT inside the edge function.

The capability preview in the creation dialog is generated from
`admin_role_capabilities()` — the whole catalogue with the role's real mapping
applied — so the "Restricted" column is the complement of the "Allowed" column
rather than a second list maintained by hand.

---

## 13. Running the tests

```bash
# The panel's pure modules
cd D:\Tancerca\admin-panel && npm test

# The migration's static checks
cd D:\unchained-landing-page && node scripts/check-migrations.mjs
```

The authorization suite is SQL, and has to be run by hand because this project
has no CI database and applies its migrations by hand: paste
`supabase/tests/admin_core_authorization.sql` into the Studio SQL editor of the
Unchained project. It builds its own fixtures, asserts, and `ROLLBACK`s —
nothing it creates survives, including the `auth.users` rows. Run it after
applying the migration and after any change to the Core's functions, its role
mapping or its RLS.

What it does **not** cover: the `admin-core` edge function's own Deno code — HTTP
dispatch, the Super Admin gate on the `Authorization` header, the Resend call
and the GoTrue round trip. Those need a deployed function and a live GoTrue.
Note what that does *not* leave untested: the invitation rules were deliberately
moved out of the edge function and into `admin_invitation_state()` /
`admin_claim_invitation()` so that this suite could execute them.

---

## 14. Deploying it

1. Paste `supabase/migrations/20260913000001_unchained_admin_core.sql` into the
   Studio SQL editor of the Unchained project. It is idempotent and its
   apply-time assertions fail the whole migration rather than leaving a
   half-secured Core behind.
2. Run `supabase/tests/admin_core_authorization.sql` the same way.
3. Deploy the function: `supabase functions deploy admin-core --use-api`.
4. Set its secrets: `ADMIN_PANEL_URL`, `RESEND_API_KEY`, `FROM_EMAIL`, and
   optionally `ADMIN_INVITATION_TTL_HOURS` (default 72).
5. Deploy the panel.

See `docs/database-isolation.md` for why `db push` is not used here, and for the
environment facts (no Docker, no `psql`) that shaped these steps.
