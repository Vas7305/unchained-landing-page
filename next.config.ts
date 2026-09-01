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
  },
};

export default nextConfig;
