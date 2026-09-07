# Database isolation — one web property, one Supabase project

**Status, 2026-09-05.** Steps 0-5 and 7's local half are done and verified,
against a project that was **rebuilt once**: the first attempt landed in
`us-west-2`, which is the worst US region for a European audience, so it was
redone in `us-east-1` to match TanCerca and Frito. A Supabase project's region
cannot be changed, so "fixing" it means creating a new one and repeating the
cutover.

| | |
|---|---|
| project | `sgyejgsaqknbmnzqfbul` — **Unchained**, us-east-1, PG 17.6.1.166 |
| superseded | `qgbbttqbnheevxexxnah` — us-west-2, **paused**, delete once this is trusted |
| schema | 5 migrations, 13/13 tables, `platform_products` = 1 row |
| data | 16 rows, counts match the export exactly |
| edge function | `create-unchained-member` deployed (`--use-api`, no Docker) |

Verified over HTTPS with the publishable key, the same path the live site takes:

| check | result |
|---|---|
| `resolve_commercial_contact` IT/RU/CU/ES | identical answers to TanCerca's, channel for channel |
| `create_public_lead` + honeypot | `{"success": true}`, wrote nothing (still 1 lead) |
| anon vs `unchained_leads`, `commercial_contacts`, `roles`, `product_memberships` | HTTP 401 `42501` on all |
| landing bundle | new ref inlined; zero references to the old project or to TanCerca |

Two traps found while redoing it:

- **The org allows 2 active free projects** and both were taken, so the
  us-west-2 project had to be paused before the replacement could be created.
  The CLI has no `pause` — only `list`, `create`, `api-keys`, `delete` — so
  that step is the dashboard's.
- **A stale `.env`** in this repo (alongside `.env.local`) still named the
  paused project. `.env.local` wins in Next.js so the bundle was correct
  anyway, but the landing build failed once with a `/_global-error` invariant
  and passed on every run after the two files were aligned. Whether the stale
  file caused it or it was a flake in Next 16's Turbopack prerender, both files
  now agree and two consecutive builds are green.

`unchained_services` is **seeded by the leads migration** (three rows,
`ON CONFLICT DO NOTHING`), so re-importing it would collide on the primary key.
`migrate-data.py` sends `Prefer: resolution=merge-duplicates`, which makes the
whole import an upsert and therefore idempotent — which is what made repeating
the cutover a single command.

**Left, and all of it needs you:** step 4 (SMTP/Resend secrets), step 5 (create
your account, then run `bootstrap-super-admin-studio.sql` — it auto-detects the
project's only account), step 6 (re-invite the four commercials), the deployed
half of step 7 (Vercel env vars, panel deploy), and step 8 (decommission in
TanCerca after a soak week). Also: delete the paused `qgbbttqbnheevxexxnah`
once you trust the new one.

---

## 1. What was actually wrong

Inviting a specialist to Unchained Business failed with *"A user with this
email address has already been registered"* for an address that had never
touched Unchained. It was registered in TanCerca.

There were two causes stacked on top of each other, and they need separating
because only one of them is a bug.

### 1.1 The shared project (the cause)

`unchained-landing-page/.env.local` and `D:\Tancerca\.env` both pointed at
Supabase project `jkjsjojwlrzpcpggqgws`. The entire Unchained schema lived
inside TanCerca's database as four extra migrations:

```
20260901000001_unchained_commercial.sql
20260901000002_resolve_commercial_contact.sql
20260903000001_unchained_leads.sql
20260904000003_unchained_workforce.sql
```

Separation between the two products was *logical* — a `product_id` column on
`product_memberships` — and logical separation cannot separate the one table
that is not in `public` at all: **`auth.users`**.

One `auth.users` is one identity namespace. A TanCerca customer signing up and
an Unchained specialist being invited compete for the same address, and GoTrue
is right to say so. No amount of care in the invite function changes that,
because the collision is real: at the database level those two people *are* one
account.

### 1.2 The pagination bug (the thing that made it fatal)

`create-unchained-member` was written to handle the collision gracefully:
existing address → magic link, new address → invite. It decided which by
calling

```ts
const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
```

`listUsers()` with no arguments takes GoTrue's **default page size of 50**. Past
50 accounts, an existing address reads as new, the code takes the invite branch,
and GoTrue refuses it. The panel surfaces that refusal verbatim
(`admin-panel/src/features/workforce/queries.ts`), which is why the message you
saw was GoTrue's wording and not ours.

**Fixed**, in both copies of the function — the one still deployed on TanCerca's
project (`D:\Tancerca\supabase\functions\create-unchained-member\index.ts`) and
the one in this repo. It now asks GoTrue to create the account and reads the
answer, rather than deciding in advance:

```ts
const invited = await supabaseAdmin.auth.admin.generateLink({ type: "invite", … })
if (invited.error && isAlreadyRegistered(invited.error)) { /* recovery link */ }
```

One round trip instead of one per fifty accounts, and it cannot go stale between
the read and the write.

### 1.2.1 The fallback is a recovery link, not a magic link

The existing-address branch originally generated `type: "magiclink"`, which is
what `create-affiliate` still does. A magic link **is a session**: the panel's
login page reads `type=magiclink` from the URL hash and routes the person
straight to their dashboard, so a commercial or a specialist invited this way
arrived inside the panel having never chosen a password — and, having none,
could not get back in without another email from an operator.

It now generates `type: "recovery"` pointed at `/reset-password?property=…`,
the panel's dedicated set-a-new-password page (`ResetPasswordPage.tsx`, which
routes by role once the password is saved). A new address still gets an invite
to `/login?property=…`, where the same choice is offered as `type=invite`. Both
paths therefore end on a password form, which is what a TanCerca affiliate has
always gone through.

