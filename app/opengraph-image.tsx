import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site';
import { OG_IMAGE_SIZE } from '@/lib/metadata';
import { ogLogoHeight, ogLogoSrc } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_IMAGE_SIZE;
export const contentType = 'image/png';
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;

const LOGO_WIDTH = 840;

/**
 * Root-level file-convention OG image (Next.js metadata API). Applies to
 * every route that does not define its own opengraph-image, which today is
 * every route in the app — so this is the one image indexable pages need.
 */
export default async function OpengraphImage() {
  const logo = await ogLogoSrc;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) renders its own <img>, not next/image */}
        <img
          src={logo}
          width={LOGO_WIDTH}
          height={ogLogoHeight(LOGO_WIDTH)}
          alt=''
        />
        <div
          style={{
            marginTop: 56,
            fontSize: 32,
            color: '#a3a3ad',
          }}
        >
          {siteConfig.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
