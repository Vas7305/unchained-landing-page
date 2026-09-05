#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════
Move Unchained's rows from TanCerca's project into its own — over HTTPS
════════════════════════════════════════════════════════════

Replaces the pg_dump/psql pair for a machine that has neither. It talks to
PostgREST with each project's service_role key, so the only requirement is
network access: no Docker, no WSL, no PostgreSQL install, no admin rights and
no reboot.

─── Why this exists instead of export-from-tancerca.sh ─────────────────────
Docker Desktop is installed on this machine but its daemon cannot start: WSL is
present as an app (2.7.12) while the Windows optional component it needs is not
enabled, so `docker info` fails with WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED.
Enabling it needs administrator rights and a reboot. The shell scripts remain
correct and are the better tool on a machine that has psql — this is the path
that works here, today, without asking anybody to restart their computer.

─── Why it is safe to insert with the triggers left ON ─────────────────────
The shell version disables user triggers for the load. That is impossible over
PostgREST, and it turns out to be unnecessary. Every trigger on these tables
was read before this script was written:

  *_touch_updated_at                BEFORE UPDATE only. An INSERT keeps the
                                    created_at/updated_at values we send.
  unchained_leads_before_update     UPDATE only.
  unchained_engagements_before_update  UPDATE only.
  unchained_lead_events_append_only BEFORE UPDATE OR DELETE. INSERT is the one
                                    thing it permits.
  unchained_guard_commission_rate   Its INSERT branch explicitly allows a
                                    caller with no auth.uid() — which is what
                                    service_role is — precisely so the invite
                                    path can create a member with an agreed
                                    rate. A bulk load takes the same door.
  unchained_engagement_default_rate  `IF NEW.commercial_rate IS NULL`. Never
  unchained_assignment_default_rate  `IF NEW.rate IS NULL`. Never overwrites a
                                    value that is already set.

Foreign keys and CHECK constraints stay fully enforced throughout, which is the
part worth keeping: the load is refused if the data does not hold together.

─── Identities are dropped, not written and then erased ────────────────────
Three columns hold a UUID naming a row in the OLD project's auth.users:

    commercial_contacts.user_id
    unchained_specialists.user_id
    unchained_lead_events.actor_id

The shell version imported them and then NULLed them, which needed the
append-only trigger switched off. Here they are simply never sent. That is
strictly better: the values do not exist in the new database for an instant,
and no UPDATE has to be permitted to remove them.

The first two are re-established by re-inviting each person from the panel;
create-unchained-member matches the roster row by email and writes the new
user_id into it. actor_id is deliberately NOT rebuilt — it records who did
something in a database that no longer exists, and inventing a mapping would be
fabricating audit history.

─── Usage ──────────────────────────────────────────────────────────────────
    python scripts/isolation/migrate-data.py export
    #   ... read scripts/isolation/out/unchained-data.json ...
    python scripts/isolation/migrate-data.py import
    python scripts/isolation/migrate-data.py verify

Two phases on purpose. The export is read-only and writes a file you can open
and check before anything is written anywhere — the same review point the shell
version had, and the only moment the data is visible in a form a person can
actually inspect.

Credentials come from scripts/isolation/cutover.env (gitignored).
"""

import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "out")
DATA_FILE = os.path.join(OUT_DIR, "unchained-data.json")

# Foreign-key order. The import walks this list forwards, so a row is never
# inserted before the row it references.
#
# Deliberately absent:
#   unchained_lead_throttle  rate-limit buckets, transient by design
#   admin_logs               TanCerca's audit trail stays with TanCerca; its
#                            rows name admin_ids that do not exist over here
#   product_memberships      rebuilt by re-inviting, because it names a user_id
#   roles, auth.users        identities are re-issued, never copied
TABLES = [
    "unchained_services",
    "commercial_regions",
    "commercial_contacts",
    "commercial_contact_regions",
    "routing_rules",
    "unchained_leads",
    "unchained_lead_events",
    "unchained_specialists",
    "unchained_engagements",
    "unchained_engagement_specialists",
]

# Columns naming a row in the OLD project's auth.users. Never carried across.
DROP_COLUMNS = {
    "commercial_contacts": ["user_id"],
    "unchained_specialists": ["user_id"],
    "unchained_lead_events": ["actor_id"],
}

PAGE = 1000        # PostgREST's default ceiling on rows per response
INSERT_BATCH = 200  # small enough that one failure names a readable set of rows


# ─── Credentials ────────────────────────────────────────────────────────────

def load_env():
    """Read cutover.env — KEY='value' or KEY=value, # comments, blank lines."""
    path = os.path.join(HERE, "cutover.env")
    if not os.path.exists(path):
        die(
            "No credentials.\n\n"
            "  cp scripts/isolation/cutover.env.example scripts/isolation/cutover.env\n\n"
            "then fill in the two service_role keys. The file is gitignored."
        )
    env = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
            if not m:
                continue
            value = m.group(2).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
                value = value[1:-1]
            env[m.group(1)] = value
    return env


