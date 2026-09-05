/**
 * Long-form content for the three capability pages. Each page must carry real,
 * original substance — we do not publish thin pages for search alone.
 */

export type PillarContent = {
  slug: 'software-development' | 'business-automation' | 'growth-systems';
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  /** The concrete things we build in this pillar. */
  offerings: { name: string; body: string }[];
  /** How we think about the discipline — the opinionated part. */
  approach: { heading: string; body: string }[];
  /** Signals that this pillar is what a business actually needs. */
  signals: string[];
  /** Honest note about our stage in this specific pillar. */
  proof: string;
};

export const pillarContent: Record<string, PillarContent> = {
  'software-development': {
    slug: 'software-development',
    metaTitle: 'Software Development',
    metaDescription:
      'Websites, web applications, SaaS and custom business software built around how your business actually operates. Product architecture and full-stack development by Unchained Business.',
    eyebrow: 'Capability 01',
    title: 'Software Development',
    accent: '',
    lede: 'Digital products and business systems built around the way your business actually operates — not around whatever the template assumed.',
    offerings: [
      {
        name: 'Websites',
        body: 'Fast, accessible, well-structured sites that load quickly, rank properly and are genuinely editable by your team. Marketing sites, product sites, and the content architecture behind them.',
      },
      {
        name: 'Web Applications',
        body: 'Software your business runs on: dashboards, portals, booking and ordering systems, internal platforms. Built for the people who use them all day, not for a demo.',
      },
      {
        name: 'SaaS Products',
        body: 'Multi-tenant products with the parts founders underestimate — accounts and permissions, billing and subscriptions, onboarding, admin tooling, and the data model that has to survive version two.',
      },
      {
        name: 'Custom Software',
        body: 'When the process is your competitive advantage, generic tools flatten it. We build the system that matches how you actually work, and integrate it with what you already run.',
      },
      {
        name: 'Digital Products',
        body: 'Marketplaces, commerce platforms, and consumer-facing products, including the merchant, operations and payments infrastructure underneath them.',
      },
    ],
    approach: [
      {
        heading: 'The architecture comes before the code',
        body: 'Most expensive software problems are decisions made too early and revisited too late — the data model, the boundaries between systems, who owns which piece of truth. We settle those on paper, where changing your mind is free.',
      },
      {
        heading: 'Built in increments you can actually use',
        body: 'You see working software throughout the engagement, not a status report. That means feedback arrives while it is still cheap to act on, and there is no reveal at the end that either lands or does not.',
      },
      {
        heading: 'You own everything',
        body: 'Code, infrastructure, accounts and documentation are yours. We build so that another team could pick it up — which is also the discipline that keeps a codebase honest.',
      },
    ],
    signals: [
      'Your team maintains a spreadsheet that the software should be handling.',
      'Off-the-shelf tools force a workflow that does not match your business.',
      'You have a product idea and need someone who can architect it, not just implement tickets.',
      'An existing system works but cannot take the next order of magnitude.',
    ],
    proof:
      'TanCerca is the fullest demonstration of this pillar: a production marketplace platform with merchant dashboards, a consumer PWA, payments, subscriptions, referrals and delivery infrastructure — architected and built end to end.',
  },

  'business-automation': {
    slug: 'business-automation',
    metaTitle: 'Business Automation',
    metaDescription:
      'Workflow automation, systems integration, internal tools and operational systems. Unchained Business turns manual, repetitive processes into infrastructure that runs itself.',
    eyebrow: 'Capability 02',
    title: 'Business Automation',
    accent: '',
    lede: 'Eliminate repetitive work, connect your tools, and turn manual processes into systems that run whether or not someone remembers to run them.',
    offerings: [
      {
        name: 'Workflow Automation',
        body: 'The recurring sequences your team performs by hand — intake, approvals, onboarding, invoicing, reporting — rebuilt so they execute reliably and surface only the decisions that need a human.',
      },
      {
        name: 'Integrations',
        body: 'Your CRM, billing, support, scheduling and internal systems, connected so data moves once and stays consistent. No more copy-paste between six tabs, no more disagreeing sources of truth.',
      },
      {
        name: 'Internal Tools',
        body: 'The admin panel, ops console or review queue your team needs but no vendor sells. Usually small, usually the highest-leverage thing we build in an engagement.',
      },
      {
        name: 'Operational Systems',
        body: 'The infrastructure that keeps day-to-day delivery moving: scheduling, fulfilment, status tracking, notifications, and the reporting that tells you where it is stuck.',
      },
    ],
    approach: [
      {
        heading: 'Map the process before automating it',
        body: 'Automating a broken process gets you the same mess, faster and harder to see. We map what actually happens — including the informal steps people invented to cope — and fix the process first.',
      },
      {
        heading: 'Automate the boring 80%, keep humans on the rest',
        body: 'The goal is not to remove judgement from your business. It is to stop spending judgement on data entry. We automate the deterministic parts and design clean hand-offs for everything that needs a person.',
      },
      {
        heading: 'Observable by default',
        body: 'An automation you cannot see is a liability. Every system we build reports what it did, what it skipped and what failed — so a silent breakage does not become a quarterly surprise.',
      },
    ],
    signals: [
      'The same data gets typed into more than one system.',
      'A critical process depends on one person remembering to do it.',
      'Reporting means assembling a spreadsheet by hand every week.',
      'Your tools each do their job, but nothing connects them.',
    ],
    proof:
      'Automation is what makes our product work operationally: TanCerca coordinates orders, merchants, delivery, payments and subscriptions without someone manually holding the pieces together. That operational layer is the same discipline we apply to client processes.',
  },

  'growth-systems': {
    slug: 'growth-systems',
    metaTitle: 'Growth Systems',
    metaDescription:
      'Client acquisition, lead qualification, nurturing and conversion systems. Unchained Business builds the growth infrastructure that turns attention into predictable opportunities.',
    eyebrow: 'Capability 03',
    title: 'Growth Systems',
    accent: '',
    lede: 'Once the digital foundation is in place, we build the systems that help a business attract, qualify, convert and retain customers — structurally, not through effort.',
    offerings: [
      {
        name: 'Client Acquisition',
        body: 'The end-to-end path from first attention to booked conversation: positioning, offer clarity, the landing surfaces that carry them, and the mechanics that move someone from interested to in touch.',
      },
      {
        name: 'Lead Qualification',
        body: 'Filtering built into the system rather than into your calendar. The right questions asked at the right moment, so the conversations you take are with people you can actually help.',
      },
      {
        name: 'Nurturing',
        body: 'Structured follow-up for the majority who are not ready today. Sequenced, relevant, and automatic — because the alternative is a pipeline that depends on someone remembering.',
      },
      {
        name: 'Conversion Systems',
        body: 'Instrumented funnels, tested surfaces and measured hand-offs, so improvements are based on where people actually drop out rather than on opinion.',
      },
    ],
    approach: [
      {
        heading: 'Infrastructure, not tactics',
        body: 'Tactics decay. A tactic that works this quarter is a channel everyone copies next quarter. What holds value is the system underneath — how attention is captured, qualified, followed up and measured — because it survives any individual channel going quiet.',
      },
      {
        heading: 'Foundation first',
        body: 'Growth systems amplify whatever they sit on. If the site is slow, the data is fragmented or the follow-up is manual, more traffic mostly produces more leakage. We often fix or build the foundation before adding acquisition on top — which is exactly why this is the third pillar and not the first.',
      },
      {
        heading: 'Measured honestly',
        body: 'We instrument the funnel so the numbers describe reality, including when they are unflattering. A system that reports its own weak point is more valuable than one that reports a good-looking total.',
      },
    ],
    signals: [
      'Leads arrive but follow-up depends on whoever has time.',
      'You are generating attention that does not convert into conversations.',
      'You cannot say which step of your funnel loses the most people.',
      'Acquisition works when you push it, and stops when you stop.',
    ],
    proof:
      'Client acquisition systems are where Unchained Business started, and they remain a core capability. We are applying them to our own company first — this site, its instrumentation and the journey log are that system running on ourselves, in public.',
  },
};