`/login` is deliberately NOT the recovery destination: it handles only
`type=invite`, and the panel keeps recovery on its own page so a reset link
opened in a second tab cannot flip the login form. Both URLs are already in
`supabase/config.toml`'s `additional_redirect_urls`.

> **`create-affiliate/index.ts:218` has the identical bug** and is untouched —
> it is TanCerca's, and TanCerca is not what you asked me to change. It will
> misreport the same way once that project passes 50 users, if it has not
> already.

### 1.3 Why both had to be dealt with

Isolation removes the *class* of failure: in Unchained's own database the
address genuinely does not exist, so there is nothing to collide with. It does
not remove the *defect* — Unchained will pass 50 accounts of its own, and the
old code would then have said the same wrong thing about its own people.

---

## 2. The rule

> **One web property, one Supabase project.** Its own `auth.users`, its own
> roles, its own keys, its own sending domain, its own storage and its own
> logs.

Not one project with a `product_id` column. Not one project with a schema per
site. When Unchained takes on Frito, Frito gets a project — the same way
Unchained is getting one here.

The cost is real and worth naming: a person who works on two properties has two
logins, and there is no cross-property reporting without building it. That is
the trade being made deliberately. A shared identity pool is precisely what
produced the bug you hit, and it is also what makes "revoke this contractor
everywhere" a thing nobody can do confidently.

What the seam is **not** used for: `platform_products` / `product_memberships`
are kept inside Unchained's database, seeded with `unchained` alone. They still
distinguish an `unchained_admin` from a `commercial` from a `specialist`, which
is an internal Unchained question. `product_memberships.product_id` has a
foreign key to `platform_products.id`, so a row naming another site cannot be
inserted at all — the rule is enforced by the schema, not by memory.

---

## 3. What is in this repo now

