/**
 * English is the source of truth for every translatable string on the site.
 *
 * The other locale files are typed against these keys, so a missing or renamed
 * translation is a build error rather than a silent fallback at runtime.
 *
 * Proper nouns stay out of here: project names (TanCerca, Frito, Unchained OS),
 * technology names (Next.js, PostgreSQL, PWA) and the company name are the same
 * in every language and live in the data files.
 */

export const en = {
  // ── Chrome ────────────────────────────────────────────────────────────────
  'common.skipToContent': 'Skip to content',
  'common.homeAlt': 'Unchained Business — home',
  'common.exploreOurWork': 'Explore Our Work',
  'common.followTheJourney': 'Follow the Journey',

  'nav.whatWeBuild': 'What We Build',
  'nav.ourWork': 'Our Work',
  'nav.journey': 'Journey',
  'nav.insights': 'Insights',
  'nav.howWeWork': 'How We Work',
  'nav.faq': 'FAQ',
  'nav.startProject': 'Start a Project',
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',

  'nav.mainNav': 'Main',
  'nav.mobileNav': 'Mobile',

  'language.label': 'Language',
  'language.select': 'Select language',

  // ── Hero ──────────────────────────────────────────────────────────────────
  'hero.badge': 'Software · Automation · Growth Systems',
  'hero.headlineLead': 'Digital Infrastructure',
  'hero.headlineTail': 'for Businesses Ready to Grow.',
  'hero.description':
    'We design and build the software, websites, automation and growth systems a business runs on — architected around how it actually operates, not around a template.',
  'hero.scroll': 'Scroll',
  'hero.factFlagship': 'Flagship product shipped',
  'hero.factInDevelopment': 'Projects in development',
  'hero.factPillars': 'Capability pillars',

  // ── Pain points ───────────────────────────────────────────────────────────
  'pain.eyebrow': 'Sound Familiar?',
  'pain.title': 'The Business Works.',
  'pain.titleAccent': 'The Infrastructure Doesn’t.',
  'pain.body':
    'Most growing businesses are held together by effort rather than by systems. That works right up until the moment it has to scale.',
  'pain.manual.title': 'Manual Work That Should Be Automatic',
  'pain.manual.body':
    'Your team re-types the same data, chases the same approvals, and rebuilds the same report every week. The process works — but only because people keep carrying it.',
  'pain.tools.title': 'Tools That Do Not Talk to Each Other',
  'pain.tools.body':
    'Six subscriptions, six sources of truth, and a spreadsheet holding them together. Every integration gap becomes someone’s daily copy-and-paste job.',
  'pain.software.title': 'Software That Fights How You Operate',
  'pain.software.body':
    'Off-the-shelf tools force your business to work their way. So you build workarounds around the workarounds, and the real process lives in people’s heads.',
  'pain.growth.title': 'Growth That Depends on Someone Remembering',
  'pain.growth.body':
    'Leads arrive, then stall. Follow-up happens when there is time. Nothing is broken exactly — it is just that none of it is a system yet.',

  // ── Capabilities ──────────────────────────────────────────────────────────
  'cap.eyebrow': 'Capabilities',
  'cap.title': 'What We Build',
  'cap.body':
    'Three pillars, one system. Most businesses need more than one — and they need the pieces to fit together.',
  'cap.learnMore': 'Learn more',

  'pillar.software-development': 'Software Development',
  'pillar.business-automation': 'Business Automation',
  'pillar.growth-systems': 'Growth Systems',

  'pillarSummary.software-development':
    'Digital products and business systems built around the way your business actually operates.',
  'pillarSummary.business-automation':
    'Eliminate repetitive work, connect your tools, and turn manual processes into systems.',
  'pillarSummary.growth-systems':
    'Build structured systems that turn attention, leads, and customer interactions into predictable opportunities.',

  // ── Work section ──────────────────────────────────────────────────────────
  'work.eyebrow': 'Proof',
  'work.title': 'Our Work',
  'work.titleAccent': 'Is Our Proof.',
  'work.body':
    'We are building Unchained Business one project at a time. These are the products, websites and systems we are creating along the way.',
  'work.exploreAll': 'Explore all our work',
  'work.note':
    'Projects in development are published here when they launch — named, documented and honest about their status.',

  'flagship.badge': 'Flagship Product',
  'flagship.proves': 'What it proves',
  'flagship.view': 'View the project',
  'flagship.interfaceAlt': 'product interface',

  // ── The Unchained Challenge ───────────────────────────────────────────────
  'challenge.eyebrow': 'Build → Prove → Scale',
  'challenge.title': 'The Unchained Challenge',
  'challenge.lede': 'Build a global technology company. One project at a time.',
  'challenge.build.label': 'Build',
  'challenge.build.body':
    'Create real products and prove technical capability.',
  'challenge.prove.label': 'Prove',
  'challenge.prove.body':
    'Put that capability to work for businesses and measure what happens.',
  'challenge.scale.label': 'Scale',
  'challenge.scale.body':
    'Turn what works into infrastructure other companies can rely on.',
  'challenge.weAreHere': 'We are here',
  'challenge.p1':
    'Unchained Business is still in its early stages. We’ve spent our first months building real products, digital systems and technical capabilities. Now we’re taking the next step: putting those capabilities to work for businesses around the world.',
  'challenge.p2':
    'We’re documenting that journey openly — the projects, experiments, wins, failures, lessons and milestones.',
  'challenge.quote':
    'Our first proof is what we’ve built. Our next proof will be what we help our clients achieve.',

  // ── About ─────────────────────────────────────────────────────────────────
  'about.eyebrow': 'Who We Are',
  'about.title': 'Our First Case Study',
  'about.titleAccent': 'Is Ourselves.',
  'about.p1':
    'Before we ask businesses to trust us with their growth, we’re putting our own systems, decisions and execution to the test.',
  'about.p2':
    'Unchained Business is an early-stage technology company. We don’t have a decade of case studies behind us — we have a flagship product in production, five more projects in development, and a deliberate plan to earn the rest.',
  'about.p3':
    'We’re not trying to look established. We’re building something worth becoming established for.',
  'about.readLog': 'Read the journey log',
  'about.howWeOperate': 'How we operate',
  'about.build.title': 'Build',
  'about.build.body':
    'Make the thing. Real products, in production, with real constraints.',
  'about.measure.title': 'Measure',
  'about.measure.body':
    'Track what the system actually does, not what we hoped it would do.',
  'about.document.title': 'Document',
  'about.document.body':
    'Publish the result — including the parts that did not work.',
  'about.improve.title': 'Improve',
  'about.improve.body': 'Feed every lesson back into the next build.',
  'about.scale.title': 'Scale',
  'about.scale.body': 'Repeat what proves itself. Discard what does not.',

  // ── How it works ──────────────────────────────────────────────────────────
  'how.eyebrow': 'The Process',
  'how.title': 'How We Work',
  'how.body':
    'The same five phases whether we’re building a website, a SaaS product, an automation layer or a growth system.',
  'how.discover.title': 'Discover',
  'how.discover.body':
    'We start with the business, not the technology. How the work actually flows, where it breaks, who it serves, and what the market rewards — before anyone writes a line of code.',
  'how.architect.title': 'Architect',
  'how.architect.body':
    'We define the system on paper first: data model, surfaces, integrations, and the sequence of delivery. Decisions are cheap here and expensive later.',
  'how.build.title': 'Build',
  'how.build.body':
    'Design and development run together, in working increments you can see and use. No six-month black box, no big-bang reveal at the end.',
  'how.launch.title': 'Launch',
  'how.launch.body':
    'Deploy, integrate, test under real conditions, and hand over something your team can actually operate — with the documentation to match.',
  'how.optimize.title': 'Optimize',
  'how.optimize.body':
    'Real usage tells you things planning cannot. We measure how the system performs and improve it against what the data shows.',

  // ── Engagements ───────────────────────────────────────────────────────────
  'svc.eyebrow': 'Working Together',
  'svc.title': 'Three Ways to',
  'svc.titleAccent': 'Start With Us',
  'svc.body':
    'We don’t sell courses or templates. We architect, build and run the systems your business operates on.',
  'svc.coreBuild': 'The Core Build',
  'svc.discovery.tag': 'Start Here',
  'svc.discovery.title': 'Discovery & Architecture',
  'svc.discovery.description':
    'We deep-dive into how your business operates, where the process breaks, and what the system needs to do. You leave with an architecture and a delivery plan — whether or not we build it.',
  'svc.build.tag': 'Core Engagement',
  'svc.build.title': 'Design & Build',
  'svc.build.description':
    'We design and develop the product or infrastructure end to end — websites, web applications, SaaS, custom software, or the automation layer connecting them.',
  'svc.growth.tag': 'Ongoing',
  'svc.growth.title': 'Growth & Optimization',
  'svc.growth.description':
    'Once the digital foundation is in place, we build the systems that help a business attract, qualify, convert and retain customers — and keep improving them against real data.',

  // ── FAQ ───────────────────────────────────────────────────────────────────
  'faq.eyebrow': 'Questions',
  'faq.title': 'Common Questions',
  'faq.q1': 'What exactly does Unchained Business build?',
  'faq.a1':
    'Digital infrastructure: websites, web applications, SaaS products and custom software; the automation layer that connects your tools and removes manual work; and the growth systems that turn attention and leads into predictable opportunities. Most engagements involve more than one of the three.',
  'faq.q2': 'How established is the company?',
  'faq.a2':
    'We are early stage, and we would rather say so than imply otherwise. The domain was established around eight months ago. TanCerca — a full marketplace platform with merchant systems, payments, subscriptions and delivery infrastructure — is our first completed flagship product, and five further projects are in development. What we can demonstrate today is technical capability. Client outcomes are what we are building next, and we publish them as they happen.',
  'faq.q3': 'Why should I work with an early-stage company?',
  'faq.a3':
    'Because you get the people who architect the system actually building it, and a company whose reputation depends on your project going well. We are transparent about the trade-off: we are not the safe, established choice, and if you need a decade of comparable case studies, we are not it yet. What we offer instead is senior attention, a documented process, and work you can inspect.',
  'faq.q4': 'Can I see what you have built?',
  'faq.a4':
    'Yes — that is the point of our portfolio. TanCerca has a full project page covering its architecture, the problem it solves and what it demonstrates technically. The projects still in development are listed with their real status, and we publish each one when it launches rather than before.',
  'faq.q5': 'Do you still build client acquisition systems?',
  'faq.a5':
    'Yes. It is now one of three pillars rather than the whole company. Growth systems work best once the digital foundation underneath them is solid, so we often build or repair that foundation first — and then the acquisition, qualification, nurturing and conversion layer on top of it.',
  'faq.q6': 'How do projects usually start?',
  'faq.a6':
    'With discovery and architecture: a fixed-scope engagement where we map how your business operates, define the system, and produce a delivery plan. You own that plan whether or not we build it. From there most clients move into a design and build engagement.',
  'faq.q7': 'What is the investment?',
  'faq.a7':
    'Engagements are scoped to the system being built, so we do not publish generic pricing. On an initial call we will tell you what your project realistically involves and what it would cost — including when the honest answer is that you need something smaller than you asked for.',

  // ── Closing CTA ───────────────────────────────────────────────────────────
  'cta.badge': 'Free 30-Minute Intro Call',
  'cta.title': 'Tell Us What You’re',
  'cta.titleAccent': 'Trying to Build.',
  'cta.body':
    'Bring us the problem, not the spec. We’ll map what the system needs to do, tell you what it would realistically take to build, and be straight with you if it isn’t a fit.',
  'cta.note': 'No sales pressure. No obligation. Just clarity.',
  'cta.notReady': 'Not ready? Explore our work →',
  'cta.orJourney': 'Or follow the journey →',

  // ── Project statuses ──────────────────────────────────────────────────────
  'status.completed.label': 'Completed',
  'status.completed.description': 'Built, shipped and live.',
  'status.in-development.label': 'In Development',
  'status.in-development.description': 'Currently being designed and built.',
  'status.concept.label': 'Concept',
  'status.concept.description': 'Defined and validated, not yet in build.',
  'status.internal.label': 'Internal Product',
  'status.internal.description': 'Built and owned by Unchained Business.',
  'status.dismissed.label': 'Dismissed',
  'status.dismissed.description': 'No longer being pursued.',

  // ── Projects ──────────────────────────────────────────────────────────────
  'project.tancerca.description':
    'A marketplace and digital commerce platform designed and developed by Unchained Business.',
  'project.tancerca.category': 'Marketplace Platform',
  'project.tancerca.industry': 'Local commerce & delivery',
  'project.tancerca.summary':
    'TanCerca is our first completed flagship product: a marketplace connecting local merchants with nearby customers, including the merchant tooling, delivery coordination and payment infrastructure the marketplace runs on.',
  'project.tancerca.challenge':
    'A marketplace is not one product — it is three, and they have to work in sync. Merchants need tooling that fits how they actually run a shop. Customers need an experience fast and simple enough to use one-handed. And the operation between them needs orders, delivery and money to move reliably without someone manually holding it together. Building all three as one coherent system, rather than three disconnected apps, was the core problem.',
  'project.tancerca.solution':
    'We designed the platform around a single domain model shared by every surface, then built outward: merchant dashboards for catalogue, orders and fulfilment; a consumer PWA built for repeat use and low-bandwidth conditions; and the operational layer underneath — payments, subscriptions, referrals, delivery coordination and reporting. Every part was specified before it was built, which is the same sequence we apply to client work.',
  'project.tancerca.outcome':
    'A launch-ready, full-stack commerce platform running in production — the most complete demonstration of what we can build end to end.',

  'project.lanna-kamilina.description':
    'A Russian-language site for a beauty salon open in central Moscow since 1999 — service catalogue, master profiles, work gallery and online booking with live availability.',
  'project.lanna-kamilina.category': 'Salon & Booking Website',
  'project.lanna-kamilina.industry': 'Beauty & personal care',

  'project.lazara-sersa.description':
    'A brand and portfolio site for a makeup artist working across beauty, editorial, fashion and celebrity work.',
  'project.lazara-sersa.category': 'Portfolio Website',
  'project.lazara-sersa.industry': 'Beauty & editorial',

  'project.klassisches-ballet.description':
    'A launch and reservation site for the official European debut gala of a classical ballet company — a single-night cultural event.',
  'project.klassisches-ballet.category': 'Event Website',
  'project.klassisches-ballet.industry': 'Performing arts & culture',

  'project.mensalere.description':
    'A platform connecting people with psychology professionals for private online consultations, with professional profiles and online appointment booking.',
  'project.mensalere.category': 'Online Consultation Platform',
  'project.mensalere.industry': 'Mental health & wellbeing',

  'project.frito.description':
    'A mobile dating app for meeting new people in Cuba, with the marketing and download site behind its iOS and Android launch.',
  'project.frito.category': 'Mobile App',
  'project.frito.industry': 'Social & dating',

  'project.unchained-os.description':
    'Our own private equity operating system: deal analysis and comparison, pipeline CRM, capital allocation, multi-investor management and fund performance tracking.',
  'project.unchained-os.category': 'Internal Software',
  'project.unchained-os.industry': 'Private equity & investment operations',

  // ── /work ─────────────────────────────────────────────────────────────────
  'workPage.eyebrow': 'Portfolio',
  'workPage.statusKey': 'Project status key',
  'workPage.projects': 'Projects',
  'workPage.lede':
    'We’re building Unchained Business one project at a time. Everything below is shown at its real stage — shipped, in development, or still a concept. Nothing here is a client engagement dressed up as something else.',
  'workPage.provesTitle': 'What this portfolio proves — and what it doesn’t.',
  'workPage.provesBody':
    'These projects demonstrate that we can architect and build complex, production-grade systems end to end. They do not yet demonstrate large-scale commercial results for clients, and we won’t pretend otherwise. That evidence is what we’re building next — publicly, in our journey log.',

  // ── /work/[slug] ──────────────────────────────────────────────────────────
  'detail.allWork': 'All work',
  'detail.visitLive': 'Visit the live product',
  'detail.challenge': 'The challenge',
  'detail.whatWeBuilt': 'What we built',
  'detail.proves': 'What it proves',
  'detail.provesNote':
    'We report capability, not invented business results. These are the systems this project required us to design, build and operate.',
  'detail.outcome': 'Outcome',
  'detail.details': 'Project details',
  'detail.year': 'Year',
  'detail.industry': 'Industry',
  'detail.services': 'Services',
  'detail.stack': 'Stack',
  'detail.ctaTitle': 'Want something like this',
  'detail.ctaAccent': 'built for your business?',
  'detail.ctaBody':
    'Same process, same standards, applied to your problem — starting with a fixed-scope discovery and architecture engagement.',
  'detail.seeRest': 'See the rest of our work',

  // ── /journey ──────────────────────────────────────────────────────────────
  'journeyPage.eyebrow': 'The Unchained Challenge',
  'journeyPage.title': 'Building Unchained.',
  'journeyPage.lede':
    'Build a global technology company, one project at a time — documented in the open. This is the log: what we build, what happens, what we learn, and what changes as a result.',
  'journeyPage.asOf': 'As of',
  'journeyPage.howLogWorks': 'How this log works',
  'journeyPage.howLogBody':
    'Build. Measure. Document. Improve. Scale. This page is the “document” step, and it is deliberately unlike a corporate blog.',
  'journeyPage.theLog': 'The Log',
  'journeyPage.nextTitle':
    'The next entry gets written by what happens next.',
  'journeyPage.nextBody':
    'If you want to be part of it — as a client, a collaborator, or someone with a problem worth solving — start there.',
  'journeyPage.p1.title': 'We don’t hide mistakes.',
  'journeyPage.p1.body':
    'If something we built underperformed or an assumption was wrong, it goes in the log.',
  'journeyPage.p2.title': 'We don’t exaggerate wins.',
  'journeyPage.p2.body':
    'A shipped product is a shipped product. It is not a market position.',
  'journeyPage.p3.title': 'We don’t fabricate numbers.',
  'journeyPage.p3.body':
    'Any figure published here is one we can show evidence for. Until then, we describe capability instead.',
  'journeyPage.p4.title': 'We don’t manufacture authority.',
  'journeyPage.p4.body':
    'We are early. The log exists so you can judge us by what we accomplish, not by how we describe ourselves.',

  'stage.label': 'Stage: Early',
  'stage.since': 'August 2026',
  'stage.fact.domain': 'Since the domain was established',
  'stage.fact.domainValue': '~8 mo',
  'stage.fact.flagship': 'Completed flagship product',
  'stage.fact.inDev': 'Projects in development',
  'stage.fact.horizon': 'Horizon we are building against',
  'stage.fact.horizonValue': '5 yr',

  'timeline.built': 'What We Built',
  'timeline.happened': 'What Happened',
  'timeline.learned': 'What We Learned',
  'timeline.changed': 'What Changed',
  'timeline.next': 'Next Milestone',
  'timeline.stage': 'Stage',

  'entry.2026-08.date': 'August 2026',
  'entry.2026-08.stage': 'Early',
  'entry.2026-08.title': 'The Beginning of the Public Journey',
  'entry.2026-08.happened':
    'We spent our first months building instead of marketing. That was deliberate: we wanted something real to point at before asking anyone to trust us with their business. The result is a portfolio of technical capability and a company that is early but not empty. What we do not have yet is a body of client outcomes — and we decided to say so plainly rather than paper over it.',
  'entry.2026-08.learned':
    'Capability and reputation are not the same asset, and they are not earned the same way. Building a complex product proves we can build. It does not prove we can move a business metric for someone else. Conflating the two is how early companies end up making claims they cannot defend — so we separated them in our own language, on this site, permanently.',
  'entry.2026-08.changed':
    'We widened our positioning from client acquisition alone to digital infrastructure: software, automation and growth systems. We made the portfolio the centre of the site instead of a footnote. We removed every metric and testimonial we could not evidence. And we started documenting this publicly, in this log.',
  'entry.2026-08.nextMilestone':
    'Ship the next project from development to live, and publish our first client engagement with real, measured outcomes — reported here whether or not the numbers flatter us.',

  // ── Pillar pages ──────────────────────────────────────────────────────────
  'pillarPage.whatWeBuild': 'What we build',
  'pillarPage.howWeApproach': 'How we approach it',
  'pillarPage.youNeedThis': 'You probably need this if…',
  'pillarPage.whereWeAre': 'Where we are with this',
  'pillarPage.seeOurWork': 'See our work',
  'pillarPage.otherPillars': 'The other pillars',

  // Software Development
  'sd.eyebrow': 'Capability 01',
  'sd.lede':
    'Digital products and business systems built around the way your business actually operates — not around whatever the template assumed.',
  'sd.offering.websites.name': 'Websites',
  'sd.offering.websites.body':
    'Fast, accessible, well-structured sites that load quickly, rank properly and are genuinely editable by your team. Marketing sites, product sites, and the content architecture behind them.',
  'sd.offering.webapps.name': 'Web Applications',
  'sd.offering.webapps.body':
    'Software your business runs on: dashboards, portals, booking and ordering systems, internal platforms. Built for the people who use them all day, not for a demo.',
  'sd.offering.saas.name': 'SaaS Products',
  'sd.offering.saas.body':
    'Multi-tenant products with the parts founders underestimate — accounts and permissions, billing and subscriptions, onboarding, admin tooling, and the data model that has to survive version two.',
  'sd.offering.custom.name': 'Custom Software',
  'sd.offering.custom.body':
    'When the process is your competitive advantage, generic tools flatten it. We build the system that matches how you actually work, and integrate it with what you already run.',
  'sd.offering.products.name': 'Digital Products',
  'sd.offering.products.body':
    'Marketplaces, commerce platforms, and consumer-facing products, including the merchant, operations and payments infrastructure underneath them.',
  'sd.approach.1.heading': 'The architecture comes before the code',
  'sd.approach.1.body':
    'Most expensive software problems are decisions made too early and revisited too late — the data model, the boundaries between systems, who owns which piece of truth. We settle those on paper, where changing your mind is free.',
  'sd.approach.2.heading': 'Built in increments you can actually use',
  'sd.approach.2.body':
    'You see working software throughout the engagement, not a status report. That means feedback arrives while it is still cheap to act on, and there is no reveal at the end that either lands or does not.',
  'sd.approach.3.heading': 'You own everything',
  'sd.approach.3.body':
    'Code, infrastructure, accounts and documentation are yours. We build so that another team could pick it up — which is also the discipline that keeps a codebase honest.',
  'sd.proof':
    'TanCerca is the fullest demonstration of this pillar: a production marketplace platform with merchant dashboards, a consumer PWA, payments, subscriptions, referrals and delivery infrastructure — architected and built end to end.',

  // Business Automation
  'ba.eyebrow': 'Capability 02',
  'ba.lede':
    'Eliminate repetitive work, connect your tools, and turn manual processes into systems that run whether or not someone remembers to run them.',
  'ba.offering.workflow.name': 'Workflow Automation',
  'ba.offering.workflow.body':
    'The recurring sequences your team performs by hand — intake, approvals, onboarding, invoicing, reporting — rebuilt so they execute reliably and surface only the decisions that need a human.',
  'ba.offering.integrations.name': 'Integrations',
  'ba.offering.integrations.body':
    'Your CRM, billing, support, scheduling and internal systems, connected so data moves once and stays consistent. No more copy-paste between six tabs, no more disagreeing sources of truth.',
  'ba.offering.tools.name': 'Internal Tools',
  'ba.offering.tools.body':
    'The admin panel, ops console or review queue your team needs but no vendor sells. Usually small, usually the highest-leverage thing we build in an engagement.',
  'ba.offering.operational.name': 'Operational Systems',
  'ba.offering.operational.body':
    'The infrastructure that keeps day-to-day delivery moving: scheduling, fulfilment, status tracking, notifications, and the reporting that tells you where it is stuck.',
  'ba.approach.1.heading': 'Map the process before automating it',
  'ba.approach.1.body':
    'Automating a broken process gets you the same mess, faster and harder to see. We map what actually happens — including the informal steps people invented to cope — and fix the process first.',
  'ba.approach.2.heading': 'Automate the boring 80%, keep humans on the rest',
  'ba.approach.2.body':
    'The goal is not to remove judgement from your business. It is to stop spending judgement on data entry. We automate the deterministic parts and design clean hand-offs for everything that needs a person.',
  'ba.approach.3.heading': 'Observable by default',
  'ba.approach.3.body':
    'An automation you cannot see is a liability. Every system we build reports what it did, what it skipped and what failed — so a silent breakage does not become a quarterly surprise.',
  'ba.proof':
    'Automation is what makes our product work operationally: TanCerca coordinates orders, merchants, delivery, payments and subscriptions without someone manually holding the pieces together. That operational layer is the same discipline we apply to client processes.',

  // Growth Systems
  'gs.eyebrow': 'Capability 03',
  'gs.lede':
    'Once the digital foundation is in place, we build the systems that help a business attract, qualify, convert and retain customers — structurally, not through effort.',
  'gs.offering.acquisition.name': 'Client Acquisition',
  'gs.offering.acquisition.body':
    'The end-to-end path from first attention to booked conversation: positioning, offer clarity, the landing surfaces that carry them, and the mechanics that move someone from interested to in touch.',
  'gs.offering.qualification.name': 'Lead Qualification',
  'gs.offering.qualification.body':
    'Filtering built into the system rather than into your calendar. The right questions asked at the right moment, so the conversations you take are with people you can actually help.',
  'gs.offering.nurturing.name': 'Nurturing',
  'gs.offering.nurturing.body':
    'Structured follow-up for the majority who are not ready today. Sequenced, relevant, and automatic — because the alternative is a pipeline that depends on someone remembering.',
  'gs.offering.conversion.name': 'Conversion Systems',
  'gs.offering.conversion.body':
    'Instrumented funnels, tested surfaces and measured hand-offs, so improvements are based on where people actually drop out rather than on opinion.',
  'gs.approach.1.heading': 'Infrastructure, not tactics',
  'gs.approach.1.body':
    'Tactics decay. A tactic that works this quarter is a channel everyone copies next quarter. What holds value is the system underneath — how attention is captured, qualified, followed up and measured — because it survives any individual channel going quiet.',
  'gs.approach.2.heading': 'Foundation first',
  'gs.approach.2.body':
    'Growth systems amplify whatever they sit on. If the site is slow, the data is fragmented or the follow-up is manual, more traffic mostly produces more leakage. We often fix or build the foundation before adding acquisition on top — which is exactly why this is the third pillar and not the first.',
  'gs.approach.3.heading': 'Measured honestly',
  'gs.approach.3.body':
    'We instrument the funnel so the numbers describe reality, including when they are unflattering. A system that reports its own weak point is more valuable than one that reports a good-looking total.',
  'gs.proof':
    'Client acquisition systems are where Unchained Business started, and they remain a core capability. We are applying them to our own company first — this site, its instrumentation and the journey log are that system running on ourselves, in public.',

  // ── /insights ─────────────────────────────────────────────────────────────
  'insightsPage.eyebrow': 'Insights',
  'insightsPage.title': 'How We Think',
  'insightsPage.titleAccent': 'About Building.',
  'insightsPage.lede':
    'Writing on software, business automation and growth systems — the decisions, trade-offs and reasoning behind the infrastructure we build for businesses.',
  'insightsPage.articles': 'Articles',
  'insightsPage.empty.title': 'Nothing published here yet.',
  'insightsPage.empty.body':
    'This is where we will write about the decisions behind the systems we build — the trade-offs, the things that did not work, and the reasoning we would want to read before hiring someone to build software for us. The section exists before the writing does, deliberately: we would rather publish nothing than publish filler.',
  'insightsPage.empty.journey':
    'In the meantime, the journey log records what we are building as it happens, and the portfolio shows what has been built so far.',
  'insightsPage.pillarsHeading': 'What we write about',

  // ── /insights/[slug] ──────────────────────────────────────────────────────
  'article.allInsights': 'All insights',
  'article.published': 'Published',
  'article.updated': 'Updated',
  'article.pillarHeading': 'Where this fits in what we build',
  'article.caseStudy': 'The case study behind this',
  'article.relatedReading': 'Related reading',
  'article.ctaTitle': 'Recognise this problem',
  'article.ctaAccent': 'in your own business?',
  'article.ctaBody':
    'Tell us what is not working. If we can help, we will say how — starting with a fixed-scope discovery and architecture engagement. If we cannot, we will say that too.',

  // ── 404 ───────────────────────────────────────────────────────────────────
  'notFound.title': 'This page hasn’t',
  'notFound.titleAccent': 'been built yet.',
  'notFound.body':
    'Which, given what we do, we appreciate the irony of. Here is where to go instead.',
  'notFound.backHome': 'Back home',

  // ── Footer ────────────────────────────────────────────────────────────────
  // ── Commercial contact panel ─────────────────────────────────────
  // What a visitor sees after pressing "Start a Project". Deliberately free of
  // routing vocabulary (§16): no rule, no priority, no assignment, no region —
  // the visitor is being introduced to a person, not shown an algorithm.
  // A representative's name and role are data and arrive from the resolver, so
  // they are never translated here.
  'contact.title': 'Let’s build something together.',
  'contact.subtitle':
    'Tell us what you’re trying to build. Your regional contact takes it from there.',
  'contact.regionalContact': 'Your regional business contact',
  'contact.loading': 'Finding your regional contact…',
  'contact.whatsapp': 'WhatsApp',
  'contact.telegram': 'Telegram',
  'contact.scheduleCall': 'Schedule a Call',
  'contact.email': 'Email',
  'contact.unavailable': 'We couldn’t determine a regional contact right now.',
  'contact.fallback': 'Please contact Unchained Business directly.',
  'contact.noChannels':
    'Our contact options are being updated right now. Please try again shortly.',
  'contact.close': 'Close',
  'contact.newTab': 'opens in a new tab',

  // ── Project inquiry (Phase 7) ─────────────────────────────────────────────
  // The optional form under the contact channels. §52: not one of these strings
  // says lead, pipeline, status, CRM or routing — in any language. The visitor
  // is writing to a company, and a person will write back.
  'inquiry.toggle': 'Prefer to write? Tell us about your project',
  'inquiry.title': 'Tell us briefly about your project and we will reply.',
  'inquiry.name': 'Your name',
  'inquiry.email': 'Email',
  'inquiry.phone': 'Phone',
  'inquiry.company': 'Company',
  'inquiry.service': 'What do you need?',
  'inquiry.servicePlaceholder': 'Not sure yet',
  'inquiry.message': 'About the project',
  'inquiry.optional': '(optional)',
  'inquiry.send': 'Send',
  'inquiry.sending': 'Sending…',
  'inquiry.sentTitle': 'Thank you — your message is with us.',
  'inquiry.sentBody':
    'Your regional contact will get back to you personally. If you would rather talk now, the channels above are still open.',
  'inquiry.privacy':
    'We use your details only to reply to this enquiry. Nothing is shared with anyone else.',
  'inquiry.error.name': 'Please tell us your name.',
  'inquiry.error.email': 'That email address does not look right.',
  'inquiry.error.phone': 'That phone number does not look right.',
  'inquiry.error.contact': 'Please leave an email address or a phone number so we can reply.',
  'inquiry.error.message': 'That message is a little too long — please shorten it.',
  'inquiry.error.invalid': 'Please check the details above and try again.',
  'inquiry.error.rateLimited': 'That is a few messages in a short time. Please try again in a moment.',
  'inquiry.error.unavailable':
    'We could not send that just now. Please try again, or use one of the channels above.',

  'footer.tagline':
    'Digital infrastructure for growing businesses. Software, automation and growth systems — built one project at a time.',
  'footer.capabilities': 'Capabilities',
  'footer.company': 'Company',
  'footer.theJourney': 'The Journey',
  'footer.rights': 'All rights reserved.',
  'footer.motto': 'Build → Prove → Scale.',
} as const;

