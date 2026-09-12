import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ════════════════════════════════════════════════════════════
// admin-core
// ════════════════════════════════════════════════════════════
// The privileged half of the Unchained Administration Core: every write that
// creates, invites, activates, re-scopes, re-roles, re-pays, suspends or
// revokes a delegated administrator.
//
// ─── Why these writes are here and not in an RPC ──────────────────────────
// Three of them need `service_role`, which no browser session has and no RLS
// policy governs:
//
//   · creating an auth.users account for an invited administrator;
//   · generating the GoTrue link that lets them choose a password;
//   · ending every session an account holds, which is what makes a REVOKE
//     take effect on somebody who is signed in right now.
//
// The rest — status, role, scope, compensation — could have been RPCs gated on
// is_super_admin(). They are here instead so that there is exactly ONE
// privileged writer for the Core, with one authorization gate at the top and
// one audit path at the bottom. Two writers means two places to forget an
// event, and the audit requirement in §23 is not something to spread out.
//
// READS are the opposite: they stay in the database, as SECURITY DEFINER
// functions the panel calls directly (admin_list_administrators,
// admin_role_capabilities, admin_resolve_context). Nothing is gained by
// proxying a read through an edge function, and a lot of latency is lost.
//
// ─── The authorization gate ──────────────────────────────────────────────
// Step 1 of every action except `accept_invitation` resolves the caller from
// their Authorization header and requires a public.roles super_admin row, read
// with the service-role client — the same pattern create-unchained-member
// uses, and for the same reason: public.is_super_admin() has EXECUTE revoked
// from `authenticated` and cannot be called from a user-scoped client.
//
// `accept_invitation` is deliberately unauthenticated. The person accepting an
// invitation has no account yet; what stands in for a session is the one-time
// token, which is verified against a stored SHA-256 hash and consumed
// atomically before anything else happens.
//
// ─── What this function never trusts ─────────────────────────────────────
// The application, the role and the permissions in a request body are inputs
// to a write performed by a super_admin, never claims about the caller. The
// caller's own identity comes from the JWT and from public.roles alone (§24).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// The shared command centre. Same value, and the same reasoning, as
// create-unchained-member: one panel in front of every property, hosted on
// TanCerca's domain for historical reasons, with the databases fully separate.
const ADMIN_PANEL_URL = Deno.env.get("ADMIN_PANEL_URL") || "https://admin.unchainedbusiness.com"
// Where the invitation email points. The page there exchanges the Core's
// one-time token for a GoTrue link; it is not itself an auth landing.
const INVITE_PATH = Deno.env.get("ADMIN_INVITE_PATH") || "/admin-invite"
// Where GoTrue sends the person once the token has been redeemed: /login
// raises its set-password form for `type=invite`, /reset-password is the
// dedicated page for an account that already exists.
const LOGIN_PATH = Deno.env.get("UNCHAINED_REDIRECT_PATH") || "/login"
const PASSWORD_SETUP_PATH = Deno.env.get("UNCHAINED_PASSWORD_SETUP_PATH") || "/reset-password"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "acceso@unchainedbusiness.com"

// How long an invitation lives. Short enough that a link left in an inbox
// stops being a credential, long enough to survive a weekend.
const INVITATION_TTL_HOURS = Number(Deno.env.get("ADMIN_INVITATION_TTL_HOURS") ?? "72")

/** The statuses public.administrators accepts. */
type AdministratorStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED"

type Action =
  | "issue_invitation"
  | "accept_invitation"
  | "set_status"
  | "set_role"
  | "set_application_scope"
  | "set_compensation"

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// ─── The token ──────────────────────────────────────────────────────────────
// 32 bytes from the platform CSPRNG, base64url so it survives a query string
// without escaping. Never stored: what goes into the database is the SHA-256
// hash, which is what the acceptance path looks up. A dump of
// admin_invitations therefore grants nobody anything, and neither does a log
// line that accidentally captures a row.
//
// No salt and no password hash. This is a 256-bit random value, not a
// human-chosen secret: there is no dictionary to attack and no rainbow table
// to build, so a single SHA-256 is the right primitive and bcrypt would only
// add latency to a lookup that has to be exact.

function mintToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Append ?property=unchained so exactly one panel client redeems a hash. */
function panelUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${ADMIN_PANEL_URL}${path}`)
  url.searchParams.set("property", "unchained")
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

const EMAIL_EXISTS_CODES = new Set(["email_exists", "user_already_exists"])

/**
 * Whether GoTrue is saying "that address already has an account".
 *
 * Matched on the error code first and the message only as a fallback, so a
 * GoTrue release that rewords the string does not turn a re-invite into a hard
 * failure. Lifted from create-unchained-member, where the listUsers() version
 * of this check caused a real incident once the project passed 50 accounts.
 */
function isAlreadyRegistered(error: { code?: string; message?: string }): boolean {
  if (error.code && EMAIL_EXISTS_CODES.has(error.code)) return true
  return /already (been )?registered|already exists/i.test(error.message ?? "")
}

// ─── The invitation email ───────────────────────────────────────────────────
// Spanish, like every other message this system sends, and every string a
// recipient reads lives in this one function.
//
// It names the application and the role because an administrator invited to
// TanCerca and one invited to Unchained Business receive the same email
// otherwise, and "which of these am I being given" is the first thing the
// recipient needs to know. It does NOT name the salary: compensation is not
// something to put in an inbox.

async function sendInvitationEmail(opts: {
  to: string
  name: string
  applicationName: string
  roleName: string
  inviteLink: string
  expiresAt: Date
  resend: boolean
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping invitation email")
    return
  }

  const hours = Math.max(1, Math.round((opts.expiresAt.getTime() - Date.now()) / 3_600_000))
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu acceso administrativo</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);max-width:600px;">
          <tr>
            <td style="background:#0f172a;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Unchained Business</h1>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Administración</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Hola ${opts.name} 👋</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Se te ha asignado un rol administrativo. Estos son los datos de tu acceso:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#f1f5f9;border-radius:6px;padding:20px;border:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Aplicación</p>
                    <p style="margin:0 0 16px;color:#0f172a;font-size:17px;font-weight:700;">${opts.applicationName}</p>
                    <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Rol</p>
                    <p style="margin:0;color:#0f172a;font-size:17px;font-weight:700;">${opts.roleName}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 32px;color:#475569;font-size:15px;line-height:1.6;">
                Pulsa el botón para activar tu cuenta y crear tu contraseña:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${opts.inviteLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:6px;font-size:15px;font-weight:600;">
                      Activar mi acceso
                    </a>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;line-height:1.5;">
                Si el botón no funciona, copia este enlace en tu navegador:
              </p>
              <p style="margin:0;color:#64748b;font-size:12px;word-break:break-all;line-height:1.4;">
                ${opts.inviteLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.5;">
                Este enlace caduca en ${hours} horas y solo puede usarse una vez.<br />
                Si no esperabas este correo, ignóralo y avisa a tu administrador.<br />
                © 2026 Unchained Business. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      subject: opts.resend
        ? "Tu nuevo enlace de acceso — Unchained Business"
        : "Activa tu acceso administrativo — Unchained Business",
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("Resend error:", body)
    throw new Error(`Email send failed (${res.status})`)
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any

/**
 * Record a security event through the database's own contract.
 *
 * public.admin_core_log_event() writes into public.admin_logs, which is what
 * this project already uses as its security/audit stream (§22). There is no
 * second event table and no direct insert from here: the envelope — actor,
 * target, application, action, result, severity — is assembled in one place,
 * by the function, so every event in the trail has the same shape.
 *
 * `p_actor` is honoured only because this runs as service_role, where
 * auth.uid() is NULL. A session-scoped caller cannot reach the function at
 * all, and would log as itself if it could.
 *
 * Never awaited for correctness: a logging failure is a WARNING inside the
 * function and must not roll back the operation that caused it.
 */
async function logEvent(
  admin: Admin,
  actor: string | null,
  action: string,
  opts: {
    result?: "SUCCESS" | "DENIED" | "FAILURE"
    application?: string | null
    target?: string | null
    metadata?: Record<string, unknown>
    severity?: "info" | "warning" | "critical"
  } = {},
): Promise<void> {
  const { error } = await admin.rpc("admin_core_log_event", {
    p_action: action,
    p_result: opts.result ?? "SUCCESS",
    p_application: opts.application ?? null,
    p_target: opts.target ?? null,
    p_metadata: opts.metadata ?? {},
    p_severity: opts.severity ?? "info",
    p_actor: actor,
  })
  if (error) console.error(`[admin-core] failed to record ${action}:`, error.message)
}

/**
 * The caller, if and only if they are this installation's Super Admin.
 *
 * Returns the user id, or a Response to send back. public.roles is read with
 * the service-role client because public.is_super_admin() is not EXECUTE-able
 * by `authenticated` — the same route create-unchained-member takes.
 */
async function requireSuperAdmin(
  req: Request,
  admin: Admin,
): Promise<{ actor: string } | { refusal: Response }> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return { refusal: json({ error: "No authorization header" }, 401) }

  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user: caller } } = await asCaller.auth.getUser()
  if (!caller) return { refusal: json({ error: "Unauthorized" }, 401) }

  const { data: role } = await admin
    .from("roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "super_admin")
    .maybeSingle()

  if (!role) {
    // §22: a refused administrative action is itself a security event. The
    // actor is known — they authenticated — so it is recordable.
    await logEvent(admin, caller.id, "ADMIN_ACCESS_DENIED", {
      result: "DENIED",
      severity: "warning",
      metadata: { reason: "not_super_admin", surface: "admin-core" },
    })
    return {
      refusal: json({ error: "Only the Super Admin may manage administrators" }, 403),
    }
  }

  return { actor: caller.id }
}

/** An administrator row joined to the names a screen and an email need. */
async function loadAdministrator(admin: Admin, id: string) {
  const { data } = await admin
    .from("administrators")
    .select("id, user_id, name, email, application_slug, role_code, status")
    .eq("id", id)
    .maybeSingle()
  return data as
    | {
        id: string
        user_id: string | null
        name: string
        email: string
        application_slug: string
        role_code: string
        status: AdministratorStatus
      }
    | null
}

// ─── issue_invitation ───────────────────────────────────────────────────────
// Create (or re-invite) an administrator and email them a one-time link.
//
// §15's flow, in order: validate → resolve or create the administrator →
// record the compensation → revoke any live invitation → mint a new one →
// send it. Each step that changes what somebody holds emits its own event, so
// the trail reads as a sequence of decisions rather than one opaque "created".
//
// ─── Re-inviting is a first-class path, not an error ──────────────────────
// The same call resends a link to a PENDING administrator, and reopens a
// REVOKED one. Both are deliberate acts a Super Admin performs from the list
// screen, and both revoke the previous invitation first — so a link sitting in
// an old inbox stops working the moment a new one is sent.
//
// What it never does is change an ACTIVE administrator's role, scope or salary
// as a side effect of resending their link. Those are separate actions with
// separate events, for the same reason create-unchained-member refuses to
// touch a commission rate on a re-invite: a resend is not the moment to
// renegotiate what somebody holds.

interface IssuePayload {
  administrator_id?: string
  name?: string
  email?: string
  phone?: string
  application?: string
  role?: string
  salary_amount?: number
  currency?: string
}

async function issueInvitation(
  admin: Admin,
  actor: string,
  payload: IssuePayload,
): Promise<Response> {
  let administratorId = payload.administrator_id ?? null
  let created = false

  // ─── Resend for an existing administrator ────────────────────────────────
  if (administratorId) {
    const existing = await loadAdministrator(admin, administratorId)
    if (!existing) return json({ error: "Administrator not found" }, 404)
    if (existing.status === "ACTIVE") {
      return json(
        { error: "That administrator is already active. Suspend or revoke them instead of resending a link." },
        409,
      )
    }
    // A revoked administrator being re-invited returns to PENDING. The row,
    // and its history, are the same row.
    if (existing.status !== "PENDING") {
      const { error } = await admin
        .from("administrators")
        .update({ status: "PENDING", status_reason: null, updated_by: actor })
        .eq("id", administratorId)
      if (error) return json({ error: error.message }, 500)
    }
  } else {
    // ─── Create ──────────────────────────────────────────────────────────
    const name = payload.name?.trim()
    const email = payload.email?.trim().toLowerCase()
    const application = payload.application?.trim()
    const role = payload.role?.trim()

    if (!name) return json({ error: "Name is required" }, 400)
    if (!email || !email.includes("@")) return json({ error: "A valid email is required" }, 400)
    // §16: an administrator cannot be created without an application. The
    // schema refuses it too (application_slug is NOT NULL); this is the
    // message a person can act on.
    if (!application) return json({ error: "An application is required" }, 400)
    if (!role) return json({ error: "A role is required" }, 400)

    const { data: app } = await admin
      .from("admin_applications")
      .select("slug, name, status")
      .eq("slug", application)
      .maybeSingle()
    if (!app) return json({ error: `Unknown application "${application}"` }, 400)
    if (app.status !== "active") {
      return json({ error: `The application "${app.name}" is not open for administration` }, 400)
    }

    // A latent role IS assignable — that is the whole point of §17. A disabled
    // one is not.
    const { data: roleRow } = await admin
      .from("admin_roles")
      .select("code, name, status")
      .eq("code", role)
      .maybeSingle()
    if (!roleRow) return json({ error: `Unknown role "${role}"` }, 400)
    if (roleRow.status === "disabled") {
      return json({ error: `The role "${roleRow.name}" is disabled` }, 400)
    }

    // The unique index is (lower(email), application_slug): the same person
    // may administer two properties as two records, but never twice in one.
    const { data: clash } = await admin
      .from("administrators")
      .select("id, status")
      .eq("application_slug", application)
      .ilike("email", email)
      .maybeSingle()

    if (clash) {
      // Refuse BEFORE writing anything. An earlier draft updated the row and
      // then returned 409, which quietly re-roled an active administrator on a
      // request that was being rejected — a write performed by a refusal is
      // the worst kind of side effect.
      if (clash.status === "ACTIVE") {
        return json(
          {
            error:
              "That address already administers this application. Suspend or revoke them instead.",
          },
          409,
        )
      }

      // PENDING, SUSPENDED or REVOKED: re-inviting is a deliberate act, and it
      // may carry a corrected name or a different role. The record, and its
      // history, stay the same record.
      administratorId = clash.id
      const { error } = await admin
        .from("administrators")
        .update({
          name,
          phone: payload.phone?.trim() || null,
          role_code: role,
          status: "PENDING",
          status_reason: null,
          updated_by: actor,
        })
        .eq("id", administratorId)
      if (error) return json({ error: error.message }, 500)
    } else {
      const { data: inserted, error } = await admin
        .from("administrators")
        .insert({
          name,
          email,
          phone: payload.phone?.trim() || null,
          application_slug: application,
          role_code: role,
          status: "PENDING",
          created_by: actor,
          updated_by: actor,
        })
        .select("id")
        .single()
      if (error) return json({ error: error.message }, 500)
      administratorId = inserted.id
      created = true
    }

    if (created) {
      await logEvent(admin, actor, "ADMIN_CREATED", {
        application,
        target: administratorId,
        metadata: { email, role },
      })
    }
    await logEvent(admin, actor, "ADMIN_APPLICATION_ASSIGNED", {
      application,
      target: administratorId,
      metadata: { application },
    })
    await logEvent(admin, actor, "ADMIN_ROLE_ASSIGNED", {
      application,
      target: administratorId,
      metadata: { role },
      severity: "warning",
    })

    // ─── Compensation, when the form carried one ─────────────────────────
    // Optional on purpose: a salary is a decision, and an operator who has not
    // made it yet should not be forced to type a placeholder that later reads
    // as a real figure.
    if (payload.salary_amount !== undefined && payload.salary_amount !== null) {
      const refusal = await setCompensation(admin, actor, {
        administrator_id: administratorId!,
        salary_amount: payload.salary_amount,
        currency: payload.currency,
      })
      if (refusal) return refusal
    }
  }

  return await mintAndSend(admin, actor, administratorId!, created)
}

/**
 * Revoke any live invitation, mint a new one, and send it.
 *
 * The revoke-then-mint order matters and is not merely tidy: admin_invitations
 * carries a partial unique index over pending rows, so a second live
 * invitation for one administrator is impossible by construction. Minting
 * first would fail on that index; revoking first is what makes "resend" mean
 * "the old link is dead".
 */
async function mintAndSend(
  admin: Admin,
  actor: string,
  administratorId: string,
  created: boolean,
): Promise<Response> {
  const administrator = await loadAdministrator(admin, administratorId)
  if (!administrator) return json({ error: "Administrator not found" }, 404)

  // ─── Everything that depends on nothing, at once ────────────────────────
  // Two name reads the email needs, and the token's hash. None of the three
  // depends on another, and this runs on the invitation path with a person
  // waiting on it. The hash is a local digest rather than a round trip; it
  // sits here so that what remains below is a chain of genuine dependencies
  // and not an accident of ordering.
  const token = mintToken()
  const [{ data: app }, { data: roleRow }, tokenHash] = await Promise.all([
    admin
      .from("admin_applications")
      .select("name")
      .eq("slug", administrator.application_slug)
      .maybeSingle(),
    admin
      .from("admin_roles")
      .select("name")
      .eq("code", administrator.role_code)
      .maybeSingle(),
    hashToken(token),
  ])

  // ─── Revoke the old link and mint the new one, atomically ───────────────
  // One call, because the two halves are one act. Done as two round trips
  // there is a window in which this administrator has NO live invitation — the
  // old one dead, the new one not yet written — and a failure inside it
  // strands them. public.admin_issue_invitation() does both in one
  // transaction, in the only order the partial unique index over pending rows
  // permits. See §12.11 of 20260913000001.
  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3_600_000)

  const { data: issued, error } = await admin.rpc("admin_issue_invitation", {
    p_administrator_id: administratorId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt.toISOString(),
    p_actor: actor,
  })
  if (error) return json({ error: error.message }, 500)

  const invitation = (issued ?? [])[0] as
    | { invitation_id: string; superseded: number }
    | undefined
  if (!invitation) return json({ error: "Failed to issue the invitation" }, 500)

  const inviteLink = panelUrl(INVITE_PATH, { token })

  await logEvent(admin, actor, "ADMIN_INVITATION_SENT", {
    application: administrator.application_slug,
    target: administratorId,
    severity: "warning",
    metadata: {
      invitation_id: invitation.invitation_id,
      expires_at: expiresAt.toISOString(),
      superseded: invitation.superseded,
      resend: !created,
    },
  })

  // ─── The email is non-fatal ──────────────────────────────────────────────
  // The administrator and the invitation both exist by this point. If Resend
  // is down, the right outcome is a created record and a reported email
  // failure — not a rolled-back invitation the operator has to reconstruct.
  // The raw token is returned ONLY when the email could not be sent, so an
  // operator can pass the link on by hand; it is never returned otherwise and
  // never logged.
  let emailSent = false
  let emailError: string | undefined
  try {
    await sendInvitationEmail({
      to: administrator.email,
      name: administrator.name,
      applicationName: app?.name ?? administrator.application_slug,
      roleName: roleRow?.name ?? administrator.role_code,
      inviteLink,
      expiresAt,
      resend: !created,
    })
    emailSent = true
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Email send failed"
    console.error("admin-core invitation email failed:", emailError)
  }

  return json(
    {
      success: true,
      administrator_id: administratorId,
      invitation_id: invitation.invitation_id,
      expires_at: expiresAt.toISOString(),
      created,
      email_sent: emailSent,
      ...(emailSent ? {} : { invite_link: inviteLink, email_error: emailError }),
    },
    created ? 201 : 200,
  )
}

// ─── accept_invitation ──────────────────────────────────────────────────────
// The only unauthenticated action, and the one with the most to get right.
//
// ─── The one-time guarantee lives in the database, not here ───────────────
// public.admin_claim_invitation() is a single UPDATE ... WHERE status =
// 'pending' AND expires_at > now() RETURNING. Two browsers opening the same
// link both reach it; Postgres serialises them on the row and exactly one gets
// a result. There is no read-then-write window in this file for the second one
// to slip through — and because the rule is a statement rather than a sequence
// of application steps, supabase/tests/admin_core_authorization.sql can
// execute every branch of it.
//
// The order of operations, and why it is this order:
//   1. hash the presented token;
//   2. read the state — for the SECURITY EVENT only, never for the decision;
//   3. CLAIM, which is the decision and the write in one statement;
//   4. create or resolve the GoTrue account;
//   5. activate the administrator.
//
// The claim comes before the GoTrue work because it is the one-time guarantee.
// The cost of that order: if step 4 fails, the invitation has been burned and
// the Super Admin has to resend. That is the safe direction to fail in, and
// resending is one click.
//
// ─── Enumeration ─────────────────────────────────────────────────────────
// Every refusal returns the same message and the same 400. An unknown token,
// an expired one, a spent one, a revoked one and a suspended administrator are
// indistinguishable to the caller, so the endpoint cannot be used to learn
// which tokens ever existed. The difference is recorded in the security event,
// where the operator can see it and the visitor cannot.

async function acceptInvitation(admin: Admin, token: unknown): Promise<Response> {
  const refusal = json(
    { error: "Esta invitación no es válida o ha caducado. Pide un enlace nuevo." },
    400,
  )

  if (typeof token !== "string" || token.length < 20) return refusal

  const tokenHash = await hashToken(token)

  const { data: claimedRows, error: claimError } = await admin.rpc("admin_claim_invitation", {
    p_token_hash: tokenHash,
  })
  if (claimError) {
    console.error("admin-core: claim failed:", claimError.message)
    return json({ error: "No se pudo procesar la invitación." }, 500)
  }

  const claimed = (claimedRows ?? [])[0] as
    | {
        invitation_id: string
        administrator_id: string
        email: string
        name: string
        application_slug: string
        role_code: string
      }
    | undefined

  if (!claimed) {
    // ─── Why the state is read HERE and not before the claim ──────────────
    // It is a diagnostic, never a decision: the claim is what settles whether
    // the invitation may be spent. Reading it up front cost a round trip on
    // every successful acceptance for a value nothing looked at — and reading
    // it CONCURRENTLY with the claim would be worse than useless, because the
    // two would race and a successful claim would make its own invitation
    // report as "used". Asked only after a refusal, it always describes the
    // state that caused the refusal.
    //
    // Nobody to attribute this to — the caller has no account, by definition —
    // so the console line is what an operator has, alongside the invitation's
    // own row.
    const { data: state } = await admin.rpc("admin_invitation_state", {
      p_token_hash: tokenHash,
    })
    console.warn(`admin-core: invitation refused (${state ?? "unknown"})`)
    return refusal
  }

  // ─── Resolve the account ─────────────────────────────────────────────────
  // New address → an invite, which creates the user and lets them set a
  // password on arrival at /login. Existing address → a recovery link to
  // /reset-password. Never a magic link: that IS a session, handed to somebody
  // who has still not chosen a credential. The reasoning, and the incident
  // behind it, are in create-unchained-member's header.
  let userId: string
  let actionLink: string

  const invited = await admin.auth.admin.generateLink({
    type: "invite",
    email: claimed.email,
    options: {
      redirectTo: panelUrl(LOGIN_PATH),
      data: { administration_core: true, application: claimed.application_slug },
    },
  })

  if (invited.error && isAlreadyRegistered(invited.error)) {
    const recovery = await admin.auth.admin.generateLink({
      type: "recovery",
      email: claimed.email,
      options: { redirectTo: panelUrl(PASSWORD_SETUP_PATH) },
    })
    if (recovery.error || !recovery.data?.user) {
      return json({ error: recovery.error?.message ?? "Failed to generate link" }, 500)
    }
    userId = recovery.data.user.id
    actionLink = recovery.data.properties.action_link
  } else if (invited.error || !invited.data?.user) {
    return json({ error: invited.error?.message ?? "Failed to generate link" }, 500)
  } else {
    userId = invited.data.user.id
    actionLink = invited.data.properties.action_link
  }

  // ─── Activate ────────────────────────────────────────────────────────────
  // This write is what turns a record into an administrator. It refuses if the
  // person was suspended or revoked between the claim and now — a Super Admin
  // closing an account mid-acceptance has to win that race.
  const { data: activated, error: activateError } = await admin.rpc(
    "admin_activate_administrator",
    { p_administrator_id: claimed.administrator_id, p_user_id: userId },
  )
  if (activateError) return json({ error: activateError.message }, 500)
  if (activated !== true) {
    await logEvent(admin, userId, "ADMIN_ACCESS_DENIED", {
      result: "DENIED",
      severity: "warning",
      application: claimed.application_slug,
      target: claimed.administrator_id,
      metadata: { reason: "revoked_during_acceptance" },
    })
    return refusal
  }

  await logEvent(admin, userId, "ADMIN_INVITATION_ACCEPTED", {
    application: claimed.application_slug,
    target: claimed.administrator_id,
    severity: "warning",
    metadata: { invitation_id: claimed.invitation_id, role: claimed.role_code },
  })

  return json({ success: true, action_link: actionLink, property: "unchained" }, 200)
}

// ─── set_status — suspend, revoke, reinstate ────────────────────────────────
// §20's lifecycle, and the one place where "invalidate existing sessions"
// actually happens.
//
// Changing the status is enough to make the account powerless: every
// authorization question goes through admin_has_permission(), which requires
// status = 'ACTIVE', so a suspended administrator's live session stops being
// able to do anything on its very next request. Ending the GoTrue sessions on
// top of that is what makes the person stop being signed IN, rather than
// merely being refused — and it needs service_role, which is why this action
// is here rather than in an RPC.
//
// The sign-out is best-effort: a revocation that has been recorded and is
// already being enforced must not be reported as a failure because GoTrue was
// briefly unreachable.

async function setStatus(
  admin: Admin,
  actor: string,
  payload: { administrator_id?: string; status?: string; reason?: string },
): Promise<Response> {
  const target = payload.administrator_id
  const next = payload.status as AdministratorStatus | undefined
  if (!target) return json({ error: "administrator_id is required" }, 400)
  if (next !== "ACTIVE" && next !== "SUSPENDED" && next !== "REVOKED") {
    return json({ error: "status must be ACTIVE, SUSPENDED or REVOKED" }, 400)
  }

  const administrator = await loadAdministrator(admin, target)
  if (!administrator) return json({ error: "Administrator not found" }, 404)

  // Reinstating somebody who never accepted their invitation would violate
  // administrators_active_has_user, and would be wrong anyway: they have no
  // account. Resending the invitation is the path back for a PENDING record.
  if (next === "ACTIVE" && !administrator.user_id) {
    return json(
      { error: "That administrator has never accepted an invitation. Resend it instead." },
      409,
    )
  }

  const { error } = await admin
    .from("administrators")
    .update({
      status: next,
      status_reason: payload.reason?.trim() || null,
      updated_by: actor,
    })
    .eq("id", target)
  if (error) return json({ error: error.message }, 500)

  // A revoked or suspended administrator's live invitation dies with their
  // access. Leaving it pending would let them re-accept their way back in.
  if (next !== "ACTIVE") {
    await admin
      .from("admin_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("administrator_id", target)
      .eq("status", "pending")
  }

  let sessionsEnded = false
  if (next !== "ACTIVE" && administrator.user_id) {
    try {
      await admin.auth.admin.signOut(administrator.user_id, "global")
      sessionsEnded = true
    } catch (err) {
      console.error("admin-core: could not end sessions:", err)
    }
  }

  await logEvent(
    admin,
    actor,
    next === "SUSPENDED"
      ? "ADMIN_SUSPENDED"
      : next === "REVOKED"
        ? "ADMIN_REVOKED"
        : "ADMIN_REINSTATED",
    {
      application: administrator.application_slug,
      target,
      severity: "critical",
      metadata: {
        from: administrator.status,
        to: next,
        reason: payload.reason?.trim() || null,
        sessions_ended: sessionsEnded,
      },
    },
  )

  return json({ success: true, status: next, sessions_ended: sessionsEnded }, 200)
}

// ─── set_role ───────────────────────────────────────────────────────────────
// Changing what somebody may do. Audited as its own event (§35) because "who
// approved this person becoming a FINANCE_ADMIN" is a question that gets asked
// after the fact, and an UPDATE with no event cannot answer it.

async function setRole(
  admin: Admin,
  actor: string,
  payload: { administrator_id?: string; role?: string },
): Promise<Response> {
  const target = payload.administrator_id
  const role = payload.role?.trim()
  if (!target || !role) return json({ error: "administrator_id and role are required" }, 400)

  const administrator = await loadAdministrator(admin, target)
  if (!administrator) return json({ error: "Administrator not found" }, 404)

  const { data: roleRow } = await admin
    .from("admin_roles")
    .select("code, status")
    .eq("code", role)
    .maybeSingle()
  if (!roleRow) return json({ error: `Unknown role "${role}"` }, 400)
  if (roleRow.status === "disabled") return json({ error: `The role "${role}" is disabled` }, 400)

  if (administrator.role_code === role) {
    return json({ success: true, role, unchanged: true }, 200)
  }

  const { error } = await admin
    .from("administrators")
    .update({ role_code: role, updated_by: actor })
    .eq("id", target)
  if (error) return json({ error: error.message }, 500)

  await logEvent(admin, actor, "ADMIN_ROLE_CHANGED", {
    application: administrator.application_slug,
    target,
    severity: "critical",
    metadata: { from: administrator.role_code, to: role },
  })

  return json({ success: true, role }, 200)
}

// ─── set_application_scope ──────────────────────────────────────────────────
// Moving somebody from one property to another. The most consequential write
// in the module after revocation, because it is the only one that changes what
// admin_has_permission() answers about a DIFFERENT database's data.
//
// The unique index on (lower(email), application_slug) is what stops this
// producing a duplicate: moving somebody into an application they already
// administer fails on the index rather than creating a second record with the
// same address.

async function setApplicationScope(
  admin: Admin,
  actor: string,
  payload: { administrator_id?: string; application?: string },
): Promise<Response> {
  const target = payload.administrator_id
  const application = payload.application?.trim()
  if (!target || !application) {
    return json({ error: "administrator_id and application are required" }, 400)
  }

  const administrator = await loadAdministrator(admin, target)
  if (!administrator) return json({ error: "Administrator not found" }, 404)

  const { data: app } = await admin
    .from("admin_applications")
    .select("slug, name, status")
    .eq("slug", application)
    .maybeSingle()
  if (!app) return json({ error: `Unknown application "${application}"` }, 400)
  if (app.status !== "active") {
    return json({ error: `The application "${app.name}" is not open for administration` }, 400)
  }

  if (administrator.application_slug === application) {
    return json({ success: true, application, unchanged: true }, 200)
  }

  const { error } = await admin
    .from("administrators")
    .update({ application_slug: application, updated_by: actor })
    .eq("id", target)
  if (error) {
    return json(
      { error: `That address already administers ${app.name}. (${error.message})` },
      409,
    )
  }

  await logEvent(admin, actor, "ADMIN_APPLICATION_CHANGED", {
    application,
    target,
    severity: "critical",
    metadata: { from: administrator.application_slug, to: application },
  })

  return json({ success: true, application }, 200)
}

// ─── set_compensation ───────────────────────────────────────────────────────
// §14: a fixed salary, set by the Super Admin, versioned rather than
// overwritten, and audited.
//
// Supersede-then-insert rather than UPDATE: the previous figure keeps its own
// row with an effective_to, so "what were they paid in March" stays
// answerable. administrator_compensation_active_unique makes the current
// figure a single row, so nothing downstream has to pick between two.
//
// Returns a Response on refusal and null on success, so issue_invitation can
// call it inline during creation and simply forward a refusal.

async function setCompensation(
  admin: Admin,
  actor: string,
  payload: {
    administrator_id?: string
    salary_amount?: number
    currency?: string
    effective_from?: string
  },
): Promise<Response | null> {
  const target = payload.administrator_id
  if (!target) return json({ error: "administrator_id is required" }, 400)

  const amount = Number(payload.salary_amount)
  if (!Number.isFinite(amount) || amount < 0) {
    return json({ error: "salary_amount must be a number of zero or more" }, 400)
  }

  const currency = (payload.currency ?? "CUP").trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    return json({ error: "currency must be a three-letter code, such as CUP" }, 400)
  }

  const administrator = await loadAdministrator(admin, target)
  if (!administrator) return json({ error: "Administrator not found" }, 404)

  const effectiveFrom = payload.effective_from ?? new Date().toISOString().slice(0, 10)

  const { data: current } = await admin
    .from("administrator_compensation")
    .select("id, salary_amount, currency")
    .eq("administrator_id", target)
    .eq("status", "active")
    .maybeSingle()

  if (current) {
    const { error } = await admin
      .from("administrator_compensation")
      .update({ status: "superseded", effective_to: effectiveFrom, updated_by: actor })
      .eq("id", current.id)
    if (error) return json({ error: error.message }, 500)
  }

  const { error } = await admin.from("administrator_compensation").insert({
    administrator_id: target,
    salary_amount: amount,
    currency,
    effective_from: effectiveFrom,
    status: "active",
    created_by: actor,
    updated_by: actor,
  })
  if (error) return json({ error: error.message }, 500)

  await logEvent(admin, actor, current ? "ADMIN_SALARY_CHANGED" : "ADMIN_SALARY_CREATED", {
    application: administrator.application_slug,
    target,
    severity: "critical",
    metadata: {
      amount,
      currency,
      effective_from: effectiveFrom,
      ...(current
        ? { previous_amount: Number(current.salary_amount), previous_currency: current.currency }
        : {}),
    },
  })

  return null
}

// ─── The dispatcher ─────────────────────────────────────────────────────────
// One entry point, one authorization gate, one place where an unknown action
// is refused. `accept_invitation` is split out BEFORE the gate because it is
// the only action whose caller has no account yet — the token is what stands
// in for a session there, and requireSuperAdmin() would refuse it forever.

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
      return json({ error: "A JSON body with an `action` is required" }, 400)
    }

    const action = (payload as { action?: Action }).action

    if (action === "accept_invitation") {
      return await acceptInvitation(admin, (payload as { token?: unknown }).token)
    }

    const gate = await requireSuperAdmin(req, admin)
    if ("refusal" in gate) return gate.refusal
    const { actor } = gate

    switch (action) {
      case "issue_invitation":
        return await issueInvitation(admin, actor, payload as IssuePayload)

      case "set_status":
        return await setStatus(admin, actor, payload as Parameters<typeof setStatus>[2])

      case "set_role":
        return await setRole(admin, actor, payload as Parameters<typeof setRole>[2])

      case "set_application_scope":
        return await setApplicationScope(
          admin,
          actor,
          payload as Parameters<typeof setApplicationScope>[2],
        )

      case "set_compensation": {
        const refusal = await setCompensation(
          admin,
          actor,
          payload as Parameters<typeof setCompensation>[2],
        )
        return refusal ?? json({ success: true }, 200)
      }

      default:
        return json({ error: `Unknown action "${String(action)}"` }, 400)
    }
  } catch (err) {
    console.error("admin-core error:", err)
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    )
  }
})
