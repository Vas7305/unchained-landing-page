/**
 * Insights — the site's editorial layer, and the collection it falls back to.
 *
 * ─── This file is no longer the source of truth ───────────────────────────
 * It was, until public.unchained_insights existed. Articles are now written
 * and published in the admin panel, and the site reads them through
 * lib/editorial.ts. What is left here is the three things that genuinely
 * belong in code — the same split lib/projects.ts made when the portfolio
 * moved into a table:
 *
 *   · the TYPES the components are written against, which the database's
 *     CHECK constraints mirror;
 *   · the SELECTORS, which are pure functions over a list and are applied to
 *     whichever list the caller holds;
 *   · the ARTICLES themselves, as the fallback for a build with no database
 *     behind it — a preview deploy, a local checkout with no .env, a moment
 *     when Supabase is unreachable.
 *
 * `insights` and `publishedInsights` keep their names and their contents. They
 * are a floor, not a mirror: they will drift from the table the first time
 * somebody edits an article in the panel, and that is expected. See
 * lib/editorial.ts for the cases that reach them and the one — a successful
 * answer of zero rows — that deliberately does not.
 *
 * PUBLISHING GATE: an entry marked `draft: true` is not published — it stays
 * out of the index and out of the sitemap. In the database the same rule is
 * `WHERE a.published AND a.archived_at IS NULL`, inside list_public_insights(),
 * where no caller can be involved in it.
 *
 * CONTENT RULE: an article is added when it has something to say, not to
 * demonstrate that the route works. Prose lives in the article object rather
 * than in the dictionaries — see components/InsightArticleView.tsx — so the
 * body carries no markup, and internal links are expressed through the model:
 * `pillar` and `caseStudySlug` are what the page turns into links.
 */


import type { Metadata } from 'next';
import { SITE_OG_IMAGE } from '@/lib/metadata';
import { buildCmsMetadata, type SeoFields } from '@/lib/cms/seo';
import type { Localized } from '@/lib/cms/localized';
import type { PillarSlug } from '@/lib/site';

/** One `<h2>` section of an article body. */
export type InsightSection = {
  heading: string;
  /** One string per paragraph. */
  body: string[];
  /** Optional bullet list, rendered after the paragraphs. */
  points?: string[];
};

export type InsightArticle = {
  /** URL segment. Unique across the collection. */
  slug: string;
  title: string;
  /** Meta description, and the excerpt shown on the index card. */
  description: string;
  /** Opening paragraph, shown under the title. */
  lede: string;
  /** ISO calendar date, e.g. '2026-09-14'. */
  publishedAt: string;
  /** ISO calendar date. Only set when an article is materially revised. */
  updatedAt?: string;
  /**
   * The article's single primary pillar. Reuses the `pillars` array in
   * lib/site.ts — an article may mention another pillar in its body, but it
   * has one primary intent, and there is no second taxonomy.
   */
  pillar: PillarSlug;
  sections: InsightSection[];
  /**
   * Slugs of other articles worth reading next. Editorially chosen — never
   * generated from keyword similarity.
   */
  relatedSlugs?: string[];
  /** Slug of a project in lib/projects.ts whose evidence the article rests on. */
  caseStudySlug?: string;
  /**
   * Overrides the site-wide OG image. Optional by design: an article with no
   * image of its own still gets a valid one (see `buildInsightMetadata`).
   */
  ogImage?: string;
  /** Written but not published. No page, no index entry, no sitemap entry. */
  draft?: boolean;

  // ─── Added when the editorial layer moved into the CMS ──────────────────
  // Every one is optional, so the articles in `insights` below — which are the
  // fallback for a build with no database — remain valid unchanged, and so
  // does every component reading this type.

  /** The image at the head of the article. Distinct from `ogImage`, which is
   *  the share preview and is often a different crop. */
  coverImage?: string;
  /** What the cover image shows, for a reader who cannot see it. */
  coverImageAlt?: string;
  /** Free-form labels. Used by the panel's filtering; the public site has no
   *  tag pages, and adding one is a routing decision, not a content one. */
  tags?: string[];
  /** The by-line. Absent on every article written before the field existed,
   *  and deliberately not backfilled — see scripts/generate-insight-seed.mjs. */
  author?: string;
  /** Editorially promoted on the index. */
  featured?: boolean;
  /** Editor-written SEO overrides. Absent means "derive from the content". */
  seo?: SeoFields;
  /** The article in the other five languages. See lib/cms/localized.ts. */
  translations?: Localized<InsightCopy>;
};

