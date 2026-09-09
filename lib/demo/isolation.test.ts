import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * §31, as a test rather than as a promise.
 *
 * ─── What this enforces ───────────────────────────────────────────────────
 * The demos must not read a production database, call a production endpoint,
 * carry a credential, or depend on the backend being up. Everything they need
 * is a module constant and everything they do is a reducer. That is easy to
 * state and easy to break six months from now with one convenient import, so
 * it is checked mechanically: every source file under lib/demo/ and
 * components/demo/ is read and searched for the primitives that would make it
 * false.
 *
 * A failure here is not a style complaint. It means a demo has grown a way to
 * reach the outside world, and the fix is to remove it rather than to widen
 * the list below.
 *
 * ─── What it deliberately does not forbid ─────────────────────────────────
 * Importing the website's own components. components/demo/DemoShell.tsx is the
 * *site's* chrome around a demo — its heading, its links, its "Start a
 * project" button — and that button behaves there exactly as it does on every
 * other page. The boundary this suite polices is the demo's own data path, not
 * whether the page around it is still the website.
 *
 * lib/analytics.ts is likewise allowed: it is a dispatcher onto whatever
 * provider the site already has, it makes no request of its own, and §25 asks
 * for demo interest to be measurable through the existing architecture.
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');

const SCANNED = [join(root, 'lib', 'demo'), join(root, 'components', 'demo')];

/**
 * The files that actually ship.
 *
 * Test modules are excluded, and not as a convenience: this suite's own
 * `FORBIDDEN` list is a set of regular expressions naming every banned
 * primitive, so a scan that included test files would always find itself. The
 * rule being enforced is about code that reaches a browser, which no `.test.ts`
 * ever does.
 */
const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.test\.tsx?$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return SOURCE.test(entry) && !TEST.test(entry) ? [full] : [];
  });
}

/**
 * The file with its comments removed.
 *
 * Necessary because these modules explain their own constraints in prose —
 * "a demo module importing @/lib/portfolio … is a bug" is a sentence that
 * would otherwise trip the very rule it describes. Only the code is scanned.
 *
 * The line-comment rule skips `//` preceded by a colon so a `https://` inside
 * a string is not mistaken for the start of a comment. No demo module contains
 * a URL, so this is belt and braces.
 */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Things a frontend-only demo has no business containing. */
const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: 'network request (fetch)', pattern: /\bfetch\s*\(/ },
  { label: 'network request (XHR)', pattern: /\bXMLHttpRequest\b/ },
  { label: 'network request (WebSocket)', pattern: /\bWebSocket\b/ },
  { label: 'network request (EventSource)', pattern: /\bEventSource\b/ },
  { label: 'beacon', pattern: /sendBeacon/ },
  { label: 'Supabase', pattern: /supabase/i },
  { label: 'PostgREST endpoint', pattern: /\/rest\/v1\// },
  { label: 'environment variable', pattern: /process\s*\.\s*env/ },
  { label: 'API key or token', pattern: /(anon_?key|service_?role|api_?key|bearer\s)/i },
  { label: 'the portfolio data layer', pattern: /@\/lib\/portfolio/ },
  { label: 'the commercial routing layer', pattern: /@\/lib\/commercial/ },
  { label: 'browser storage', pattern: /\b(localStorage|sessionStorage|indexedDB)\b/ },
];

const files = SCANNED.flatMap(sourceFiles);

describe('the demo system', () => {
  it('has files to check', () => {
    // Guards the suite itself: a scan that silently found nothing would pass
    // for ever, including after somebody moved the demos elsewhere.
    expect(files.length).toBeGreaterThan(20);
  });

  describe.each(FORBIDDEN)('never reaches for $label', ({ pattern }) => {
    it('in any demo module', () => {
      const offenders = files.filter((file) =>
        pattern.test(code(readFileSync(file, 'utf8'))),
      );

      expect(
        offenders.map((file) => relative(root, file).split(sep).join('/')),
      ).toEqual([]);
    });
  });

  it('keeps every demo application inside its own folder', () => {
    // One demo importing another's fixtures would make "reset this demo" and
    // "this demo is one chunk" both false.
    const appFiles = files.filter((file) =>
      file.split(sep).includes('apps'),
    );

    for (const file of appFiles) {
      const parts = file.split(sep);
      const slug = parts[parts.indexOf('apps') + 1];
      const source = code(readFileSync(file, 'utf8'));

      const crossImports = [
        ...source.matchAll(/@\/(?:lib|components)\/demo\/apps\/([\w-]+)/g),
      ]
        .map((match) => match[1])
        .filter((other) => other !== slug);

      expect({
        file: relative(root, file).split(sep).join('/'),
        crossImports,
      }).toEqual({
        file: relative(root, file).split(sep).join('/'),
        crossImports: [],
      });
    }
  });
});
