/**
 * SEO layer.
 *
 * A single-page app still has to answer to Yandex and Google, so titles,
 * descriptions, canonicals, Open Graph and JSON-LD are all written into the
 * document head from one place. Structured data is built from the same typed
 * models the UI renders, so the two can never drift.
 *
 * Guard rail: nothing marked `source: 'mock'` is ever emitted as a factual
 * claim in structured data. Search engines get silence, not invented ratings.
 */

import type {
  BusinessInformation,
  ReputationSummary,
  Service,
  SeoInput,
  Specialist,
} from '../types';
import { absoluteUrl, SITE_ORIGIN } from './routes';
import { formatDuration } from './format';

const MANAGED = 'data-seo-managed';

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(MANAGED, '');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    el.setAttribute(MANAGED, '');
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Writes the head for the current page and returns a cleanup for JSON-LD. */
export function applySeo(input: SeoInput): () => void {
  const url = absoluteUrl(input.path);

  document.title = input.title;
  document.documentElement.lang = 'ru';

  upsertMeta('meta[name="description"]', { name: 'description', content: input.description });
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: input.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
  });
  upsertLink('canonical', url);

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: input.type ?? 'website' });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: input.title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: input.description,
  });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[property="og:site_name"]', {
    property: 'og:site_name',
    content: 'Lanna Kamilina',
  });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ru_RU' });
  upsertMeta('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: 'summary_large_image',
  });
  if (input.image) {
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: absoluteUrl(input.image),
    });
  }

  const nodes = input.jsonLd ?? [];
  const scripts = nodes.map((node) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(MANAGED, '');
    script.textContent = JSON.stringify(node);
    document.head.appendChild(script);
    return script;
  });

  return () => scripts.forEach((script) => script.remove());
}

/* ------------------------------------------------------------- JSON-LD ---- */

export function localBusinessSchema(
  business: BusinessInformation,
  reputation: ReputationSummary[],
): Record<string, unknown> {
  const verified = reputation.filter((item) => item.source === 'real');
  const best = verified[0];

  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    '@id': `${SITE_ORIGIN}/#business`,
    name: business.name,
    url: SITE_ORIGIN,
    foundingDate: String(business.foundedYear),
    priceRange: '₽₽₽',
    areaServed: { '@type': 'City', name: business.legalCity },
  };

  if (business.phone) node.telephone = business.phone;
  if (business.email) node.email = business.email;

  if (business.address) {
    node.address = {
      '@type': 'PostalAddress',
      addressLocality: business.legalCity,
      addressCountry: 'RU',
      streetAddress: business.address,
    };
  }

  if (business.coordinates) {
    node.geo = {
      '@type': 'GeoCoordinates',
      latitude: business.coordinates.lat,
      longitude: business.coordinates.lng,
    };
  }

  const hours = business.openingHours.flatMap((entry) =>
    entry.opens && entry.closes
      ? {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: entry.days,
          opens: entry.opens,
          closes: entry.closes,
        }
      : [],
  );
  if (hours.length) node.openingHoursSpecification = hours;

  const sameAs = [business.yandexMapsUrl, business.twoGisUrl, business.vkUrl].filter(
    (value): value is string => Boolean(value),
  );
  if (sameAs.length) node.sameAs = sameAs;

  // Only verified ratings reach structured data.
  if (best) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: best.rating.value,
      reviewCount: best.rating.count,
      bestRating: 5,
    };
  }

  return node;
}

export function serviceSchema(service: Service, business: BusinessInformation): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    description: service.description,
    serviceType: service.title,
    provider: { '@id': `${SITE_ORIGIN}/#business` },
    areaServed: { '@type': 'City', name: business.legalCity },
    url: absoluteUrl(`/uslugi/${service.slug}`),
  };

  if (service.source === 'real') {
    node.offers = {
      '@type': 'Offer',
      price: service.price.from,
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
    };
  }

  node.additionalProperty = {
    '@type': 'PropertyValue',
    name: 'Длительность',
    value: formatDuration(service.duration),
  };

  return node;
}

export function personSchema(specialist: Specialist): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: specialist.name,
    jobTitle: specialist.role,
    worksFor: { '@id': `${SITE_ORIGIN}/#business` },
    url: absoluteUrl(`/mastera/${specialist.slug}`),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function websiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: SITE_ORIGIN,
    name: 'Lanna Kamilina',
    inLanguage: 'ru-RU',
    publisher: { '@id': `${SITE_ORIGIN}/#business` },
  };
}