/**
 * The fields of an article that a translator writes.
 *
 * The slug, the dates, the pillar, the images and the curated links stay on the
 * parent: they are facts about the article rather than about a language.
 */
export type InsightCopy = Pick<
  InsightArticle,
  | 'title'
  | 'description'
  | 'lede'
  | 'sections'
  | 'coverImageAlt'
  | 'seo'
>;

export const insights: InsightArticle[] = [
  {
    slug: 'custom-software-or-saas',
    title: 'Custom Software or SaaS? A Framework for Deciding',
    description:
      'A practical framework for deciding when to buy SaaS, build custom software, combine both, or wait — based on strategic value, workflow complexity, economics and total cost of ownership.',
    lede: 'Build or buy is usually argued as a technology preference. It is closer to a capital allocation decision: a few parts of an operation are worth owning outright, most are not, and the difference is knowable before anyone writes code.',
    publishedAt: '2026-09-02',
    pillar: 'software-development',
    // The hybrid section names TanCerca as a worked example of the split it
    // describes — bought infrastructure underneath, custom where the workflow
    // is specific. The link is evidence for a claim the article makes.
    caseStudySlug: 'tancerca',
    sections: [
      {
        heading: 'The question is usually asked backwards',
        body: [
          'The conversation tends to arrive in the same shape: should we buy this product, or build something of our own? Framed that way it is a question about technology, and it gets answered with preferences — the operations lead has used the product before, the technical adviser would rather own the stack, and whoever controls the budget picks between two positions that were never really compared.',
          'The more useful question is narrower. Not “should we build custom software?” but “where does owning this software create enough value to justify the cost and complexity of owning it?” Ownership is not a one-off: it is a commitment to keep paying for something in exchange for control over it. That trade is excellent in some parts of a business and indefensible in others.',
          'It is also not a single decision. A company does not become a custom software company or a SaaS company; it makes this call separately for a dozen workflows — invoicing, scheduling, support, fulfilment, reporting — and the right answer differs across them. Most healthy setups are mostly bought, with a small owned core carrying the work nobody else does the same way.',
          'What follows is how to make that call one workflow at a time — including the cases where the honest answer is that neither option is appropriate yet.',
        ],
      },
      {
        heading: 'Start with the problem, not the software',
        body: [
          'Most build-versus-buy conversations start at the end. There is already a shortlist of products, or a proposal for a system, which means a solution is being evaluated before the problem has been written down. The cost of that is invisible at the time and obvious a year later, when the company is running a tool that solved a problem it turned out not to have.',
          'Four things need establishing first, and none of them requires a technology decision. What the workflow actually is, including the informal steps — the spreadsheet someone maintains on the side, the re-keying between two systems that never made it into the process document. Where it breaks, and who absorbs the breakage. What that breakage costs, in hours, errors and delayed revenue. And whether the workflow is something customers choose you for, or plumbing that has to work.',
          'This is also where a good number of custom software requests dissolve. A company convinced it needs a bespoke CRM often has a data problem and an accountability problem underneath: three systems disagree about who owns an account, and nobody is responsible for reconciling them. New software settles neither question. It encodes the confusion and charges for the privilege.',
        ],
        points: [
          'What is the workflow, including the steps nobody documented?',
          'Where does it break, and who absorbs the breakage today?',
          'What does that cost per month — in hours, errors, delays and lost revenue?',
          'Is this workflow a reason customers choose us, or is it plumbing?',
          'If we changed nothing for another year, what would that cost?',
        ],
      },
      {
        heading: 'When buying is the better decision',
        body: [
          'For most workflows in most businesses, buying wins, and it is not close. Payroll, accounting, email, support ticketing, standard CRM — these are solved problems, and a vendor amortises the cost of solving them across thousands of customers. No internal team matches that arithmetic on a workflow that looks the same everywhere.',
          'Speed is the other half of it. A configured product is running in weeks, at a price you can read off a page, and a wrong choice costs a subscription and a migration rather than two quarters of development budget. That bounded downside is worth more than it looks for a decision made under uncertainty — which most of these are.',
          'Mature products also carry the unglamorous eighty per cent nobody budgets for when they build: permissions and roles, audit trails, exports, mobile access, single sign-on, backups, an uptime record, and a support team that answers when something breaks at month end.',
          'Choosing SaaS is not the lesser decision. Buying the commodity is precisely how a company affords to build the one thing that is genuinely its own.',
        ],
        points: [
          'The workflow is essentially the same as it is at comparable companies.',
          'Doing it better than average is not why customers choose you.',
          'Implementation speed matters more than control.',
          'Customisation needs stop at configuration — fields, roles, templates, rules.',
          'The vendor’s roadmap is heading somewhere you can live with.',
          'If you had to leave in three years, you could get your data out and move.',
        ],
      },
      {
        heading: 'When custom software starts to make sense',
        body: [
          'Custom software earns its place on evidence rather than on the promise of flexibility, and the signals are already visible in how the business runs.',
          'The clearest is the accumulation of workarounds. Every export into a spreadsheet, every field used for something other than its name, every rule the team follows because the tool cannot express it — each is a small permanent tax, and together they measure how far the product sits from the actual process. When that tax is large and recurring, it becomes comparable with the cost of building something that does not levy it.',
          'The second is orchestration. A single system rarely needs replacing; the problem is usually that four of them each hold part of the truth and a person is the integration layer, moving records between them and resolving disagreements by hand. That role is expensive, error-prone and impossible to scale, and it is the shape of problem a custom layer solves well.',
          'The third is differentiation. If the process is a reason customers choose you — how you route jobs, how you price, how you deliver faster than the alternative — then renting it means your advantage is a configuration a competitor can subscribe to on the same terms tomorrow. Owning the software is one of the few ways to keep an operational advantage from being copied at that speed.',
          'Scale finishes the argument rather than starting it: friction that costs a little per transaction becomes a real number at volume, and per-seat pricing works against you as you grow — but only once the volume is real, never on projected usage.',
        ],
        points: [
          'The products would require you to change the process, not the settings.',
          'People are the integration layer between systems that ought to talk.',
          'The workflow is part of why customers choose you, not just how work gets done.',
          'The cost of the workaround scales with volume, and volume is growing.',
          'You need control over data or roadmap for a reason you can state.',
          'The system will still matter in three years, and someone will own it.',
        ],
      },
      {
        heading: 'A framework for weighing the decision',
        body: [
          'The framework below is nine dimensions. Score each from 1 to 5 for the specific workflow under discussion — not for the company as a whole, and not for a category of software. The value is not in the total; it is that the dimensions get argued separately, with evidence, instead of collapsing into a single opinion held by whoever is most senior in the room.',
        ],
        points: [
          'Strategic differentiation — if a competitor bought the same product tomorrow, how much of your advantage would disappear?',
          'Workflow uniqueness — how much of the process would have to change to fit the product, and would that change be an improvement or a loss?',
          'Integration complexity — how many systems have to agree, and who reconciles them today?',
          'Expected usage and scale — how many people and transactions, now and in twenty-four months?',
          'Economic impact — what does the friction cost per month, in numbers you can defend?',
          'Required control — what happens if pricing changes, the vendor is acquired, or the feature you depend on is deprecated?',
          'Time-to-value — what does a six-month wait cost, against two weeks of configuration?',
          'Internal capability — who owns this after launch, and is that a named commitment or an assumption?',
          'Long-term ownership cost — can you fund years two and three, not only the build?',
        ],
      },
      {
        heading: 'How to read the scores',
        body: [
          'The first six dimensions argue for building as they rise. The last three are constraints rather than justifications: heavy time pressure, no internal owner, or no budget beyond the build does not make buying more attractive in principle — it makes building unaffordable in practice, whatever the first six say.',
          'Three readings come up repeatedly. If differentiation and workflow uniqueness are both low, stop there: buy the product, configure it, and spend the attention somewhere it earns more. If both are high and the economic impact is high, building is likely to be worth it, provided the constraints allow. And if the six are split — high on integration and economics, low on differentiation — the answer is usually neither pure option.',
          'There is one more use for the exercise, and it is the one people skip. If you cannot put a number on economic impact, or name who will own the system after launch, the decision is not ready to be made — a finding rather than a failure, and far cheaper to reach in a scoring conversation than in month four of a build.',
        ],
      },
      {
        heading: 'The cost that gets left out',
        body: [
          'Development cost is the part of custom software that appears in the proposal, and it is not the part that decides whether the decision was right. A system that runs is a system somebody maintains.',
          'Past the build there is hosting, dependency upgrades, security patching, monitoring and the response when monitoring fires, backups, support for the people using it, the documentation that keeps it transferable, and the continuing development any system in active use requires. None of it is optional and all of it is annual. Where there is no budget line for year two, the honest conclusion is that the system should not be built in year one.',
          'Subscriptions compound in their own way. Per-seat pricing scales with headcount rather than with value received, and the capability you actually needed is often in the tier above or sold as an add-on. Then there is implementation, data migration, the connectors that keep the product talking to everything else, and the labour of the workarounds it forces. Switching cost is the one that moves: it grows with every month of data and process you place inside the product, which is why a tool that was a good decision in year one can be an expensive one by year four without anything about it having changed.',
          'Compare over one horizon — three to five years is usually enough — and keep a third column for changing nothing, since the status quo has a running cost too, and it is the one the business is already paying.',
        ],
        points: [
          'Build column: development, infrastructure, security, monitoring, support, documentation, upgrades, continuing development.',
          'Buy column: subscriptions at projected headcount, tier changes, add-ons, implementation, migration, integrations, workarounds.',
          'Both columns: the cost of the transition itself, and of leaving in three years.',
          'Third column: what the current way of working costs over the same period.',
        ],
      },
      {
        heading: 'Most good answers are hybrids',
        body: [
          'The binary framing is largely an artefact of who is selling: vendors compare themselves against building, agencies compare themselves against buying. Operators do both, and what the good arrangements share is a refusal to build anything that can be bought, and a refusal to rent the part of the operation that makes the business worth choosing.',
          'Hybrids fail in a predictable way, so they need one rule. For every important entity — customer, order, invoice, job — decide which system holds the truth, and make every other system a reader of it. The custom layer should depend on documented, stable interfaces, and the seam between bought and built should be as thin as you can make it. Without that discipline a hybrid becomes two systems that disagree, which is worse than either option alone.',
          'Our own product is built on that split. TanCerca is a marketplace with merchant tooling, delivery coordination and an operational layer we designed and built, running on payment and cloud infrastructure we did not build and had no reason to. The custom part is the part that had to match how local merchants and couriers work.',
        ],
        points: [
          'SaaS for accounting, payroll and email; custom for the workflow the business runs on.',
          'An existing CRM as the record of customers, with a custom operational layer for the pipeline specific to you.',
          'SaaS systems of record, with a custom reporting surface for what the built-in dashboards will not answer.',
          'Existing communication tools, with custom orchestration deciding what happens, when, and to whom.',
        ],
      },
      {
        heading: 'A sequence you can run this month',
        body: [
          'Turning any of this into a decision takes a sequence, and it is short enough to run in a couple of weeks without stopping the business.',
          'Step three is where most of the value sits. Companies routinely mistake familiarity for uniqueness: a process is not distinctive because it is yours, but because doing it differently produces a different result for the customer. Honesty there is what keeps a build proposal from becoming an expensive way to preserve a habit.',
          'Waiting is a real outcome, not a failure to decide. If the problem is undefined, if the process still changes every few weeks, if the volume is too low for the friction to cost anything meaningful, or if the process itself is broken, neither buying nor building will help — automating a broken process produces the same mess, faster and harder to see. Stabilise the workflow by hand for a quarter, instrument it enough to know what it costs, and revisit with numbers. A deliberate decision to wait, with a date on it, is a decision. Drifting is not.',
        ],
        points: [
          'Define the operational problem in writing, including the informal steps.',
          'Quantify what it costs today — hours, errors, delays, revenue.',
          'Separate what is genuinely unique about the process from what is merely familiar.',
          'Evaluate real SaaS options against the workflow, not against a feature list.',
          'Document the gaps and the workarounds each option would require.',
          'Estimate total cost of ownership for build, buy and status quo over one horizon.',
          'Score the nine dimensions, and argue the ones you disagree about.',
          'Decide: buy, build, combine — or wait, with a date to revisit.',
        ],
      },
      {
        heading: 'Build only what is worth owning',
        body: [
          'The principle underneath all of this is easy to state and harder to apply: build the parts of your digital infrastructure that create meaningful strategic or economic value, and buy the parts that do not.',
          'The two failure modes are symmetrical. Building the commodity is expensive and invisible — a custom invoicing system that does what a subscription does, with a maintenance burden attached and nothing gained. Renting the differentiator is cheap now and capped later: the operation runs inside somebody else’s product, at their pace, with a ceiling set by their roadmap. The first mistake shows up in the budget, the second in the strategy, and it is much harder to reverse.',
          'Most companies end up mostly bought, with a small custom core. The discipline is in keeping that core small and making sure it is the right part.',
          'Where the answer is genuinely unclear, the useful next step is not a proposal. It is an hour with the workflow written down, the numbers on the table and the real alternatives compared — which is how our software development work starts, and often enough it ends with a recommendation to buy something and get on with the business.',
        ],
      },
    ],
  },
];