def project(env, prefix, label):
    url = env.get(prefix + "_URL", "").rstrip("/")
    key = env.get(prefix + "_SERVICE_ROLE_KEY", "")
    if not url or not key:
        die(
            "%s is not configured. cutover.env needs:\n"
            "  %s_URL\n  %s_SERVICE_ROLE_KEY" % (label, prefix, prefix)
        )
    is_service_role = False
    if key.startswith("sb_secret"):
        is_service_role = True
    elif key.startswith("eyJ") and "." in key:
        try:
            parts = key.split(".")
            pad = parts[1] + "=" * (-len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(pad.encode("ascii")))
            if payload.get("role") == "service_role":
                is_service_role = True
        except Exception:
            pass
    elif "service_role" in key:
        is_service_role = True

    if not is_service_role:
        # An anon/publishable key here would silently return zero rows on every
        # table — RLS refuses it — and that looks exactly like "there was no
        # data to migrate". Better to refuse than to report an empty success.
        die(
            "%s_SERVICE_ROLE_KEY does not look like a service-role key.\n"
            "The anon/publishable key cannot read these tables: RLS would return\n"
            "an empty list for every one of them, which is indistinguishable from\n"
            "a database that had nothing in it. Get the service_role (or\n"
            "sb_secret_...) key from Project Settings -> API Keys." % prefix
        )
    return {"url": url, "key": key, "label": label}


def die(msg):
    sys.stderr.write("\n" + msg + "\n\n")
    sys.exit(1)


# ─── HTTP ───────────────────────────────────────────────────────────────────

def request(proj, method, path, body=None, extra_headers=None):
    url = proj["url"] + "/rest/v1/" + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": proj["key"],
        "Authorization": "Bearer " + proj["key"],
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else []
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:600]
        die("%s %s -> HTTP %s\n%s" % (method, path, exc.code, detail))
    except urllib.error.URLError as exc:
        die("Could not reach %s: %s" % (proj["label"], exc))


def fetch_all(proj, table):
    """Every row, paged. Ordered by id so paging is stable under concurrent writes."""
    rows, offset = [], 0
    while True:
        page = request(
            proj,
            "GET",
            "%s?select=*&order=id.asc&limit=%d&offset=%d" % (table, PAGE, offset),
        )
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        offset += PAGE


# ─── Phases ─────────────────────────────────────────────────────────────────

def do_export(env):
    src = project(env, "TANCERCA", "TanCerca (source)")
    os.makedirs(OUT_DIR, exist_ok=True)

    payload, total = {}, 0
    print("Reading from %s\n" % src["url"])
    for table in TABLES:
        rows = fetch_all(src, table)
        dropped = DROP_COLUMNS.get(table, [])
        for row in rows:
            for column in dropped:
                row.pop(column, None)
        payload[table] = rows
        total += len(rows)
        note = ("  (dropped %s)" % ", ".join(dropped)) if dropped and rows else ""
        print("  %-34s %5d%s" % (table, len(rows), note))

    with open(DATA_FILE, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False, sort_keys=True)

    print("\n%d rows -> %s" % (total, DATA_FILE))
    print("\nNothing has been written to the new project. Read that file, then:")
    print("  python scripts/isolation/migrate-data.py import")


def do_import(env):
    dst = project(env, "UNCHAINED", "Unchained (target)")
    if not os.path.exists(DATA_FILE):
        die("No export at %s. Run the export phase first." % DATA_FILE)

    with open(DATA_FILE, encoding="utf-8") as fh:
        payload = json.load(fh)

    print("Writing to %s\n" % dst["url"])
    total = 0
    for table in TABLES:
        rows = payload.get(table, [])
        if not rows:
            print("  %-34s     0  (skipped)" % table)
            continue
        # Rows go in FK order and in batches; a batch is one request and one
        # transaction, so a constraint violation rejects that batch whole
        # rather than leaving half of it behind.
        for start in range(0, len(rows), INSERT_BATCH):
            request(
                dst,
                "POST",
                table,
                body=rows[start:start + INSERT_BATCH],
                extra_headers={"Prefer": "return=minimal,resolution=merge-duplicates"},
            )
        total += len(rows)
        print("  %-34s %5d" % (table, len(rows)))

    print("\n%d rows written." % total)
    print("\nEvery commercial and specialist has user_id = NULL and cannot sign in")
    print("until they are re-invited from the panel. See docs/database-isolation.md")
    print("step 6. Then: python scripts/isolation/migrate-data.py verify")


def do_verify(env):
    src = project(env, "TANCERCA", "TanCerca (source)")
    dst = project(env, "UNCHAINED", "Unchained (target)")

    def count(proj, table):
        # HEAD with count=exact returns the total in Content-Range without
        # transferring any rows.
        url = proj["url"] + "/rest/v1/%s?select=id" % table
        req = urllib.request.Request(
            url,
            headers={
                "apikey": proj["key"],
                "Authorization": "Bearer " + proj["key"],
                "Prefer": "count=exact",
                "Range": "0-0",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                rng = resp.headers.get("Content-Range", "")
                return int(rng.split("/")[-1]) if "/" in rng else -1
        except urllib.error.HTTPError as exc:
            return "HTTP %s" % exc.code

    print("%-34s %8s %8s" % ("table", "source", "target"))
    print("-" * 52)
    ok = True
    for table in TABLES:
        a, b = count(src, table), count(dst, table)
        flag = "" if a == b else "   <-- MISMATCH"
        if a != b:
            ok = False
        print("%-34s %8s %8s%s" % (table, a, b, flag))
    print("\n%s" % ("Counts match." if ok else "Counts differ — do not proceed to step 7."))
    sys.exit(0 if ok else 1)


def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else ""
    if phase not in ("export", "import", "verify"):
        die("Usage: python scripts/isolation/migrate-data.py export|import|verify")
    env = load_env()
    {"export": do_export, "import": do_import, "verify": do_verify}[phase](env)


if __name__ == "__main__":
    main()
