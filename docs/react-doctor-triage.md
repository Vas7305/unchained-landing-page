# React Doctor — triage

The repo's stop hook runs React Doctor and reports 8 findings. None is a
regression from the database-isolation work; they are re-reported on every run
because the hook falls back to a full scan when it finds no feature branch.

This file exists so the triage is not re-derived from scratch each time. The
hook asks for GitHub issues for confirmed-but-deferred findings; `gh` is not
installed on this machine, so the record lives here instead.

Last reviewed: 2026-09-05.

| rule | location | verdict | confidence |
|---|---|---|---|
| `deslop/unused-export` | `lib/commercial/countryDetection.ts:144` | pre-existing, untouched by this work | high |
| `deslop/unused-export` | `lib/i18n/LanguageProvider.tsx:87` | pre-existing, untouched | high |
| `deslop/unused-export` | `lib/journey.ts:26` | pre-existing, untouched | high |
| `deslop/unused-file` | `lib/utils.ts` | **true positive** — see below | high |
| `deslop/unused-dependency` | `package.json` (`class-variance-authority`) | **true positive** — same cause | high |
| `deslop/unused-file` | `supabase/functions/create-unchained-member/index.ts` | **false positive** — see below | high |
| `react-doctor/require-pnpm-hardening` ×2 | `pnpm-workspace.yaml` | pre-existing, already answered in that file | high |

---

## `supabase/functions/…` is a false positive

The rule looks for a module nothing imports. Nothing does, and nothing should:
it is a Deno Edge Function, a **deployment entry point**, invoked over HTTPS by
the admin panel. It is live on Unchained's project (`create-unchained-member`,
`ACTIVE v3`) and is the only path that creates a commercial or a specialist.

Deleting it on this rule's advice would remove the invitation system.

Note that `tsconfig.json` already excludes `supabase/functions` — for a
different and unrelated reason: `next build` type-checks `**/*.ts` and cannot
compile Deno source (`Cannot find name 'Deno'`). That exclusion is not what
makes React Doctor flag the file, and reversing it would break the build.

## `lib/utils.ts` and the unused dependency are one finding

`lib/utils.ts` exports only `cn()`. Nothing in the repo references `cn(`,
`@/lib/utils`, `clsx` or `twMerge`, and there is no `components/ui` directory —
this is orphaned shadcn scaffolding that arrived with `components.json` and was
never used.

**Deleting the file alone makes the report worse.** `clsx` and `tailwind-merge`
are imported by nothing else, so removing `lib/utils.ts` turns one
`unused-dependency` finding into three.

The coherent fix is to remove the whole scaffold in one change:

- `lib/utils.ts`
- `components.json`
- `class-variance-authority`, `clsx`, `tailwind-merge` from `package.json`
- regenerate `pnpm-lock.yaml`

### Why it is deferred

It touches `pnpm-lock.yaml`, and this repo deploys on Vercel with
`--frozen-lockfile` — a lockfile that disagrees with `package.json` fails the
deploy rather than degrading. That is a small risk, but it is an *unrelated*
risk being taken during an active production cutover, for a cleanup with no
user-visible benefit.

Do it as its own change once the cutover is finished: delete, `pnpm install`,
then confirm `npm run build` and `pnpm install --frozen-lockfile` both pass
before pushing.

## `require-pnpm-hardening`

`pnpm-workspace.yaml` carries a long comment, written and dated when the rule
was first raised, explaining that `minimumReleaseAge` and `trustPolicy` are both
wanted and that each currently makes `pnpm install --frozen-lockfile` exit 1 —
which is what Vercel runs. The comment records what was verified, when, and
what has to happen before either can be enabled. Nothing to add here.