```
supabase/
  config.toml                                        auth, redirects, sender
  migrations/
    20260905000001_unchained_foundation.sql          NEW — roles, admin_logs,
                                                     is_super_admin, platform
                                                     products, memberships
    20260905000002_unchained_commercial.sql          ported unchanged
    20260905000003_resolve_commercial_contact.sql    ported unchanged
    20260905000004_unchained_leads.sql               ported unchanged
    20260905000005_unchained_workforce.sql           ported unchanged
    20260907000001_unchained_settings.sql            NEW — the business
                                                     profile behind
                                                     /unchained/settings
  functions/
    create-unchained-member/index.ts                 ported + fixed + own sender

scripts/isolation/
  migrate-data.py                  THE DATA MOVE — export / import / verify
  cutover.env.example              credentials template (cutover.env is ignored)
  bootstrap-super-admin-studio.sql the first operator, from the SQL editor
  bootstrap-super-admin.sql        the same, from psql
  decommission-in-tancerca.sql     LAST, and only after a soak period

  export-from-tancerca.sh          pg_dump path — correct, but unusable here
  import-into-unchained.sh         psql path — same
  post-import.sql                  its identity-severing step
  _pg.sh                           native-or-Docker tool resolution
```

Two files are new code: `20260905000001_unchained_foundation.sql`, and
`20260907000001_unchained_settings.sql`, which was written after the cutover
and is the first migration in this repo that was never a TanCerca file. It adds
one table, `unchained_settings` — a single row holding the business profile,
which is what the admin panel's Unchained › Settings screen now edits. It is
additive: it creates its own table and touches nothing an earlier phase built.

The other four are the migrations that have been running in production,
unchanged apart from a banner at the top of each saying so. That is deliberate:
they carry their own apply-time assertions — a lot of them, including a probe
that creates a lead,
walks it through the funnel and rolls back — and those assertions are the
acceptance test for the port. Rewriting the bodies would mean the thing being
verified is no longer the thing that was running. If the new database is wrong,
`supabase db push` fails rather than succeeding quietly.

Their commentary still names TanCerca in places, and the banner says to read
those passages as history. Three of the constraints they cite as immovable —
notably "the `roles` CHECK cannot be widened" and "one person holds exactly one
role" — do not hold in this database.

The foundation file supplies the four things Unchained used to borrow:
`is_super_admin()`, `roles`, `platform_products`, `product_memberships` (plus
`admin_logs` and `has_product_access()`). Three deliberate deviations from
TanCerca's versions, all repairs that were impossible over there:

| | TanCerca | here | why |
|---|---|---|---|
| `roles` uniqueness | `UNIQUE (user_id)` | `UNIQUE (user_id, role)` | the single-role constraint is why Phase 4 could not create an `unchained_admin` global role and had to gate five policies on `is_super_admin()` instead |
| `roles.role` | `CHECK (role IN ('user','super_admin'))` | slug `CHECK` | same reason: appointing a role becomes a data change |
| `admin_logs` | has `target_tenant_id` → `public.tenants` | column dropped | there are no tenants in this database |

---

## 4. The cutover

Steps 0 and 1 are done. Steps 4, 5 and 7 need a dashboard; the rest are the
scripts above.

### Prerequisites

Verified on this machine, 2026-09-05:

| | |
|---|---|
| Supabase CLI | ✅ `npx supabase` — 2.116.0, already authenticated |
| Python | ✅ 3.14.6 — standard library only |
| `psql` / `pg_dump` | ❌ not on PATH |
| Docker | ⚠️ CLI 29.7.2 installed, **daemon cannot start** |

Docker Desktop is present but WSL is not usable: the app is installed (2.7.12)
while the Windows optional component it needs is not enabled, so `docker info`
fails with `WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED`. Enabling it means
`wsl --install --no-distribution` as administrator **and a reboot**.

**So the data move does not use pg_dump at all.**
`scripts/isolation/migrate-data.py` does it over HTTPS through PostgREST, using
each project's service-role key. Standard library only — no Docker, no WSL, no
PostgreSQL install, no admin rights, no reboot.

The shell scripts (`export-from-tancerca.sh`, `import-into-unchained.sh`,
`_pg.sh`) are kept and are correct. They are the better tool on a machine that
has `psql`, and `_pg.sh` will fall back to the `postgres:17-alpine` image if
Docker is ever working. They are simply not the path in use here.

The CLI, by contrast, needs no database password: `supabase db push` reported
"Initialising login role..." and connected on its own. `supabase/.temp/pooler-url`
holds `postgresql://postgres.<ref>@host` with no credential in it — the CLI
provisions a temporary login role through the Management API at connect time.
That covers step 1 but not raw `pg_dump`, which is why the data move needed its
own answer.

