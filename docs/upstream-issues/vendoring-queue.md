# What is left to vendor, and why

Four demos run their product's own frontend: Lazara Sersa, Mensalere,
VectorForge and Lanna Kamilina. Four do not. This is the audited reason for
each, re-checked against the source on disk rather than carried forward from an
earlier assumption.

## Klassisches Ballett — no source

There is no repository for it on this machine or anywhere named. The demo stays
an approximation built from screenshots, and its palette is sampled from them.
Nothing to do until the source appears.

## Unchained OS — source not on this machine

The demo is an approximation. If the repository is available elsewhere, this is
the one most likely to vendor cleanly, since it is our own product and the demo
already models its real workflow.

## Frito — blocked by the build, not by the platform

**The earlier note in these docs said "React Native, cannot be vendored". That
was wrong**, and worth correcting precisely because the conclusion happened to
be right for the wrong reason.

Frito *does* target the web. `app.json` declares
`"platforms": ["ios", "android", "web"]`, `react-native-web@0.21` is a
dependency, and `dist/` holds a built web bundle. React Native alone would not
have stopped this.

What stops it is the **build integration**. `babel.config.js` requires three
Babel-level transforms:

```js
presets: [
  ['babel-preset-expo', { jsxImportSource: 'nativewind' }],  // NativeWind's JSX transform
  'nativewind/babel',
],
plugins: [
  'react-native-worklets/plugin',   // Reanimated v4 — must be the last plugin
]
```

and `metro.config.js` wraps the bundler with `withNativeWind`.

This repository has **no Babel config at all** — Next 16 builds it with
Turbopack and SWC. Introducing a `babel.config.js` to satisfy NativeWind and
Reanimated would switch the **entire site** off SWC, slow every build, and put a
production marketing site's toolchain at risk to serve one demo. That is exactly
the "no regressions, do not weaken the build" line the brief draws.

The alternative — building Frito with Metro and embedding the output — is a
separate application in a frame, not the product's components running in the
page, so it fails the brief's §"screenshots may not replace the interactive
frontend" in spirit.

**Verdict:** not vendorable *into this application*. Revisit if NativeWind ever
ships an SWC-compatible path, or if the demo moves to its own route with its own
bundler.

## TanCerca — vendorable, deliberately not vendored

Two different TanCerca codebases exist on disk:

| path | stack | what it is |
|---|---|---|
| `/d/TanCerca-app` | Flutter / Dart | the shipping consumer phone app |
| `/d/Tancerca` | React 19 + Vite 8 | the web app, with both consumer and merchant halves |

The Flutter app cannot be vendored — there is no path from Dart to React. The
**web app can be**, and it holds the journey the demo advertises: `routes/
explore`, `features/cart`, `routes/checkout.$id`, `features/orders` and
`features/delivery` for tracking.

### Measured scope

Closure from `explore` + `checkout` + `consumer/index`:

| | |
|---|---|
| files reached | **91** (VectorForge was 84, so: tractable) |
| of those, touching Supabase | **23** |
| external packages | **20** — TanStack Router *and* Query, framer-motion, sonner, Capacitor ×2, localforage, cva, tailwind-merge |
| `@theme` token collisions with this site | **28** — the worst yet |

The token collisions are worth dwelling on: both this site and TanCerca are
shadcn-flavoured Tailwind, so they collide on `--color-primary`,
`--color-background`, `--color-border`, `--color-muted`, `--radius-lg` and
twenty-three more. Namespacing is mandatory and larger than Lanna Kamilina's.

### The decision

**Not vendored, by decision rather than by obstacle.** The demo keeps its
hand-written approximation.

The reasoning that settled it: TanCerca ships a **Flutter** app to its
customers. `/d/Tancerca` is the web product — real code, but a different
surface from the one a prospect is being told about. Showing the web app's
components would trade an honest approximation of the shipping product for the
real code of a different one. Those are not the same promise.

Revisit only if the web app becomes the primary consumer surface.

### The one genuine security note, recorded because it was nearly got wrong

While auditing this, the auth guard in `routes/consumer.tsx` was first written
up here as a security boundary that a vendored copy would have to disable. **That
was an overstatement**, and the product's own comment says why:

```ts
// Client-side routing guard: read the persisted session (no /auth/v1/user
// network round-trip). getUser() is only needed for server-side validation;
// here RLS protects all data, so getSession() is the correct, faster choice.
```

The guard is *routing*. The security is Row Level Security in Supabase, server
side. With no backend behind a demo there is nothing for it to protect, so
bypassing it would have been a question of code faithfulness — a comment — and
not of risk.

**The real hazard is one file down.** `lib/supabase.ts` calls
`createClient(url, key)` from `import.meta.env`, and the repository carries
`.env` and `.env.local` with the live project's credentials. Vendored
carelessly, that file either breaks the build on the missing variables or — if
somebody "fixes" it by supplying them — publishes TanCerca's anon key from this
site's domain, pointing a marketing page at a production database. The anon key
is not secret by design, but it is scoped to *its own* origin and product; this
repository's rule is one Supabase project per web property.

So the correct treatment, should this ever be revisited, is: **never vendor
`lib/supabase.ts`**. Replace it with an adapter that constructs no client at
all. The 23 modules importing it then fail to compile until each has a
fixture-backed replacement — which makes the isolation structural rather than a
matter of trust. Same reasoning that removed `messengerBookingApi` from Lanna
Kamilina outright instead of merely leaving it unreferenced: *absent* is a
stronger guarantee than *unused*.

### What it would have cost, if it helps a future decision

Roughly twenty fixture-backed query adapters. The consumer shell pulls in
wallet, missions, streaks, mystery boxes, daily drops, exchange rates and
referrals alongside the cart and checkout, and most of that gamification is not
on the advertised journey — so a narrower closure (explore, cart, checkout,
order tracking, economy widgets stripped from the shell) would cut both the file
count and the invented data substantially.
