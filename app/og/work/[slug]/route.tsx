import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { findProject } from '@/lib/projects';
import { loadProjects } from '@/lib/portfolio';
import { OG_IMAGE_SIZE } from '@/lib/metadata';
import { siteConfig } from '@/lib/site';

type Params = { slug: string };

export const runtime = 'nodejs';

/** Ten minutes, matching PORTFOLIO_REVALIDATE_SECONDS. See app/page.tsx. */
export const revalidate = 600;

export async function generateStaticParams(): Promise<Params[]> {
  return (await loadProjects()).map((p) => ({ slug: p.slug }));
}

const PUBLIC_DIR = join(process.cwd(), 'public');

/** The brand mark, the same on every card, so it is read once per process. */
const markSrc = readFile(
  join(PUBLIC_DIR, 'Unchained Busines Favicon ok12 oscuro.jpg'),
).then((mark) => `data:image/jpeg;base64,${mark.toString('base64')}`);

/**
 * The screenshot as a PNG data URI, or null when there is none to show.
 *
 * ─── Why it goes through sharp ────────────────────────────────────────────
 * The screenshots are WebP, which is the reason this route exists: link
 * previews will not show a WebP og:image, and satori (what ImageResponse
 * draws with) cannot decode one either. So the file is re-encoded here and the
 * card that reaches the crawler is a PNG either way.
 *
 * A screenshot that cannot be read degrades to a card without one rather than
 * failing the image: a share preview with the project's name is still better
 * than none.
 */
async function screenshot(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    let input: Buffer;
    if (src.startsWith('/')) {
      // Site-relative, as mediaRef() guarantees. Resolved and checked anyway,
      // so a stray `..` can never read outside public/.
      const path = resolve(PUBLIC_DIR, `.${decodeURI(src)}`);
      if (!path.startsWith(PUBLIC_DIR + sep)) return null;
      input = await readFile(path);
    } else {
      const res = await fetch(src);
      if (!res.ok) return null;
      input = Buffer.from(await res.arrayBuffer());
    }
    const png = await sharp(input)
      .resize({ width: OG_IMAGE_SIZE.width - 96, withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * A project's share card: its screenshot above its name, 1200×630 PNG.
 *
 * A route handler rather than an `opengraph-image.tsx` beside the page,
 * because a file-convention image overrides the page's own metadata — and the
 * CMS's og_image override has to keep winning when an editor sets one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { slug } = await params;
  const project = findProject(await loadProjects(), slug);
  if (!project) return new Response('Not found', { status: 404 });

  const [shot, mark] = await Promise.all([
    screenshot(project.heroImage ?? project.thumbnail),
    markSrc,
  ]);

  const card = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: shot ? 'space-between' : 'center',
          backgroundColor: '#000000',
          padding: 48,
        }}
      >
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) renders its own <img>, not next/image
          <img
            src={shot}
            alt=''
            width={OG_IMAGE_SIZE.width - 96}
            height={404}
            style={{
              objectFit: 'cover',
              objectPosition: 'top',
              borderRadius: 16,
              border: '1px solid #26262b',
            }}
          />
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            src={mark}
            width={shot ? 72 : 160}
            height={shot ? 72 : 160}
            alt=''
            style={{ borderRadius: shot ? 12 : 24 }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginLeft: shot ? 24 : 44,
            }}
          >
            <div
              style={{
                fontSize: shot ? 44 : 64,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              {project.title}
            </div>
            <div
              style={{
                marginTop: shot ? 4 : 16,
                fontSize: shot ? 22 : 30,
                color: '#a3a3ad',
              }}
            >
              {`${project.category} · ${siteConfig.name}`}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );

  // Re-encoded to a palette PNG: a full-colour screenshot card comes out of
  // satori at ~700 KB, past the ~600 KB above which WhatsApp drops the
  // preview image. Quantised it is ~150 KB and indistinguishable at card size.
  const png = await sharp(Buffer.from(await card.arrayBuffer()))
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 8 })
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
}