### Step 0 — create the project *(you)* ✅ done

Supabase dashboard → New project. Same region as the site's users. Name it
something that cannot be mistaken for the other one — `unchained-business`.

Then:

| value | where it goes | secret? |
|---|---|---|
| project ref | `supabase link --project-ref <ref>` | no |
| Project URL | `.env.local`, Vercel, panel env | no |
| anon / publishable key | same three places | no — it is inlined into public bundles |
| DB connection URI, port **5432** | `scripts/isolation/cutover.env` (gitignored) | **yes — password** |
| service-role key | nowhere. Supabase injects it into edge functions itself | **yes** |

Copy `scripts/isolation/cutover.env.example` to `cutover.env` and fill in both
connection strings. It is gitignored, it has a lifetime of one migration, and
it should be deleted afterwards. Use the DIRECT connection on 5432, not the
transaction pooler on 6543 — pg_dump and the trigger-disabling load both need
session-level features the pooler does not provide.

### Step 1 — apply the schema

```bash
npx supabase link --project-ref <new-ref>
npx supabase db push
```

`db push --db-url "$UNCHAINED_DB_URL"` does the same thing without `supabase
login`, which is useful in a non-interactive shell.

Expect a wall of `[ok]` notices. Any `[fail]` aborts the whole migration and
leaves the database untouched — read it rather than retrying.

### Step 2 — export from the old project

Fill in `scripts/isolation/cutover.env` (copy the `.example`) with both
**service-role** keys — not the publishable ones; the script refuses those,
because RLS would hand back an empty list for every table and "no rows
anywhere" reads exactly like "there was nothing to migrate".

```bash
python scripts/isolation/migrate-data.py export
```

Read-only. Writes `scripts/isolation/out/unchained-data.json` and prints row
counts. **Read that file before loading it** — this is the one moment where the
data is visible in a form a person can actually check.

The three columns naming a row in the old project's `auth.users`
(`commercial_contacts.user_id`, `unchained_specialists.user_id`,
`unchained_lead_events.actor_id`) are dropped here, on the way out, rather than
imported and then erased.

### Step 3 — import into the new project

```bash
python scripts/isolation/migrate-data.py import
python scripts/isolation/migrate-data.py verify
```

Rows go in foreign-key order, in batches of 200; each batch is one request and
one transaction, so a constraint violation rejects that batch whole rather than
leaving half of it behind. `verify` compares row counts on both sides and exits
non-zero if any differ.

**The triggers stay on, and that is not a shortcut.** Every trigger on these
tables was read first: the `*_touch_updated_at`, `*_before_update` and
`unchained_lead_events_append_only` triggers all fire on UPDATE or DELETE only;
`unchained_guard_commission_rate`'s INSERT branch explicitly permits a caller
with no `auth.uid()`, which is what service_role is; and both default-rate
triggers are `IF NEW.x IS NULL` guards that never overwrite a value already
set. Foreign keys and CHECK constraints are enforced throughout — the load is
refused if the data does not hold together, which is the part worth keeping.

### Step 4 — configure email *(you)*

Authentication → Emails → SMTP Settings, on Unchained's own domain and API key.
Set `FROM_EMAIL` in the function secrets to match. An access link for an
Unchained specialist arriving from `@tancerca.com` tells the recipient the two
businesses are one system, which is the thing being undone.

### Step 5 — the first operator

Dashboard → Authentication → Users → Add user, with your address. Then:

```bash
psql "$UNCHAINED_DB_URL" -v owner_email="'you@unchainedbusiness.com'" \
     -f scripts/isolation/bootstrap-super-admin.sql
```

Sign out and back in afterwards — the `app_metadata` claim only reaches your
token at the next sign-in.

### Step 6 — re-invite everybody

Every commercial and every specialist arrives with `user_id = NULL` and cannot
sign in. Invite each of them from the panel; `create-unchained-member` matches
the roster row by email and writes the new `user_id` into it.

