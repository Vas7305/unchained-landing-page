#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
# Step 2 of the isolation cutover — replay Unchained's data into its own project
# ════════════════════════════════════════════════════════════
# Runs against the NEW project, after `supabase db push` has applied every
# migration in supabase/migrations. Loads the export produced by
# export-from-tancerca.sh, then runs post-import.sql.
#
# ─── Why triggers are disabled for the load ───────────────────────────────
# The Unchained schema defends itself with triggers, and every one of them is
# correct for a live write and wrong for a replay of rows that were already
# validated when they were first written:
#
#   unchained_guard_commission_rate     refuses a rate change from a caller who
#                                       is not a super_admin. A psql session has
#                                       no auth.uid() at all, so the UPDATE
#                                       branch fails closed.
#   unchained_engagement_default_rate   fills a NULL rate from the commercial.
#                                       Harmless on INSERT, but it is a write we
#                                       do not want deciding anything during a
#                                       migration.
#   unchained_leads_before_update       stamps first_contact_at / converted_at
#                                       on a status change. A replayed lead
#                                       already carries its real timestamps.
#   *_touch_updated_at                  would rewrite updated_at to now() and
#                                       erase when each row was actually last
#                                       touched.
#
# DISABLE TRIGGER USER leaves foreign keys and CHECK constraints fully active —
# those are constraints, not user triggers. So the load is still refused if the
# data does not hold together, which is exactly the part we want enforced.
#
# Requires the connection to be made as the table owner (the `postgres` role in
# the URI Supabase gives you). ALTER TABLE ... DISABLE TRIGGER is an owner
# operation; the service_role key cannot do it over PostgREST, which is why
# this step is psql and not an API call.
#
# ─── Usage ────────────────────────────────────────────────────────────────
#   export UNCHAINED_DB_URL='postgresql://postgres.<new-ref>:<pw>@<host>:5432/postgres'
#   bash scripts/isolation/import-into-unchained.sh
#
# Idempotent only in the sense that it is wrapped in a single transaction: if
# anything fails, nothing is committed and you can fix and re-run. Running it
# twice on a successful load will fail on the primary keys, which is the
# correct outcome — it means the data is already there.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/isolation/_pg.sh
source "${HERE}/_pg.sh"

if [[ -f "${HERE}/cutover.env" ]]; then
  # shellcheck disable=SC1091
  source "${HERE}/cutover.env"
fi

IN_FILE="${IN_FILE:-scripts/isolation/out/unchained-data.sql}"
POST="${HERE}/post-import.sql"

if [[ -z "${UNCHAINED_DB_URL:-}" ]]; then
  cat >&2 <<MSG
UNCHAINED_DB_URL is not set.

Copy ${HERE}/cutover.env.example to ${HERE}/cutover.env and fill it in, or
export it for this shell:

  export UNCHAINED_DB_URL='postgresql://postgres.<new-ref>:<pw>@<host>:5432/postgres'
MSG
  exit 1
fi

[[ -f "$IN_FILE" ]] || { echo "No export at $IN_FILE. Run export-from-tancerca.sh first." >&2; exit 1; }
[[ -f "$POST"    ]] || { echo "Missing $POST" >&2; exit 1; }

pg_tools_check || exit 1

TABLES=(
  unchained_services
  commercial_regions
  commercial_contacts
  commercial_contact_regions
  routing_rules
  unchained_leads
  unchained_lead_events
  unchained_specialists
  unchained_engagements
  unchained_engagement_specialists
)

# The whole load is assembled as ONE stream on stdin rather than a file psql
# opens itself. Two reasons, and the second is the one that matters here:
#
#   · `\i` resolves paths relative to psql's working directory, which is not
#     this machine's when psql is running inside a container;
#   · a single stream needs nothing mounted, so the Docker fallback in _pg.sh
#     works with no bind mount and no MSYS path translation to get wrong.
#
# ON_ERROR_STOP is passed as a flag rather than a `\set`, so it is in force for
# the very first statement, and one explicit transaction makes the load
# all-or-nothing. Without both, psql would carry on after a failed INSERT and
# leave a half-migrated database that looks like it worked.
{
  echo "BEGIN;"
  for t in "${TABLES[@]}"; do
    echo "ALTER TABLE public.${t} DISABLE TRIGGER USER;"
  done

  cat "$IN_FILE"

  # post-import.sql runs BEFORE the triggers come back, and it has to.
  # It UPDATEs unchained_lead_events to clear actor_id, and that table carries
  # trg_unchained_lead_events_append_only — a BEFORE UPDATE OR DELETE trigger
  # that raises unconditionally. With the triggers already re-enabled, the one
  # statement that severs the old project's identities would be refused by the
  # rule that protects the audit trail, and the whole transaction would roll
  # back. Severing them is part of the load, not an edit to loaded data.
  cat "$POST"

  for t in "${TABLES[@]}"; do
    echo "ALTER TABLE public.${t} ENABLE TRIGGER USER;"
  done
  echo "COMMIT;"
} | psql_stdin "$UNCHAINED_DB_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1

echo
echo "Import committed. Next: bootstrap the first super_admin, then re-invite"
echo "every commercial and specialist from the panel so their user_id is linked."
echo "See docs/database-isolation.md, steps 5 and 6."
