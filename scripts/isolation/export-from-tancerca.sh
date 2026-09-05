#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
# Step 1 of the isolation cutover — export Unchained's data OUT of TanCerca
# ════════════════════════════════════════════════════════════
# Reads the OLD (shared) Supabase project and writes one portable SQL file
# containing every row Unchained owns. Read-only: this script does not modify
# the source database in any way. Decommissioning the old copy is a separate,
# later, deliberate step (decommission-in-tancerca.sql).
#
# ─── What is exported, and in this order ──────────────────────────────────
# The order is the foreign-key order, so the file can be replayed top to bottom
# into an empty database:
#
#   1  unchained_services                (no dependencies)
#   2  commercial_regions
#   3  commercial_contacts               -> auth.users (user_id)
#   4  commercial_contact_regions        -> contacts, regions
#   5  routing_rules                     -> contacts, regions
#   6  unchained_leads                   -> services, contacts
#   7  unchained_lead_events             -> leads, auth.users (actor_id)
#   8  unchained_specialists             -> auth.users (user_id)
#   9  unchained_engagements             -> leads, services, contacts
#  10  unchained_engagement_specialists  -> engagements, specialists
#
# ─── What is deliberately NOT exported ────────────────────────────────────
#   auth.users             Identities are RE-ISSUED, not copied. See below.
#   roles                  TanCerca's operators are not Unchained's.
#   admin_logs             TanCerca's audit trail stays with TanCerca. Its rows
#                          reference admin_ids that will not exist over here,
#                          and an audit record is only meaningful next to the
#                          database whose history it describes.
#   product_memberships    Rebuilt by re-inviting each person (step 4 of the
#                          runbook), because a membership names a user_id.
#   unchained_lead_throttle
#                          Rate-limit buckets. Transient by design; carrying
#                          them over would import a stale window and nothing
#                          else.
#
# ─── Why identities are re-issued rather than copied ──────────────────────
# Copying auth.users between projects means copying password hashes, identity
# rows, refresh tokens and MFA factors across a trust boundary that this whole
# exercise exists to create. It is also the one thing that would carry the
# original defect over: the addresses in TanCerca's auth.users include its
# CUSTOMERS, and importing them would recreate, in the new database, exactly
# the collision that made "this email is already registered" appear.
#
# So user_id is dropped on the way in (post-import.sql sets it NULL) and each
# member is re-invited from the new panel. The invite path already matches a
# roster row by email and links it to the new account — the migration of
# identity IS the existing re-invite path, which means it is a path that is
# already tested rather than a one-off script.
#
# ─── Usage ────────────────────────────────────────────────────────────────
#   export TANCERCA_DB_URL='postgresql://postgres.<ref>:<pw>@<host>:5432/postgres'
#   bash scripts/isolation/export-from-tancerca.sh
#
# The connection string is the one Supabase Studio shows under
# Project Settings -> Database -> Connection string -> URI, for the OLD
# project (jkjsjojwlrzpcpggqgws). Use the direct connection on port 5432, not
# the transaction pooler on 6543: pg_dump needs session-level features the
# transaction pooler does not provide.
#
# Requires pg_dump 15 or newer, matching the server major version.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/isolation/_pg.sh
source "${HERE}/_pg.sh"

# Connection strings live in a gitignored file rather than in the shell, so a
# password is never typed into a terminal that keeps history and never sits in
# an environment other processes can read. cutover.env.example documents it.
if [[ -f "${HERE}/cutover.env" ]]; then
  # shellcheck disable=SC1091
  source "${HERE}/cutover.env"
fi

OUT_DIR="${OUT_DIR:-scripts/isolation/out}"
OUT_FILE="${OUT_DIR}/unchained-data.sql"

if [[ -z "${TANCERCA_DB_URL:-}" ]]; then
  cat >&2 <<MSG
TANCERCA_DB_URL is not set.

Copy ${HERE}/cutover.env.example to ${HERE}/cutover.env and fill it in, or
export it for this shell:

  export TANCERCA_DB_URL='postgresql://postgres.<ref>:<pw>@<host>:5432/postgres'

Use the DIRECT connection on port 5432 (Studio -> Project Settings -> Database
-> Connection string -> URI), not the transaction pooler on 6543: pg_dump needs
session-level features the pooler does not provide.
MSG
  exit 1
fi

pg_tools_check || exit 1

mkdir -p "$OUT_DIR"

# --column-inserts, not COPY:
#   · the file stays readable and reviewable before it is replayed into a new
#     production database, which is the point of a cutover you can inspect;
#   · a column list means a later column added on either side does not silently
#     shift a value into the wrong field.
# It is slower and larger than COPY. At the size of an agency roster and its
# lead history that does not matter, and being able to read the file does.
#
# --no-owner / --no-privileges: ownership and grants are established by the
# migrations in the target project, not carried over from this one.
pg_dump_run "$TANCERCA_DB_URL" \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  --table=public.unchained_services \
  --table=public.commercial_regions \
  --table=public.commercial_contacts \
  --table=public.commercial_contact_regions \
  --table=public.routing_rules \
  --table=public.unchained_leads \
  --table=public.unchained_lead_events \
  --table=public.unchained_specialists \
  --table=public.unchained_engagements \
  --table=public.unchained_engagement_specialists \
  > "$OUT_FILE"

echo "Wrote $OUT_FILE"
echo
echo "Row counts in the export:"
grep -c '^INSERT INTO public.unchained_services'               "$OUT_FILE" | sed 's/^/  unchained_services              /' || true
grep -c '^INSERT INTO public.commercial_regions'               "$OUT_FILE" | sed 's/^/  commercial_regions              /' || true
grep -c '^INSERT INTO public.commercial_contacts'              "$OUT_FILE" | sed 's/^/  commercial_contacts             /' || true
grep -c '^INSERT INTO public.commercial_contact_regions'       "$OUT_FILE" | sed 's/^/  commercial_contact_regions      /' || true
grep -c '^INSERT INTO public.routing_rules'                    "$OUT_FILE" | sed 's/^/  routing_rules                   /' || true
grep -c '^INSERT INTO public.unchained_leads'                  "$OUT_FILE" | sed 's/^/  unchained_leads                 /' || true
grep -c '^INSERT INTO public.unchained_lead_events'            "$OUT_FILE" | sed 's/^/  unchained_lead_events           /' || true
grep -c '^INSERT INTO public.unchained_specialists'            "$OUT_FILE" | sed 's/^/  unchained_specialists           /' || true
grep -c '^INSERT INTO public.unchained_engagements'            "$OUT_FILE" | sed 's/^/  unchained_engagements           /' || true
grep -c '^INSERT INTO public.unchained_engagement_specialists' "$OUT_FILE" | sed 's/^/  unchained_engagement_specialists/' || true
echo
echo "Read the file before replaying it. Next: scripts/isolation/import-into-unchained.sh"