/** Newest first; the ISO date format sorts lexicographically. */
function byNewestFirst(a: InsightArticle, b: InsightArticle): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function isPublished(article: InsightArticle): boolean {
  return article.draft !== true;
}

/** The only list any public surface should render. */
export const publishedInsights: InsightArticle[] = insights
  .filter(isPublished)
  .sort(byNewestFirst);

export function insightPath(slug: string): string {
  return `/insights/${slug}`;
}

/**
 * One published article by slug, or nothing.
 *
 * `pool` defaults to the fallback collection so existing callers and tests are
 * unchanged, and is passed explicitly by the routes, which read the database.
 * The same shape `resolveRelated` and `insightsForPillar` already had — a pure
 * selector over whichever list the caller holds, which is what let the
 * portfolio move into a table without rewriting its selectors.
 */
export function getPublishedInsight(
  slug: string,
  pool: InsightArticle[] = publishedInsights,
): InsightArticle | undefined {
  return pool.find((a) => a.slug === slug);
}

/**
 * The published articles of a list, newest first.
 *
 * Applied to whatever `loadInsights()` returned. The database already filters
 * and orders — `WHERE a.published` and `ORDER BY a.published_on DESC` inside
 * list_public_insights() — so over a database answer this is a no-op, and over
 * the fallback array it is what `publishedInsights` was computed with. Stating
 * it once means the two sources cannot present articles in different orders.
 */
