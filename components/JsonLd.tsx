import { serializeJsonLd, type JsonLdNode } from '@/lib/structured-data';

/**
 * Renders one JSON-LD entity into the page.
 *
 * `dangerouslySetInnerHTML` is the standard — and only — way to emit a
 * `<script type="application/ld+json">` from React: JSX would otherwise
 * escape the JSON into HTML entities and no parser would read it. The payload
 * is never raw user input, and `serializeJsonLd` neutralises the characters
 * that could close the element early.
 */
export default function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
