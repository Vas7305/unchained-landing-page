import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ════════════════════════════════════════════════════════════
// create-unchained-member
// ════════════════════════════════════════════════════════════
// Creates (or re-invites) a commercial or a specialist for Unchained Business
// and emails them an access link into the shared admin panel, which opens
// Unchained's section against THIS database.
//
// --- This copy runs in Unchained's OWN Supabase project --------------------
// The original lived in TanCerca's project, where it was the sibling of
// create-affiliate and where every account it touched shared one auth.users
// with TanCerca's customers. It does not any more. SUPABASE_URL here resolves
// to a project that holds Unchained's people and nothing else, so:
//
//   - an address is "existing" only if UNCHAINED has seen it before;
//   - the service_role key this function runs on grants nothing anywhere else;
//   - the email goes out from Unchained's sender, not from tancerca.com.
//
// The re-invite path below is kept all the same. It is not there to paper over
// a shared user table - it is what makes inviting the same person twice, or
// giving a login to somebody already on the roster, a safe repeat rather than
// a duplicate-email error.
//
// ─── What it does, in order ───────────────────────────────────────────────
//   1. authorize the caller as super_admin (public.roles, service-role read)
//   2. resolve the auth user for the email — invite if new, magic link if not
//   3. upsert the roster row (commercial_contacts | unchained_specialists)
//      and link it to that user
//   4. grant an ACTIVE product_memberships row on 'unchained'
//   5. email the link, non-fatally
//
// ─── Why the link lands on /login ─────────────────────────────────────────
// The panel's login page detects an invite or magic-link token in the URL
// hash, offers "set your password" for a new account, and then asks the
// database which products the person holds. A member invited here holds
// 'unchained', which is the only product this database knows about, so the
// answer is never ambiguous.
//
// ─── Why service_role is required here and RLS is not enough ──────────────
// Creating an auth user, generating an invite link and inserting a membership
// are all privileged operations no browser session can perform. That is the
// whole reason this runs in an edge function instead of in the panel, and it
// is why step 1 is not optional: everything after it runs as service_role,
// which no RLS policy governs. That key is scoped to THIS project, so the
// blast radius of a mistake here stops at Unchained.

// Inlined rather than imported from a shared module so this function deploys
// as a single self-contained file (the Management API multipart upload does
// not carry sibling files / relative imports cleanly).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/** Which roster the person belongs to. Decides the table and the default role. */
type MemberKind = "commercial" | "specialist"

interface CreateMemberPayload {
  kind: MemberKind
  name: string
  email: string
  /** Job title for a commercial, specialty for a specialist. Optional. */
  detail?: string
  /** Percentage, as a human types it: 10 means 10%. */
  commission?: number
  /**
   * The product_memberships role. Defaults to the kind. Only the two manager
   * roles are worth naming explicitly, and only a super_admin can get here to
   * name them.
   */
  membership_role?: string
  notes?: string
  /** Commercial-only contact channels. Ignored for a specialist. */
  whatsapp_number?: string
  telegram_username?: string
  calcom_url?: string
  languages?: string[]
  timezone?: string
}

// ADMIN_PANEL_URL is the SHARED command centre — one admin app fronting every
// property, each through its own Supabase client and its own session. It is
// hosted on TanCerca's domain for historical reasons (the panel was built
// there) and that is a rename waiting to happen, not a coupling: the databases
// are fully separate and no server holds a key spanning two of them. See
// docs/database-isolation.md §5.
//
// FROM_EMAIL is NOT shared and must not become so. The panel can be one app;
// the sender cannot be one domain. An access link for an Unchained specialist
// arriving from tancerca.com tells the recipient the two businesses are one
// system, and it is sent through a Resend key that belongs to this project
// alone.
const ADMIN_PANEL_URL = Deno.env.get("ADMIN_PANEL_URL") || "https://admin.tancercadeti.com"
const REDIRECT_PATH = Deno.env.get("UNCHAINED_REDIRECT_PATH") || "/login"
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "acceso@unchainedbusiness.com"

// public.product_memberships.role is CHECK (role ~ '^[a-z][a-z0-9_]{1,40}$') —
// a slug, not an enum, so the database accepts anything shaped like one. This
// list is the set this function is willing to GRANT, which is a narrower and
// more useful question. 'unchained_admin' and 'commercial_manager' are the two
// the leads module reads as "sees the whole pipeline" (see
// public.unchained_manages_leads); the other two see only their own work.
const GRANTABLE_ROLES = new Set([
  "commercial",
  "specialist",
  "commercial_manager",
  "unchained_admin",
])