export function publishedOf(pool: InsightArticle[]): InsightArticle[] {
  return pool.filter(isPublished).sort(byNewestFirst);
}

/**
 * The curated related articles that actually exist and are published. A slug
 * that names a draft, or an article that was never written, is dropped rather
 * than rendered as a dead link.
 */
export function resolveRelated(
  article: InsightArticle,
  pool: InsightArticle[] = publishedInsights,
): InsightArticle[] {
  return (article.relatedSlugs ?? [])
    .map((slug) => pool.find((a) => a.slug === slug))
    .filter(
      (a): a is InsightArticle =>
        a !== undefined && a.slug !== article.slug,
    );
}

/** Articles under one pillar — for the pillar pages' future reading lists. */
export function insightsForPillar(
  pillar: PillarSlug,
  pool: InsightArticle[] = publishedInsights,
): InsightArticle[] {
  return pool.filter((a) => a.pillar === pillar);
}

/**
 * Article metadata, derived entirely from the article's own data.
 *
 * Every value the root layout would otherwise supply — title, description,
 * canonical, and the whole Open Graph block — is overridden here through the
 * site's one metadata builder, so no article ever ships with the homepage's
 * share preview.
 */
export function buildInsightMetadata(article: InsightArticle): Metadata {
  return buildCmsMetadata(
    {
      title: article.title,
      description: article.description,
      path: insightPath(article.slug),
      type: 'article',
      // An article with no image of its own still gets a valid one: declaring
      // `openGraph` opts a route out of the root opengraph-image file
      // convention, so the site image has to be named explicitly.
      image: article.ogImage ?? article.coverImage ?? SITE_OG_IMAGE,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      // Belt and braces: the route only renders published articles, but a
      // draft that somehow reached a renderer must not be indexable.
      ...(article.draft ? { robots: { index: false, follow: false } } : {}),
    },
    // The editor's overrides, applied over those defaults. An article with
    // none produces exactly the metadata this function produced before the CMS
    // existed, which is what keeps app/insights/routes.test.ts meaningful.
    article.seo,
  );
}

/**
 * Publication dates are rendered in the reader's language. Parsed and
 * formatted in UTC so a calendar date never shifts by a day for a visitor
 * west of Greenwich.
 */
export function formatInsightDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
