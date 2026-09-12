import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * POST /api/revalidate — "something was published; refresh the pages that show
 * it."
 *
 * ─── The problem this closes ──────────────────────────────────────────────
 * lib/portfolio.ts has carried this note since the portfolio moved into the
 * database:
 *
 *   "On-demand revalidation needs the caller to hold a secret, and the caller
 *   would be the admin panel — a Vite SPA, whose every environment variable is
 *   inlined into a bundle the browser downloads. A 'secret' there is public,
 *   and a public revalidation endpoint is an invitation to make this site
 *   rebuild itself on request. Doing it properly means an edge function
 *   holding the token and the panel calling that; until that exists, ten
 *   minutes is the honest interval rather than a broken instant one."
 *
 * This is the endpoint half of "doing it properly". The other half is
 * supabase/functions/revalidate-site, which holds REVALIDATE_SECRET as a Deno
 * environment secret on the server and is the only caller. The panel calls the
 * edge function with its ordinary user session; the edge function checks that
 * the caller may publish, and only then calls this.
 *
 * So the secret never reaches a browser, and this route is not "public with a
 * password" — it is reachable only by something that already proved a
 * signed-in content manager asked for it.
 *
 * ─── What this deliberately does not do ───────────────────────────────────
 * It does not rebuild the site. `revalidatePath` marks a route's cached output
 * stale so the next request regenerates it — seconds, not a deploy — and it
 * does not touch any page that was not named. A full redeploy on every
 * publish would turn a typo fix into a several-minute wait and a build minute.
 *
 * It also takes no content in the body. The site re-reads from the database;
 * this only says WHICH pages are out of date. An endpoint that accepted
 * content would be an endpoint that could publish content.
 */

/**
 * The pages the site is allowed to be asked to refresh.
 *
 * ─── Why an allow-list and not `revalidatePath(body.path)` ────────────────
 * Taking a path from the request is the obvious implementation and it is a
 * mistake: it turns this into a primitive for invalidating any route on the
 * site, and the set of routes is not the set of things the CMS publishes. A
 * caller — including a compromised edge function, or a bug in the panel —
 * could then evict the homepage's cache in a loop.
 *
 * Naming the routes here means the blast radius of this endpoint is exactly
 * these pages, whatever it is asked for. It is short because the site is
 * small, and it is grouped by what a publish actually affects.
 */
const SCOPES = {
  /**
   * A project was published, unpublished, edited or archived.
   *
   * The homepage and /work both render the portfolio — the flagship on one and
   * the grid on the other — so both go stale together with the detail page. The
   * sitemap too: a newly detailed project is a new indexable URL.
   */
  projects: ['/', '/work', '/work/[slug]', '/sitemap.xml'],
  /** An article was published, unpublished, edited or archived. */
  insights: ['/insights', '/insights/[slug]', '/sitemap.xml'],
} as const;

type Scope = keyof typeof SCOPES;

function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && value in SCOPES;
}

/**
 * Constant-time string comparison.
 *
 * The token is compared with `===` nowhere in this file. A naive comparison
 * returns as soon as two bytes differ, and the time it took is a measurement
 * of how many leading characters were right — enough, over many requests, to
 * recover a secret one character at a time.
 *
 * Web Crypto has no timingSafeEqual, so this is the loop: same work for every
 * input, with the length difference folded into the result rather than
 * short-circuiting on it.
 */
function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);

  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  // Read at call time, not at module scope. A missing secret must fail the
  // request rather than the build — the site has to keep serving when nobody
  // has configured revalidation yet, which is the state of every preview
  // deploy.
  const secret = process.env.REVALIDATE_SECRET;

  // An unconfigured secret refuses everything. Not "allow when unset": that is
  // the failure mode where a deployment missing one environment variable
  // silently becomes an open endpoint.
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { revalidated: false, error: 'not configured' },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!presented || !safeEqual(presented, secret)) {
    // No detail. "Wrong secret" and "no secret" are the same answer, and
    // nothing is logged that would put the presented value in a log file.
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { revalidated: false, error: 'invalid body' },
      { status: 400 },
    );
  }

  const scope = (body as { scope?: unknown } | null)?.scope;
  if (!isScope(scope)) {
    return NextResponse.json(
      { revalidated: false, error: 'unknown scope' },
      { status: 400 },
    );
  }

  for (const path of SCOPES[scope]) {
    // 'page' for the dynamic segments: revalidatePath('/work/[slug]', 'page')
    // invalidates every generated project page, which is what a publish needs
    // — the alternative is knowing which slug changed, and an unpublish also
    // has to evict the page for a slug that no longer exists.
    if (path.includes('[')) {
      revalidatePath(path, 'page');
    } else {
      revalidatePath(path);
    }
  }

  return NextResponse.json({
    revalidated: true,
    scope,
    paths: SCOPES[scope],
    at: new Date().toISOString(),
  });
}

/**
 * Anything that is not a POST.
 *
 * Returned explicitly so a GET — a crawler, somebody pasting the URL into a
 * browser — gets 405 rather than Next's default 404, which would suggest the
 * route does not exist and send whoever is debugging it looking for a typo.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'method not allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
