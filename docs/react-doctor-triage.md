# React Doctor - triage

Reviewed and acted on 2026-09-07. The report went from **8 findings to 3**, and
the three that remain are decisions rather than omissions.

The hook asks for GitHub issues on anything deferred; `gh` is not installed on
this machine, so the record lives here.

## Fixed

Three genuinely dead exports, removed. Nothing referenced them - not the app,
not the tests:

- `resetCountryDetection` in `lib/commercial/countryDetection.ts`. Its own
  comment called it a test seam; no test used it.
- `useTranslationList` in `lib/i18n/LanguageProvider.tsx`.
- `currentStage` in `lib/journey.ts`. Hardcoded English content on an i18n'd
  site, superseded by `journeyEntries`, which is what the page renders.

`npm run build`, 252 tests and `pnpm install --frozen-lockfile` all pass.

## Not fixed, and why

| rule | location | verdict |
|---|---|---|
| `deslop/duplicate-jsx-subtree` | `components/InsightArticleView.tsx:183` | won't fix - different concepts |
| `react-doctor/require-pnpm-hardening` | `pnpm-workspace.yaml` (`minimumReleaseAge`) | blocked, but only for ~90 more minutes |
| `react-doctor/require-pnpm-hardening` | `pnpm-workspace.yaml` (`trustPolicy`) | needs a human decision on 3 packages |

### `duplicate-jsx-subtree`

The related-reading list in `InsightArticleView` and the pillars list in
`InsightsIndex` share a card style: `group glow-border rounded-2xl bg-card p-6
flex flex-col gap-2 h-full ...`. They are not the same component.

|  | related reading | pillars |
|---|---|---|
| grid | `sm:grid-cols-2` | `sm:grid-cols-3` |
| number | none | yes |
| arrow | `items-start`, `mt-1` | `items-center` |
| target | an article | a pillar page |

Extracting one component would take four props to reconcile two things that are
not the same UI concept, and the two will drift apart rather than together. The
rule's own guidance covers this: *"Keep them separate when the resemblance is
incidental or the variants are likely to evolve independently."*

If the duplication ever does hurt, the cheaper move is a shared class constant
for the card chrome, not a shared component.

### `require-pnpm-hardening`

Re-verified by actually enabling both lines and running what Vercel runs.
`pnpm install --frozen-lockfile` exits 1 with 15 failed entries:

- **12x `MINIMUM_RELEASE_AGE_VIOLATION`** - all `next@16.3.4` and its `@next/*`
  binaries. Newest publish `2026-08-31T19:56:52Z`, cutoff
  `2026-08-31T18:27:16Z`: **ninety minutes short of seven days.** This one ages
  out on its own, today. Enable `minimumReleaseAge: 10080` once it does, as long
  as nothing has just been bumped.
- **3x `TRUST_DOWNGRADE`** - `eslint-import-resolver-typescript@3.10.1`,
  `semver@6.3.1`, `undici-types@6.21.0`. Old pinned transitives that predate npm
  provenance attestations. These never age out. Either resolve them fresh
  (`pnpm clean --lockfile && pnpm install`) or record why they are accepted -
  and that is a call for the code owner, not a lint fix.

The workspace file carries the same finding, dated, where somebody changing it
would look.

## A false positive worth remembering

`supabase/functions/create-unchained-member/index.ts` was reported as an unused
file. It is a Deno Edge Function - a deployment entry point invoked over HTTPS,
live on Unchained's project as `ACTIVE v3`, and the only path that creates a
commercial or a specialist. Nothing imports it and nothing should.

It no longer appears in the report, but the reasoning is kept because the rule
will flag it again the moment the surrounding findings shift.

## What was investigated and deliberately left alone

`lib/utils.ts` (`cn()`) and `class-variance-authority` / `clsx` /
`tailwind-merge` look dead, and today they are. They were removed and then put
back, because removing them was wrong twice over:

1. **shadcn is half-adopted, not abandoned.** `app/globals.css` line 3 is
   `@import "shadcn/tailwind.css"`, the file carries 17 theme variables, and the
   build emits ~75 KB of CSS containing 32 of them. The styling layer is live.
   `cn()` and those three packages are the half every generated component needs;
   the first `npx shadcn add` pulls them all straight back.
2. **Deleting `lib/utils.ts` breaks React Doctor itself.** With the file gone,
   every run ends in *"Results are incomplete: maintainability checks failed"* -
   with or without `components.json`. Restoring it brings the checks back.
   Trading a working analyzer for a lower finding count is a bad deal.
