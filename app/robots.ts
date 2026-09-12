import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      /**
       * Preview pages are never for a crawler.
       *
       * ─── This is the outermost of four walls, not the only one ────────
       * A robots rule is a request, honoured by the crawlers that choose to,
       * and it also publishes the existence of the path. It is listed here as
       * belt-and-braces, and the disclosure costs nothing: the path prefix is
       * not the secret. What protects a draft is, in order of strength:
       *
       *   1. the token — 244 bits of randomness, minted per content item,
       *      expiring, revocable, stored only as a sha256 hash. Without it
       *      /preview/... returns a not-found page and no content;
       *   2. `robots: { index: false, follow: false }` on the preview routes
       *      themselves, which is a directive in the document rather than a
       *      request in a file crawlers may not fetch;
       *   3. the routes being dynamic and absent from the sitemap, so nothing
       *      links to them and nothing submits them;
       *   4. this line.
       *
       * /api/ is disallowed for the ordinary reason: it serves no documents,
       * and the one route under it is a POST endpoint.
       */
      disallow: ['/preview/', '/api/'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