**Identities are re-issued, not copied.** Copying `auth.users` across a trust
boundary this exercise exists to create would mean copying password hashes and
refresh tokens — and it would carry TanCerca's *customer* addresses into the
new project, recreating the exact collision that started this. Re-inviting uses
a code path that already exists and is already tested.

Their commission rates are **not** re-typed: they came across with the roster
row, and the re-invite path deliberately does not overwrite them.

### Step 7 — repoint the clients *(you)*

- `.env.local` and Vercel → the new URL and anon key. Redeploy.
- Deploy the function: `supabase functions deploy create-unchained-member`,
  with `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_PANEL_URL` set as secrets.
- Admin panel → add Unchained's new project to the property registry. **See §5**
  — this is a registry change in `D:\Tancerca\admin-panel`, not a separate
  build, and it can land before or after the data moves.

Verify, in this order: the public contact panel still resolves a regional
representative; the inquiry form still writes a lead; a specialist invite to a
brand-new address succeeds; a specialist invite to an address that exists *in
TanCerca* also succeeds, because over here it is simply a new address. That last
one is the original bug report, and it is the acceptance test.

### Step 8 — decommission, later

```bash
psql "$TANCERCA_DB_URL" -v decommission=yes -f scripts/isolation/decommission-in-tancerca.sql
```

Ends in `ROLLBACK`. The first run is a rehearsal that tells you exactly what
would happen on the real data; change the last line to `COMMIT` when the output
reads the way you expect.

Do not run this during the cutover. A week of soak, everyone signed in at least
once, the export archived off this laptop, and a dated backup of the old
project. Leaving the tables in place costs nothing — they stop being read the
moment step 7 lands.

---

## 5. The panel: one command centre, many databases

**Correction.** An earlier draft of this document said a single deployed panel
could not hold sessions against two projects at once, and concluded that
Unchained needed its own build. That was wrong, and the conclusion drawn from
it was wrong with it.

`createClient()` derives its auth storage key from the project ref in the URL —
`sb-<ref>-auth-token`, in `SupabaseClient`'s constructor. Two clients pointing
at two projects therefore keep two independent sessions in the same browser,
under different `localStorage` keys, with no configuration at all. One admin app
fronting every property is not a workaround; it is the normal thing.

So: **one panel, `D:\Tancerca\admin-panel`, one client per property.**

### 5.1 Does that weaken the isolation?

No, in the way that matters, and it is worth being precise about which way that
is.

What stays fully separate: the databases, the `auth.users` of each, every key,
every sending domain. **No server anywhere holds a credential that spans two
properties.** The cross-property view exists only in the browser of an operator
who already holds a session for each one — which is the correct place for it,
and is strictly better than a backend-for-frontend holding every service-role
key.

What is genuinely shared: the application code and the browser tab. A bug in
the panel could in principle read from one property and write to another. That
is a code defect rather than a granted privilege, and the registry below makes
it a hard one to write by accident. An XSS in the panel reaches every session
the operator is holding — true, and equally true today with one project.

### 5.2 What was built — done, 2026-09-05

All of it is in `D:\Tancerca\admin-panel`. Typecheck clean, 173 tests passing
(was 142), production build clean.

**New — `src/platform/connections.ts` + `connections.test.ts` (22 tests).**
Three pure decisions, kept free of `import.meta.env` and `window` so the node
test suite can execute them exactly as the app does:

- `resolveConnections()` — which project each property reaches, **with a
  fallback**. A property missing either half of its configuration falls back to
  TanCerca's project and is reported as `isolated: false`. That is what makes
  this shippable *before* the data moves: with no new variables set, every
  property resolves to one connection and the panel behaves identically to
  yesterday's build. Setting two variables is the whole client-side cutover.
- `landingPropertyFromSearch()` — which property owns the auth token in the URL.
- `detectSessionInUrlFor()` — compared by **project URL, not property id**, so
  two properties still sharing a project share one client and that client still
  redeems the token.

**`src/lib/supabase.ts`** — was a 10-line singleton, now a factory.
`getClient(id)` memoised **by connection**, so "same project" and "same client"
are the same statement and two GoTrueClients never fight over one storage key.
`supabase` remains exported as TanCerca's client: 28 of the 32 modules that
import it are TanCerca's own and did not change at all. Also exports
`LANDING_PROPERTY`, `isIsolated()` and `allClients()`.

