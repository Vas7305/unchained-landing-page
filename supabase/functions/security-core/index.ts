import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ════════════════════════════════════════════════════════════
// security-core
// ════════════════════════════════════════════════════════════
// The ingestion boundary of the Unchained Security & Audit Core.
//
// Canonical contract: docs/security/SECURITY_EVENT_CONTRACT_V1.md
// Schema and enforcement: supabase/migrations/20260914000001_unchained_security_core.sql
//
// ─── What this function is for ────────────────────────────────────────────
// TanCerca and Frito run on their own isolated Supabase projects. They hold no
// session in the Unchained project and cannot call a PostgREST RPC as an
// authenticated user, so §41's "applications MUST authenticate with the
// Security Core" needs a door that is not a user session. This is that door,
// and an application key is what it accepts.
//
// It is deliberately NOT the only way in. Code that already holds a session
// here — the Admin Panel, Unchained's own server code — calls the
// `security_ingest_event` RPC directly and never touches this function.
// Proxying an authenticated caller through an edge function would add a hop
// and a second authorization implementation, and §2 asks for neither.
//
// ─── What this function does NOT do ───────────────────────────────────────
// It does not validate events. It does not decide which application an event
// belongs to. It does not assign timestamps, actors or identifiers.
//
// All of that is in the database, in security_ingest_as_application() and
// security_write_event(), and that is the entire security argument of this
// file: what arrives here is untrusted, what leaves here is untrusted, and the
// only thing this code is trusted to do is hash a key and pass a blob along.
// A bug in this file cannot forge an application, backdate an event or store a
// secret, because it is not the thing that decides any of those.
//
// ─── Why the key is hashed HERE and not in Postgres ───────────────────────
// So that the plaintext key never becomes a query parameter. A key sent to the
// database as an argument would appear in `pg_stat_statements`, in a slow
// query log, and in any error that echoed the statement. SHA-256 happens in
// this process and only the digest crosses the wire — the same reasoning
// admin-core applies to invitation tokens.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-security-application-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Admin = ReturnType<typeof createClient>

type Action = "ingest_event" | "mint_application_key" | "revoke_application_key"

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * A new application key: 32 bytes from the platform CSPRNG, base64url.
 *
 * Prefixed `usk_` — Unchained Security Key — so that a key found loose in a
 * config file, a log or a paste is immediately identifiable as what it is.
 * The same reasoning Stripe and GitHub apply to their own prefixes, and it is
 * what lets `security_prohibited_value()` learn to recognize one later.
 */
function mintApplicationKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const body = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  return `usk_${body}`
}

// ─── Error mapping (brief §28) ──────────────────────────────────────────────
// Errors reaching a client must not expose database internals, SQL, stack
// traces or authentication internals.
//
// The database raises exactly three shapes on purpose, and each maps to one
// status and one short sentence:
//
//   security_core_invalid_event:<reason>  -> 400, with the reason. It names a
//                                            FIELD, never a value, and it is
//                                            what an integrating developer
//                                            needs to fix their payload.
//   security_core_unauthorized            -> 401
//   security_core_forbidden               -> 403
//   security_core_ingestion_disabled      -> 503
//
// Anything else is an infrastructure failure. The caller is told "the event
// was not recorded" and nothing more; the detail goes to the function log,
// where an operator can see it and an attacker cannot.

function refusalFor(message: string): Response | null {
  if (message.includes("security_core_invalid_event:")) {
    const reason = message.split("security_core_invalid_event:")[1]?.split("\n")[0]?.trim()
    return json({ error: "invalid_event", reason: reason ?? "unspecified" }, 400)
  }
  if (message.includes("security_core_unauthorized")) {
    return json({ error: "unauthorized" }, 401)
  }
  if (message.includes("security_core_forbidden")) {
    return json({ error: "forbidden" }, 403)
  }
  if (message.includes("security_core_ingestion_disabled")) {
    return json({ error: "ingestion_disabled" }, 503)
  }
  return null
}

