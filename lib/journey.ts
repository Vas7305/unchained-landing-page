/**
 * The Unchained Challenge — journey log.
 *
 * Adding an entry to the top of this array publishes it to /journey. That is
 * the entire publishing workflow: one object, no CMS, no build step beyond the
 * normal deploy.
 *
 * TRANSPARENCY RULE: entries record what actually happened, including what did
 * not work. Never add a figure here that we cannot show evidence for.
 */

export type JourneyEntry = {
  /** Machine-sortable, e.g. '2026-08'. Also used as the anchor id. */
  id: string;
  /** Display date, e.g. 'August 2026'. */
  date: string;
  title: string;
  stage: string;
  built: string[];
  happened: string;
  learned: string;
  changed: string;
  nextMilestone: string;
};

export const currentStage = {
  label: 'Stage: Early',
  since: 'August 2026',
  facts: [
    { value: '~8 mo', label: 'Since the domain was established' },
    { value: '1', label: 'Completed flagship product' },
    { value: '5', label: 'Projects in development' },
    { value: '5 yr', label: 'Horizon we are building against' },
  ],
};

export const journeyEntries: JourneyEntry[] = [
  {
    id: '2026-08',
    date: 'August 2026',
    title: 'The Beginning of the Public Journey',
    stage: 'Early',
    built: [
      'TanCerca — our first completed flagship product: a marketplace platform with merchant systems, a consumer PWA, payments, subscriptions, referrals and delivery infrastructure.',
      'Five further projects, now in active development across software, automation and growth systems.',
      'The internal architecture, delivery process and standards we apply to every build.',
      'This site — rebuilt around what we have actually made rather than around claims.',
    ],
    happened:
      'We spent our first months building instead of marketing. That was deliberate: we wanted something real to point at before asking anyone to trust us with their business. The result is a portfolio of technical capability and a company that is early but not empty. What we do not have yet is a body of client outcomes — and we decided to say so plainly rather than paper over it.',
    learned:
      'Capability and reputation are not the same asset, and they are not earned the same way. Building a complex product proves we can build. It does not prove we can move a business metric for someone else. Conflating the two is how early companies end up making claims they cannot defend — so we separated them in our own language, on this site, permanently.',
    changed:
      'We widened our positioning from client acquisition alone to digital infrastructure: software, automation and growth systems. We made the portfolio the centre of the site instead of a footnote. We removed every metric and testimonial we could not evidence. And we started documenting this publicly, in this log.',
    nextMilestone:
      'Ship the next project from development to live, and publish our first client engagement with real, measured outcomes — reported here whether or not the numbers flatter us.',
  },
];

export const latestEntry = journeyEntries[0];