**`src/platform/access.ts`** — the real semantic change. Each property's
database now answers only about itself, and **a database may only grant its own
product**. That is not defensive coding: until step 8 runs, TanCerca's project
still holds the Unchained tables and would cheerfully tell a super_admin they
hold `unchained`. Believing it would open `/unchained` on the wrong database's
say-so, onto screens querying a project where that person may have no session.
`fetchPlatformAccess()` is now a union across properties; `checkProductAccess()`
asks one. An unreachable property degrades the command centre to the properties
that are up rather than taking the panel down.

**`src/vite-env.d.ts`** — the env vars are declared explicitly rather than left
to vite/client's `any` index signature. A misspelled `VITE_UNCHAINED_SUPABSE_URL`
would otherwise read as undefined and *silently fall the property back to
TanCerca's database* — precisely the failure this separation exists to prevent.
Now it does not compile.

**Auth flow** — `useLogin(propertyId)` signs in to one property;
`useLogout()` signs out of **all** of them, because a "log out" that leaves
another business's session live is a genuine surprise. `LoginPage` and
`ResetPasswordPage` operate on the landing property's client, name that property
in the header, and carry `?property=` through every round trip.

**Route guards** — `requireProductAccess` now redirects to
`/login?property=<id>` when there is no session *for that property*, instead of
a bare `/login`.

**Unchained's data modules** — `features/workforce`, `features/leads` and
`features/commercial` bind `unchainedDb = getClient('unchained')` rather than
importing the ambiguous `supabase`.

**The invite link** — `create-unchained-member` now appends
`?property=unchained` to its `redirectTo`. Without it the default client would
race to spend a single-use token minted by a different project.

### 5.3 The cost that remains

**One login per property.** No shared identity, deliberately — a shared operator
directory is a shared `auth.users`, which is the thing this exercise removed. In
practice it lands on one person: staff work on one property and sign in to one
thing; only the owner holds several. Too weak an argument for single sign-on to
build it before the friction is real. If it ever is, the answer is a hub storing
*only* operators and their property grants — never business data, never
customers.

### 5.4 Where the code lives

The panel is a cross-property asset, so it does **not** move into this repo.
`apps/admin` here was the right home for an Unchained-only build and is the
wrong home for a command centre; `pnpm-workspace.yaml` keeps its empty
`apps/*` for something else.

It stays at `D:\Tancerca\admin-panel` for now. That is an awkward address for a
thing that fronts three businesses, and extracting it to its own repo is worth
doing — but it is a move, not a rewrite, and it should not block the cutover.

Per-property backends stay with their property: Unchained's `supabase/` is in
this repo, Frito's will be in Frito's.

### 5.5 What that means for the cutover

Steps 0–7 are unchanged. Step 7's "admin panel → the new project" is no longer
blocked on a port: it is the registry change above, and it can be done before or
after the data moves, because until the registry names Unchained's new project
the panel keeps talking to the old one exactly as it does today.

---

## 6. Doing this again for the next site

For Frito, or whatever follows:

1. Its own Supabase project. Not a schema here, not a `product_id` here.
2. Its own `supabase/migrations`, starting with its own foundation migration —
   `20260905000001_unchained_foundation.sql` is the template, and the parts
   worth copying are the hardened `is_super_admin()`, the RLS-on assertions,
   and the check that `platform_products` holds exactly one row.
3. Its own sending domain and API key.
4. **One new row in the panel's property registry** — id, name, base path, URL
   and anon key. Not a new admin app: the command centre fronts every property
   through its own client, and adding one is configuration. See §5.
5. Its own service-role key, which grants nothing anywhere else. That last
   property is the one that makes all of this worth the duplication.

The thing to resist is the shortcut that created this situation: adding a table
prefix and a product column to a database that already exists, because it is
half an hour instead of half a day. It is half a day, and then it is a support
conversation about an email address that was never registered.