/**
 * Record one event on behalf of an application.
 *
 * ─── The observability rule that shapes the catch (brief §27) ─────────────
 * A failed ingestion is reported to the caller and written to THIS FUNCTION'S
 * log. It is never turned into a security event, because a security event
 * about a failure to store security events would be attempted through the same
 * path that just failed — ingest fails, emit an event about it, that ingest
 * fails, emit an event about THAT. Infrastructure failures belong in the
 * platform's own logging, which is a different system by construction.
 */
async function ingestEvent(
  admin: Admin,
  presentedKey: string | null,
  event: unknown,
): Promise<Response> {
  if (!presentedKey) {
    return json({ error: "unauthorized" }, 401)
  }

  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return json({ error: "invalid_event", reason: "event must be a JSON object" }, 400)
  }

  const keyHash = await sha256Hex(presentedKey)

  const { data, error } = await admin.rpc("security_ingest_as_application", {
    p_key_hash: keyHash,
    p_event: event,
  })

  if (error) {
    const refusal = refusalFor(error.message ?? "")
    if (refusal) return refusal

    // Infrastructure. Logged here, opaque to the caller.
    console.error("[security-core] ingestion failed:", error.message)
    return json({ error: "ingestion_failed" }, 500)
  }

  // The RPC returns a one-row table: { id, occurred_at }.
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) {
    console.error("[security-core] ingestion returned no identifier")
    return json({ error: "ingestion_failed" }, 500)
  }

  // §8.1: a stable event identifier, returned so the caller can reference the
  // event it just wrote.
  return json({ id: row.id, occurred_at: row.occurred_at }, 201)
}

/**
 * The caller, if and only if they are this installation's Super Admin.
 *
 * Lifted from admin-core, unchanged and for the same reason: public.roles is
 * read with the service-role client because public.is_super_admin() has
 * EXECUTE revoked from `authenticated` and cannot be called from a user-scoped
 * client.
 *
 * Key management is Super-Admin-only. An application key is a credential that
 * writes into the audit trail of a named application, and issuing one is not
 * something a delegated administrator of that application should be able to do
 * for themselves.
 */
async function requireSuperAdmin(
  req: Request,
  admin: Admin,
): Promise<{ actor: string } | { refusal: Response }> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return { refusal: json({ error: "unauthorized" }, 401) }

  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user: caller } } = await asCaller.auth.getUser()
  if (!caller) return { refusal: json({ error: "unauthorized" }, 401) }

  const { data: role } = await admin
    .from("roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "super_admin")
    .maybeSingle()

  if (!role) {
    // A refused administrative action is itself a security event, and this one
    // IS safe to record: it is not an ingestion failure, so recording it
    // cannot recurse.
    await admin.rpc("admin_core_log_event", {
      p_action: "ADMIN_ACCESS_DENIED",
      p_result: "DENIED",
      p_application: null,
      p_target: null,
      p_metadata: { reason: "not_super_admin", surface: "security-core" },
      p_severity: "warning",
      p_actor: caller.id,
    })
    return { refusal: json({ error: "forbidden" }, 403) }
  }

  return { actor: caller.id }
}

/**
 * Issue an application key.
 *
 * ─── The plaintext is returned exactly once ───────────────────────────────
 * It is not stored, not logged and not recoverable. An operator who loses it
 * mints a new one, which is a two-line operation; making it recoverable would
 * mean storing it, which would make a dump of the table a set of working
 * credentials for every application's audit trail.
 */
