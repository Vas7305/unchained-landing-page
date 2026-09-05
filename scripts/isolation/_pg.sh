# shellcheck shell=bash
# ════════════════════════════════════════════════════════════
# Running psql and pg_dump without installing PostgreSQL
# ════════════════════════════════════════════════════════════
# Sourced by export-from-tancerca.sh and import-into-unchained.sh.
#
# The cutover needs two tools this machine does not have on PATH. It does have
# Docker, and the official postgres image carries both, so there is no reason to
# make installing a database server a prerequisite for moving some rows.
#
# ─── Why the version is pinned, and pinned HIGH ───────────────────────────
# pg_dump refuses to dump from a server newer than itself:
#
#     pg_dump: error: server version: 17.6; pg_dump version: 15.x
#     pg_dump: error: aborting because of server version mismatch
#
# Supabase is on 17.6 (TanCerca's supabase/.temp/postgres-version). PG_MAJOR
# must therefore be >= the server's major, and matching it exactly is the
# version whose output is guaranteed to restore cleanly. Override it if
# Supabase moves on:
#
#     PG_MAJOR=18 bash scripts/isolation/export-from-tancerca.sh
#
# ─── Why nothing is mounted into the container ────────────────────────────
# Every path stays on the host: pg_dump writes to stdout and the host redirects
# it, psql reads the script from stdin. That is not only simpler than a bind
# mount — it sidesteps MSYS path translation on Windows, where a container path
# like /work gets rewritten to C:/Program Files/Git/work and the failure is
# baffling.

PG_MAJOR="${PG_MAJOR:-17}"
PG_IMAGE="${PG_IMAGE:-postgres:${PG_MAJOR}-alpine}"

# Prefer a native binary when one exists — it is faster, and somebody who
# installed the client tools deliberately should get them.
_pg_native() { command -v "$1" >/dev/null 2>&1; }

_pg_docker_ready() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

pg_tools_check() {
  if _pg_native pg_dump && _pg_native psql; then
    echo "Using native PostgreSQL client tools ($(pg_dump --version | awk '{print $3}'))." >&2
    return 0
  fi
  if _pg_docker_ready; then
    echo "psql/pg_dump not on PATH — using Docker image ${PG_IMAGE}." >&2
    return 0
  fi
  cat >&2 <<'MSG'
Neither the PostgreSQL client tools nor a running Docker daemon is available.

  · Docker Desktop running is enough — nothing else to install.
  · Or install the client tools (PostgreSQL 17+) and put psql and pg_dump
    on PATH.

pg_dump must be at least as new as the server (Supabase is on 17.6); an older
one aborts with a "server version mismatch" rather than producing a partial
dump.
MSG
  return 1
}

# pg_dump_run <connection-url> [args...]   -> dump on stdout
pg_dump_run() {
  local url="$1"; shift
  if _pg_native pg_dump; then
    pg_dump "$url" "$@"
  else
    # No TTY, no mounts. The URL is passed as an argument rather than through
    # the environment so it never lands in `docker inspect` output of a
    # long-lived container — this one exits immediately either way.
    MSYS_NO_PATHCONV=1 docker run --rm "$PG_IMAGE" pg_dump "$url" "$@"
  fi
}

# psql_stdin <connection-url> [args...]    -> SQL on stdin, output on stdout
psql_stdin() {
  local url="$1"; shift
  if _pg_native psql; then
    psql "$url" "$@"
  else
    MSYS_NO_PATHCONV=1 docker run --rm -i "$PG_IMAGE" psql "$url" "$@"
  fi
}