// ─── Recognising "this address already has an account" ──────────────────────
// This function used to decide new-vs-existing by calling
// auth.admin.listUsers() and scanning the result. That call takes GoTrue's
// DEFAULT page size — 50 — so once the project held more accounts than that,
// an address belonging to user 51+ came back "not found". The code then took
// the invite branch, and GoTrue answered "A user with this email address has
// already been registered": a hard 400 on exactly the person the function was
// written to recognise and re-invite.
//
// Paginating the listing would fix the symptom while keeping its shape: one
// round trip per page of accounts, on every single invitation, against a
// listing that can change between the read and the write. Attempting the
// invite and reading GoTrue's answer is one round trip and cannot go stale.
//
// Isolating the database removed the reason this was ever REPORTED - the
// address that triggered it belonged to a TanCerca customer and does not exist
// in this project - but not the defect. Unchained will pass 50 accounts of its
// own, and on that day the old code would have said the same wrong thing about
// its own people.
//
// Matched on the error code first (auth-js exposes `code` on AuthApiError) and
// on the message only as a fallback, so a GoTrue release that rewords the
// string does not silently turn a re-invite back into a hard failure.
const EMAIL_EXISTS_CODES = new Set(["email_exists", "user_already_exists"])

function isAlreadyRegistered(error: { code?: string; message?: string }): boolean {
  if (error.code && EMAIL_EXISTS_CODES.has(error.code)) return true
  return /already (been )?registered|already exists/i.test(error.message ?? "")
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// ─── The email ──────────────────────────────────────────────────────────────
// Spanish. Every string a recipient reads lives in this one function, so
// changing the language of the invitation is one edit rather than a search
// through the file.

async function sendInviteEmail(opts: {
  to: string
  name: string | null
  kind: MemberKind
  commissionPercent: number
  inviteLink: string
  isExistingUser: boolean
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping invite email")
    return
  }

  const greeting = opts.name ? `Hola ${opts.name}` : "Hola"
  const roleLabel = opts.kind === "commercial" ? "comercial" : "especialista"
  const buttonLabel = opts.isExistingUser ? "Acceder al panel" : "Activar mi cuenta"
  const actionText = opts.isExistingUser
    ? "Pulsa el botón para entrar en tu panel:"
    : "Pulsa el botón para activar tu cuenta y entrar en tu panel:"
  const whatYouSee =
    opts.kind === "commercial"
      ? "Desde tu panel verás tus clientes convertidos, el importe de cada trabajo y lo que te corresponde por ellos."
      : "Desde tu panel verás los trabajos que tienes asignados, el importe que paga el cliente por cada uno y el porcentaje que cobras."

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu acceso a Unchained Business</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);max-width:600px;">
          <tr>
            <td style="background:#0f172a;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Unchained Business</h1>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Panel de administración</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">${greeting} 👋</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Se ha creado tu cuenta de <strong>${roleLabel}</strong> en Unchained Business.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#f1f5f9;border-radius:6px;padding:20px;text-align:center;border:1px solid #e2e8f0;">
                    <p style="margin:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Tu porcentaje</p>
                    <p style="margin:0;color:#0f172a;font-size:30px;font-weight:700;letter-spacing:1px;">${opts.commissionPercent}%</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#475569;font-size:15px;line-height:1.6;">
                ${whatYouSee}
              </p>
              <p style="margin:0 0 32px;color:#475569;font-size:15px;line-height:1.6;">
                ${actionText}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${opts.inviteLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:6px;font-size:15px;font-weight:600;">
                      ${buttonLabel}
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
                Este enlace caduca en 24 horas. Si no esperabas este correo, ignóralo.<br />
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

  const subject = opts.isExistingUser
    ? "Tu acceso al panel — Unchained Business"
    : "Activa tu cuenta — Unchained Business"

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [opts.to], subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("Resend error:", body)
    throw new Error(`Email send failed (${res.status})`)
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // ─── 1. Authorize the caller ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "No authorization header" }, 401)

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) return json({ error: "Unauthorized" }, 401)

    // Read public.roles with the service-role client, exactly as create-affiliate
    // does: public.is_super_admin() has EXECUTE revoked from `authenticated`, so
    // it cannot be called from a user-scoped client.
    const { data: callerRole } = await supabaseAdmin
      .from("roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle()

    if (!callerRole) {
      return json({ error: "Only super_admin can create Unchained members" }, 403)
    }

    // ─── 2. Validate the payload ──────────────────────────────────────────
    const payload: CreateMemberPayload = await req.json()

    if (payload.kind !== "commercial" && payload.kind !== "specialist") {
      return json({ error: "kind must be 'commercial' or 'specialist'" }, 400)
    }
    if (!payload.email || !payload.email.includes("@")) {
      return json({ error: "Email is required" }, 400)
    }
    const name = payload.name?.trim()
    if (!name) return json({ error: "Name is required" }, 400)

    // The panel sends a percentage because that is what a person types. The
    // database stores a fraction, because that is what it multiplies by. The
    // conversion happens here, once, so no screen and no policy has to guess
    // which of the two a given number is.
    const commissionPercent = payload.commission ?? 0
    const commissionRate = commissionPercent / 100
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
      return json({ error: "Commission must be between 0 and 100" }, 400)
    }

    const membershipRole = (payload.membership_role ?? payload.kind).trim()
    if (!GRANTABLE_ROLES.has(membershipRole)) {
      return json(
        { error: `membership_role must be one of: ${[...GRANTABLE_ROLES].join(", ")}` },
        400,
      )
    }

    const email = payload.email.trim()
    const table = payload.kind === "commercial" ? "commercial_contacts" : "unchained_specialists"
    // ─── The link has to name its property ────────────────────────────────
    // The panel is one app in front of several databases, holding one Supabase
    // client per property. An invite arrives as `#access_token=…&type=invite`,
    // and supabase-js redeems that hash on client construction — so without
    // something in the URL saying which project minted the token, every client
    // would race to spend it against its own database. The single-use token
    // would be burned by whichever ran first, and if that was the wrong
    // project the invitation is dead and the person cannot be let in.
    //
    // `?property=unchained` is what settles it: exactly one client is
    // constructed with detectSessionInUrl, and it is this project's. See
    // admin-panel/src/platform/connections.ts (landingPropertyFromSearch) and
    // its test suite, and docs/database-isolation.md §5.
    //
    // It must survive a REDIRECT_PATH that already carries a query string, so
    // it is appended rather than concatenated.
    const acceptUrl = (() => {
      const url = new URL(`${ADMIN_PANEL_URL}${REDIRECT_PATH}`)
      url.searchParams.set("property", "unchained")
      return url.toString()
    })()

    // ─── 3. Resolve the auth user ─────────────────────────────────────────
    // Existing address → a magic link into the panel they already have.
    // New address → an invite, which creates the user and lets them set a
    // password on arrival. Both land on the same /login page.
    //
    // Ask GoTrue to create the account and read its answer, rather than
    // deciding in advance whether the address is new. See the note on
    // isAlreadyRegistered() for why the previous listUsers() check was wrong.
    let userId: string
    let isExistingUser = false
    let inviteLink: string

    const invited = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: acceptUrl, data: { product: "unchained", role: membershipRole } },
    })

    if (invited.error && isAlreadyRegistered(invited.error)) {
      // The address already has an Unchained account. Re-inviting it is the
      // documented behaviour of this function: link the existing login to the
      // roster row and send them a way in. It is not a duplicate-email error.
      isExistingUser = true
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: acceptUrl },
      })
      if (linkError || !linkData?.user) {
        return json({ error: linkError?.message ?? "Failed to generate link" }, 400)
      }
      userId = linkData.user.id
      inviteLink = linkData.properties.action_link
    } else if (invited.error || !invited.data?.user) {
      return json({ error: invited.error?.message ?? "Failed to generate invite" }, 400)
    } else {
      userId = invited.data.user.id
      inviteLink = invited.data.properties.action_link
    }

    // ─── 4. Upsert the roster row ─────────────────────────────────────────
    // Email is the natural key: a row may already exist because a super_admin
    // added the representative through the Commercial screen before deciding
    // to give them a login. Finding it means this call is a LINK-AND-INVITE,
    // not a duplicate error.
    //
    // Matching on user_id first and email second, so a person whose address
    // changed is still recognised by their login rather than duplicated.
    const { data: byUser } = await supabaseAdmin
      .from(table)
      .select("id, name, commission_rate")
      .eq("user_id", userId)
      .maybeSingle()

    const { data: byEmailRows } = await supabaseAdmin
      .from(table)
      .select("id, name, commission_rate")
      .ilike("email", email)
      .limit(1)

    const existingRow = byUser ?? byEmailRows?.[0] ?? null

    // Channels belong to a commercial only: they are what the public contact
    // panel renders, and a specialist is never routed to. Sending them for a
    // specialist is not an error, it is simply dropped — the column does not
    // exist on that table.
    const channelFields =
      payload.kind === "commercial"
        ? {
            role: payload.detail?.trim() || null,
            whatsapp_number: payload.whatsapp_number?.trim() || null,
            telegram_username: payload.telegram_username?.trim() || null,
            calcom_url: payload.calcom_url?.trim() || null,
            languages: payload.languages ?? [],
            timezone: payload.timezone?.trim() || null,
          }
        : { specialty: payload.detail?.trim() || null }

    let memberId: string
    let reInvited = false

    if (existingRow) {
      memberId = existingRow.id
      reInvited = true
      // Deliberately does NOT overwrite the commission_rate of an existing
      // person. Re-sending somebody their access link is not the moment to
      // change what they are paid — that is unchained_set_commission_rate(),
      // which is a separate, deliberate act with its own authorization. A
      // re-invite that silently reset a negotiated rate to whatever was left in
      // a form field would be a payroll incident.
      const { error: updateError } = await supabaseAdmin
        .from(table)
        .update({ user_id: userId, email, name })
        .eq("id", memberId)

      if (updateError) return json({ error: updateError.message }, 500)
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from(table)
        .insert({
          user_id: userId,
          name,
          email,
          commission_rate: commissionRate,
          notes: payload.notes?.trim() || null,
          ...channelFields,
        })
        .select("id")
        .single()

      if (insertError) return json({ error: insertError.message }, 500)
      memberId = inserted.id
    }

    // ─── 5. Grant the product membership ──────────────────────────────────
    // This, and not the roster row, is what opens the panel. The roster row
    // says who someone IS; the membership says what they may open.
    // my_commercial_contact_id() and my_specialist_id() both require an ACTIVE
    // membership precisely so that revoking access is one write.
    //
    // product_memberships_active_unique is a PARTIAL unique index over active
    // rows, so a plain upsert cannot target it portably. Read-then-write is
    // correct here: this path runs once per invitation, under a super_admin,
    // and a lost race produces a duplicate-key error rather than a wrong grant.
    const { data: existingMembership } = await supabaseAdmin
      .from("product_memberships")
      .select("id, active")
      .eq("user_id", userId)
      .eq("product_id", "unchained")
      .eq("role", membershipRole)
      .maybeSingle()

    if (existingMembership) {
      if (!existingMembership.active) {
        await supabaseAdmin
          .from("product_memberships")
          .update({ active: true })
          .eq("id", existingMembership.id)
      }
    } else {
      const { error: membershipError } = await supabaseAdmin
        .from("product_memberships")
        .insert({
          user_id: userId,
          product_id: "unchained",
          role: membershipRole,
          active: true,
        })
      if (membershipError) return json({ error: membershipError.message }, 500)
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: caller.id,
      action: reInvited ? "unchained_member_reinvited" : "unchained_member_created",
      metadata: {
        kind: payload.kind,
        member_id: memberId,
        user_id: userId,
        email,
        membership_role: membershipRole,
        ...(reInvited ? {} : { commission_rate: commissionRate }),
      },
    })

    // ─── 6. Email the link — non-fatal ────────────────────────────────────
    // The account, the roster row and the grant all exist by this point. If
    // Resend is down, the right outcome is a created member and a reported
    // email failure, not a rolled-back invitation the operator has to redo.
    let emailSent = false
    let emailError: string | undefined
    try {
      await sendInviteEmail({
        to: email,
        name,
        kind: payload.kind,
        // Report the rate that is actually stored, which for a re-invite is the
        // existing one rather than whatever the form carried.
        commissionPercent: Math.round(
          (reInvited && existingRow ? Number(existingRow.commission_rate) : commissionRate) * 10000,
        ) / 100,
        inviteLink,
        isExistingUser,
      })
      emailSent = true
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Email send failed"
      console.error("Unchained invite email failed:", emailError)
    }

    return json(
      {
        success: true,
        kind: payload.kind,
        member_id: memberId,
        user_id: userId,
        membership_role: membershipRole,
        re_invited: reInvited,
        user_existed: isExistingUser,
        email_sent: emailSent,
        ...(emailError ? { email_error: emailError } : {}),
      },
      reInvited ? 200 : 201,
    )
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500)
  }
})