async function mintKey(
  admin: Admin,
  actor: string,
  payload: { application?: unknown; environment?: unknown; label?: unknown; expires_at?: unknown },
): Promise<Response> {
  const application = typeof payload.application === "string" ? payload.application : null
  const environment = typeof payload.environment === "string" ? payload.environment : null
  const label = typeof payload.label === "string" ? payload.label.trim() : ""

  if (!application || !environment || !label) {
    return json({ error: "invalid_request", reason: "application, environment and label are required" }, 400)
  }

  const key = mintApplicationKey()
  const keyHash = await sha256Hex(key)
  // Enough to identify the key in a config file, far too little to use.
  const keyPrefix = key.slice(4, 14)

  const { data, error } = await admin
    .from("security_application_keys")
    .insert({
      application_id: application,
      environment,
      label,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      created_by: actor,
      expires_at: typeof payload.expires_at === "string" ? payload.expires_at : null,
    })
    .select("id")
    .single()

  if (error) {
    // A foreign-key or CHECK violation here means the application or the
    // environment is not one the registry knows. That is the caller's mistake
    // and is worth naming, without quoting the database back at them.
    console.error("[security-core] key creation failed:", error.message)
    return json(
      { error: "invalid_request", reason: "unknown application or environment" },
      400,
    )
  }

  await admin.rpc("admin_core_log_event", {
    p_action: "ADMIN_CONFIGURATION_CHANGED",
    p_result: "SUCCESS",
    p_application: application,
    p_target: null,
    p_metadata: {
      change: "security_application_key_issued",
      key_id: data.id,
      key_prefix: keyPrefix,
      environment,
      label,
    },
    p_severity: "critical",
    p_actor: actor,
  })

  return json({ id: data.id, key, key_prefix: keyPrefix }, 201)
}

/** Revoke a key. Revoked is a status, never a delete: the history stays. */
async function revokeKey(
  admin: Admin,
  actor: string,
  payload: { key_id?: unknown; reason?: unknown },
): Promise<Response> {
  const keyId = typeof payload.key_id === "string" ? payload.key_id : null
  if (!keyId) {
    return json({ error: "invalid_request", reason: "key_id is required" }, 400)
  }

  const { data, error } = await admin
    .from("security_application_keys")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: typeof payload.reason === "string" ? payload.reason : null,
    })
    .eq("id", keyId)
    .eq("status", "active")
    .select("id, application_id, key_prefix")
    .maybeSingle()

  if (error) {
    console.error("[security-core] key revocation failed:", error.message)
    return json({ error: "revocation_failed" }, 500)
  }
  if (!data) {
    return json({ error: "not_found" }, 404)
  }

  await admin.rpc("admin_core_log_event", {
    p_action: "ADMIN_CONFIGURATION_CHANGED",
    p_result: "SUCCESS",
    p_application: data.application_id,
    p_target: null,
    p_metadata: {
      change: "security_application_key_revoked",
      key_id: data.id,
      key_prefix: data.key_prefix,
    },
    p_severity: "critical",
    p_actor: actor,
  })

  return json({ success: true }, 200)
}

// ─── The dispatcher ─────────────────────────────────────────────────────────
// Two authorization models, split by action, and the split is the first thing
// the function does:
//
//   ingest_event                 an application key. No session, by design.
//   mint/revoke_application_key  a Super Admin session. No key will do.
//
// An unknown action is refused rather than defaulted, so a typo is a 400 and
// never an accidental ingestion.

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const payload = await req.json().catch(() => null)
    if (!payload || typeof payload !== "object") {
      return json({ error: "invalid_request", reason: "a JSON body with an `action` is required" }, 400)
    }

    const action = (payload as { action?: Action }).action

    if (action === "ingest_event") {
      return await ingestEvent(
        admin,
        req.headers.get("X-Security-Application-Key"),
        (payload as { event?: unknown }).event,
      )
    }

    const gate = await requireSuperAdmin(req, admin)
    if ("refusal" in gate) return gate.refusal
    const { actor } = gate

    switch (action) {
      case "mint_application_key":
        return await mintKey(admin, actor, payload as Parameters<typeof mintKey>[2])

      case "revoke_application_key":
        return await revokeKey(admin, actor, payload as Parameters<typeof revokeKey>[2])

      default:
        return json({ error: "invalid_request", reason: "unknown action" }, 400)
    }
  } catch (err) {
    // The only place an unexpected throw lands. The detail goes to the
    // function log; the caller gets a status and nothing to work with.
    console.error("[security-core] unhandled error:", err)
    return json({ error: "internal_error" }, 500)
  }
})
