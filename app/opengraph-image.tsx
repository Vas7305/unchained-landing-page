import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { siteConfig } from '@/lib/site';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;

/**
 * Root-level file-convention OG image (Next.js metadata API). Applies to
 * every route that does not define its own opengraph-image, which today is
 * every route in the app — so this is the one image indexable pages need.
 */
export default async function OpengraphImage() {
  const markPath = join(
    process.cwd(),
    'public',
    'Unchained Busines Favicon ok12 oscuro.jpg',
  );
  const mark = await readFile(markPath);
  const markSrc = `data:image/jpeg;base64,${mark.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#000000',
          padding: '0 80px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) renders its own <img>, not next/image */}
        <img
          src={markSrc}
          width={260}
          height={260}
          alt=''
          style={{ borderRadius: 32 }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 56,
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 30,
              color: '#a3a3ad',
              maxWidth: 780,
            }}
          >
            {siteConfig.tagline}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
