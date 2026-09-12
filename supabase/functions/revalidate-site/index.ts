import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ════════════════════════════════════════════════════════════
// revalidate-site
// ════════════════════════════════════════════════════════════
// Asks the public Unchained Business website to refresh the pages that show a
// piece of content, immediately after it is published, unpublished, edited or
// archived in the admin panel.
//
// ─── Why this function exists at all ────────────────────────────────────────
// lib/portfolio.ts in the website repository has carried this note since the
// portfolio moved into the database:
//
//   "On-demand revalidation needs the caller to hold a secret, and the caller
//   would be the admin panel — a Vite SPA, whose every environment variable is
//   inlined into a bundle the browser downloads. A 'secret' there is public,
//   and a public revalidation endpoint is an invitation to make this site
//   rebuild itself on request. Doing it properly means an edge function
//   holding the token and the panel calling that; until that exists, ten
//   minutes is the honest interval rather than a broken instant one."
//
// This is that edge function. REVALIDATE_SECRET lives here, as a Deno
// environment secret on Supabase's servers, and is never sent to a browser.
// The panel calls this with the ordinary user session it already holds; this
// establishes that the caller may publish, and only then presents the secret
// to the website.
//
// The chain, and what each link contributes:
//
//   panel (user JWT)  →  this function  →  website /api/revalidate
//                        ↑ checks who     ↑ holds the secret
//
// A browser that skipped the panel and called this directly would still need a
// valid Unchained session belonging to a content manager. A browser that
// skipped this and called the website directly would need the secret, which is
// in neither the bundle nor the network tab.
//
// ─── What it deliberately cannot do ─────────────────────────────────────────
//   · It sends no content. The website re-reads from the database; this only
//     says which pages are stale. An endpoint that carried content would be an
//     endpoint that could publish content.
//   · It names a SCOPE, not a path. The website holds the list of routes each
//     scope covers, so this function cannot be used to evict an arbitrary page.
//   · It never fails the operation it follows. Publishing already succeeded by
//     the time this is called; if the website is unreachable the page is stale
//     for up to ten minutes, which is the interval that applied before this
//     existed. The panel surfaces that as a note, not as an error.
//
// ─── Deploying ──────────────────────────────────────────────────────────────
//     supabase functions deploy revalidate-site
//     supabase secrets set REVALIDATE_SECRET=<the same value Vercel holds>
//     supabase secrets set SITE_URL=https://www.unchainedbusiness.com
//
// The secret is a shared value between this project and the website's Vercel
// environment. Generate it with `openssl rand -hex 32` and set it in both;
// rotating it means setting both again, and a mismatch produces a 401 here
// rather than anything visible to a visitor.

// Inlined rather than imported from a shared module so this function deploys
// as a single self-contained file — the same constraint
// create-unchained-member documents.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/**
 * The scopes the website understands.
 *
 * Mirrored from app/api/revalidate/route.ts, which owns the mapping from a
 * scope to the routes it invalidates. Listed here so an unknown value is
 * refused before a request is made rather than producing a 400 from the site,
 * and so that this file states what it is able to ask for.
 */
const SCOPES = new Set(["projects", "insights"])

const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.unchainedbusiness.com")
  .replace(/\/+$/, "")

const REVALIDATE_SECRET = Deno.env.get("REVALIDATE_SECRET")

/** A response the panel can read. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    // ─── 1. Authorize the caller ──────────────────────────────────────────
    // A user-scoped client, exactly as create-unchained-member builds one: the
    // caller's own JWT, so every check below is about THEM and not about the
    // function's own privileges.
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "No authorization header" }, 401)

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) return json({ error: "Unauthorized" }, 401)

    // ─── Why unchained_manages_content() and not a roles read ─────────────
    // create-unchained-member reads public.roles with a SERVICE-ROLE client,
    // because it needs super_admin specifically and is_super_admin() is not
    // callable by `authenticated`.
    //
    // This function asks a different and narrower question — "may you publish"
    // — and public.unchained_manages_content() IS granted to `authenticated`,
    // precisely so a user-scoped client can ask it about itself. So it is
    // called on the caller's own client, which means this function needs no
    // service-role key at all and cannot be made to do anything with one.
    //
    // It is also the SAME predicate the RLS policies use. Anybody who can
    // publish can ask for a revalidation, and nobody else can — with no second
    // list of who that is.
    const { data: mayPublish, error: predicateError } = await supabaseUser
      .rpc("unchained_manages_content")

    if (predicateError) {
      return json({ error: "Could not establish authorization" }, 403)
    }
    if (mayPublish !== true) {
      return json({ error: "Not authorized to publish" }, 403)
    }

    // ─── 2. Validate the payload ──────────────────────────────────────────
    let payload: { scope?: unknown }
    try {
      payload = await req.json()
    } catch {
      return json({ error: "Invalid JSON body" }, 400)
    }

    const scope = payload.scope
    if (typeof scope !== "string" || !SCOPES.has(scope)) {
      return json({ error: "scope must be 'projects' or 'insights'" }, 400)
    }

    // ─── 3. Configuration ─────────────────────────────────────────────────
    // Checked after authorization, not before: an unauthenticated caller
    // should not be able to discover whether revalidation is configured.
    if (!REVALIDATE_SECRET || REVALIDATE_SECRET.length < 32) {
      return json(
        {
          revalidated: false,
          error:
            "REVALIDATE_SECRET is not set on this project. Content is published; " +
            "the site will pick it up within its normal interval.",
        },
        503,
      )
    }

    // ─── 4. Ask the website ───────────────────────────────────────────────
    // A short timeout. This runs after a successful publish, and the panel is
    // waiting on it to show a confirmation; a site that is slow to answer must
    // not make publishing feel broken.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(`${SITE_URL}/api/revalidate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REVALIDATE_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope }),
        signal: controller.signal,
      })

      if (!response.ok) {
        // The site's own error text is NOT forwarded. It is a server response
        // to a request carrying a secret, and the panel has no use for its
        // detail beyond "it did not work".
        return json(
          {
            revalidated: false,
            status: response.status,
            error: "The website refused the revalidation request.",
          },
          502,
        )
      }

      const result = await response.json()
      return json({ revalidated: true, scope, site: result }, 200)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    // Includes the abort. Deliberately a 200-level failure from the panel's
    // point of view — see the header: the publish already happened, and this
    // is the difference between the site updating now and updating within ten
    // minutes.
    return json(
      {
        revalidated: false,
        error:
          error instanceof Error && error.name === "AbortError"
            ? "The website did not answer in time."
            : "The website could not be reached.",
      },
      502,
    )
  }
})