/**
 * List-valued strings. Kept separate from `en` so `t()` stays string-typed and
 * `tList()` array-typed, rather than every lookup returning a union.
 */
export const enLists = {
  'pillarItems.software-development': [
    'Websites',
    'Web Applications',
    'SaaS',
    'Custom Software',
    'Digital Products',
  ],
  'pillarItems.business-automation': [
    'Workflow Automation',
    'Integrations',
    'Internal Tools',
    'Operational Systems',
  ],
  'pillarItems.growth-systems': [
    'Client Acquisition',
    'Lead Qualification',
    'Nurturing',
    'Conversion Systems',
  ],

  'svc.discovery.features': [
    'Operational & technical audit',
    'System architecture and data model',
    'Scope, sequence and delivery plan',
    'Fixed scope, fixed timeline',
  ],
  'svc.build.features': [
    'Product design and development',
    'Integrations and automation',
    'Deployment and handover',
    'Documentation your team can work from',
    'Working increments throughout, not a black box',
  ],
  'svc.growth.features': [
    'Client acquisition systems',
    'Lead qualification & nurturing flows',
    'Conversion and funnel optimization',
    'Performance measurement and reporting',
  ],

  'cta.commitments': [
    'Fixed-scope discovery',
    'Working increments, not black boxes',
    'You own everything we build',
  ],

  'project.tancerca.services': [
    'Product architecture',
    'Product design',
    'Full-stack development',
    'Operational systems',
  ],
  'project.tancerca.capabilities': [
    'Marketplace architecture',
    'Merchant systems & dashboards',
    'Consumer experience (PWA)',
    'Delivery infrastructure',
    'Subscriptions & payments',
    'Referral systems',
    'Backend infrastructure',
    'Operational workflows',
  ],

  'entry.2026-08.built': [
    'TanCerca — our first completed flagship product: a marketplace platform with merchant systems, a consumer PWA, payments, subscriptions, referrals and delivery infrastructure.',
    'Five further projects, now in active development across software, automation and growth systems.',
    'The internal architecture, delivery process and standards we apply to every build.',
    'This site — rebuilt around what we have actually made rather than around claims.',
  ],

  'sd.signals': [
    'Your team maintains a spreadsheet that the software should be handling.',
    'Off-the-shelf tools force a workflow that does not match your business.',
    'You have a product idea and need someone who can architect it, not just implement tickets.',
    'An existing system works but cannot take the next order of magnitude.',
  ],
  'ba.signals': [
    'The same data gets typed into more than one system.',
    'A critical process depends on one person remembering to do it.',
    'Reporting means assembling a spreadsheet by hand every week.',
    'Your tools each do their job, but nothing connects them.',
  ],
  'gs.signals': [
    'Leads arrive but follow-up depends on whoever has time.',
    'You are generating attention that does not convert into conversations.',
    'You cannot say which step of your funnel loses the most people.',
    'Acquisition works when you push it, and stops when you stop.',
  ],
} as const;

export type TranslationKey = keyof typeof en;
export type ListKey = keyof typeof enLists;

export type Dictionary = Record<TranslationKey, string>;
export type ListDictionary = Record<ListKey, readonly string[]>;
