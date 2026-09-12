import type { NextConfig } from 'next';

/**
 * `output: 'export'` was removed when the site moved to Vercel.
 *
 * A static export has no request phase, which meant `proxy.ts` could not run
 * and `x-vercel-ip-country` — the one trustworthy country signal this hosting
 * actually provides — was discarded on every request. Commercial routing then
 * fell back to guessing the country from the browser's locale list, which is
 * wrong for anyone whose languages include a region they are not in.
 *
 * The pages themselves are still statically prerendered and CDN-cached; only
 * the request-time proxy is new. Nothing in the app reads `headers()`, so no
 * route was opted into dynamic rendering by this change.
 *
 * Note that this ends the GitHub Pages deployment: `next build` no longer
 * emits `out/`, which .github/workflows/nextjs.yml uploads.
 */
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    /**
     * The media library's host.
     *
     * ─── Why this is needed even though images are unoptimized ──────────
     * `unoptimized: true` means next/image serves the file as-is rather than
     * through the optimizer, which is why every asset in public/ works with no
     * configuration. It does NOT switch off the check that a REMOTE src is
     * allowed: next/image still refuses a host that is not declared, and the
     * failure is a thrown error at render time rather than a broken image.
     *
     * Until the CMS, no image was remote — Phase 9 constrained every image
     * column to a site-relative path for exactly that reason. The media
     * library introduces the first images that are not in the repository, and
     * this is the one host they can come from.
     *
     * ─── The hostname is a wildcard, and the pathname is not ────────────
     * The project ref is a deployment detail: the same code runs against
     * production and against a staging project, and hard-coding one ref would
     * mean the config had to be edited to deploy. The PATHNAME is pinned
     * instead, to the public objects of this one bucket — so this declaration
     * admits the CMS media library and nothing else, not even another bucket
     * in the same project.
     *
     * The database enforces the same rule on the way in
     * (unchained_media_reference_ok), and lib/cms/sanitize.ts enforces it again
     * on the way out. This is the third statement of one rule, in the place
     * the framework reads.
     */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/unchained-cms-media/**',
      },
    ],
  },
};

export default nextConfig;
